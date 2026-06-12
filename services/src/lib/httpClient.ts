/**
 * Thin fetch wrapper used by every service:
 *  - query-string building
 *  - JSON / text / binary parsing
 *  - AbortController timeout
 *  - simple retry with backoff for transient (429/5xx) errors
 *  - normalized ApiError on failure
 */
import { ApiError } from './ApiError.js';

export type QueryValue = string | number | boolean | undefined | null;

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  query?: Record<string, QueryValue>;
  /** Object → JSON, string → as-is, URLSearchParams → form. */
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  /** What to read from the response. Default 'json'. */
  as?: 'json' | 'text' | 'arrayBuffer';
  /** Provider name for clearer upstream errors. */
  provider?: string;
}

function buildUrl(url: string, query?: Record<string, QueryValue>): string {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function httpRequest<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    query,
    body,
    timeoutMs = 12_000,
    retries = 2,
    as = 'json',
    provider = 'upstream',
  } = opts;

  const finalUrl = buildUrl(url, query);
  const init: RequestInit = { method, headers: { ...headers } };

  if (body !== undefined) {
    if (body instanceof URLSearchParams) {
      init.body = body;
      (init.headers as Record<string, string>)['Content-Type'] =
        'application/x-www-form-urlencoded';
    } else if (typeof body === 'string') {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      if (!(init.headers as Record<string, string>)['Content-Type']) {
        (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
    }
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(finalUrl, { ...init, signal: ctrl.signal });
      clearTimeout(timer);

      if (!res.ok) {
        // Retry transient failures.
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          await sleep(250 * 2 ** attempt);
          continue;
        }
        let details: unknown;
        try {
          details = await res.json();
        } catch {
          details = await res.text().catch(() => undefined);
        }
        throw ApiError.upstream(provider, res.status, details);
      }

      if (as === 'arrayBuffer') return (await res.arrayBuffer()) as unknown as T;
      if (as === 'text') return (await res.text()) as unknown as T;
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err instanceof ApiError) throw err;
      // Network/abort → retry, else surface as 504.
      if (attempt < retries) {
        await sleep(250 * 2 ** attempt);
        continue;
      }
      const aborted = err instanceof Error && err.name === 'AbortError';
      throw new ApiError(
        aborted ? 504 : 502,
        aborted ? 'upstream_timeout' : 'network_error',
        aborted ? `Request to ${provider} timed out.` : `Network error calling ${provider}.`,
      );
    }
  }
  throw lastErr instanceof Error ? lastErr : new ApiError(502, 'network_error', 'Unknown error');
}
