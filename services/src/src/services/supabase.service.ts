/**
 * Supabase data access via PostgREST (server-side, service_role key).
 * Thin typed helpers — no extra dependency. RLS is bypassed by service_role,
 * so EVERY query here is explicitly scoped by user_id.
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest, type QueryValue } from '../lib/httpClient.js';

function baseUrl(): string {
  // Accept either ".../rest/v1/" or the project root.
  const u = env.supabaseUrl.replace(/\/+$/, '');
  return u.endsWith('/rest/v1') ? u : `${u}/rest/v1`;
}

function assertConfigured(): void {
  const key = env.supabaseServiceRoleKey || env.supabaseAnonKey;
  if (!env.supabaseUrl || !key) {
    throw ApiError.serviceUnavailable(
      'supabase_not_configured',
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = env.supabaseServiceRoleKey || env.supabaseAnonKey;
  // Force the PostgreSQL schema that holds our tables (the migration creates them
  // in "public"). Some Supabase projects default the Data API to another schema
  // (e.g. "api"); these headers make every request target the right one
  // regardless. Override with SUPABASE_SCHEMA if you created them elsewhere.
  const schema = env.supabaseSchema || 'public';
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Accept-Profile': schema,   // schema for GET/HEAD
    'Content-Profile': schema,  // schema for POST/PATCH/PUT/DELETE
    ...extra,
  };
}

export interface SelectOptions {
  select?: string;
  match?: Record<string, QueryValue>;
  order?: string; // e.g. 'created_at.desc'
  limit?: number;
  single?: boolean;
}

export const supabase = {
  async select<T>(table: string, opts: SelectOptions = {}): Promise<T[]> {
    assertConfigured();
    const query: Record<string, QueryValue> = {
      select: opts.select ?? '*',
      ...(opts.order ? { order: opts.order } : {}),
      ...(opts.limit ? { limit: opts.limit } : {}),
    };
    if (opts.match) for (const [k, v] of Object.entries(opts.match)) query[k] = `eq.${v}`;
    return httpRequest<T[]>(`${baseUrl()}/${table}`, {
      provider: 'supabase',
      headers: headers(),
      query,
    });
  },

  async selectOne<T>(table: string, opts: SelectOptions = {}): Promise<T | null> {
    const rows = await this.select<T>(table, { ...opts, limit: 1 });
    return rows[0] ?? null;
  },

  /** Insert (or upsert when onConflict is given) and return the row(s). */
  async upsert<T>(
    table: string,
    rows: Record<string, unknown> | Record<string, unknown>[],
    onConflict?: string,
  ): Promise<T[]> {
    assertConfigured();
    return httpRequest<T[]>(`${baseUrl()}/${table}`, {
      method: 'POST',
      provider: 'supabase',
      headers: headers({
        Prefer: `return=representation,resolution=merge-duplicates`,
      }),
      ...(onConflict ? { query: { on_conflict: onConflict } } : {}),
      body: rows,
    });
  },

  async update<T>(
    table: string,
    match: Record<string, QueryValue>,
    patch: Record<string, unknown>,
  ): Promise<T[]> {
    assertConfigured();
    const query: Record<string, QueryValue> = {};
    for (const [k, v] of Object.entries(match)) query[k] = `eq.${v}`;
    return httpRequest<T[]>(`${baseUrl()}/${table}`, {
      method: 'PATCH',
      provider: 'supabase',
      headers: headers({ Prefer: 'return=representation' }),
      query,
      body: patch,
    });
  },

  async remove(table: string, match: Record<string, QueryValue>): Promise<void> {
    assertConfigured();
    const query: Record<string, QueryValue> = {};
    for (const [k, v] of Object.entries(match)) query[k] = `eq.${v}`;
    await httpRequest<unknown>(`${baseUrl()}/${table}`, {
      method: 'DELETE',
      provider: 'supabase',
      headers: headers(),
      query,
    });
  },
};
