/**
 * Anthropic Claude — Webbina's primary brain (fast + sharp).
 * Same contract as the other brains: chat() returns { reply, emotion,
 * suggestions, action }, streamChat() yields text tokens. Reuses the shared
 * WEBBINA_PERSONA + context formatter so behaviour stays consistent.
 *
 * Activate by setting CLAUDE_API_KEY (sk-ant-…) on the backend. If absent,
 * the chat router simply falls back to Gemini → OpenAI.
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import type { ChatMessage, ChatResponse, TripContext } from '../types/index.js';
import { WEBBINA_PERSONA, webbinaContextToText, coerceWebbina } from './openai.service.js';

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

function assertConfigured(): void {
  if (!env.claudeApiKey) throw ApiError.serviceUnavailable('Claude non configuré (CLAUDE_API_KEY).');
}

function system(context?: TripContext, jsonMode = true): string {
  const ctx = webbinaContextToText(context);
  const extra = jsonMode
    ? '\nRéponds UNIQUEMENT avec un objet JSON valide {"reply","emotion","suggestions","action"}, sans texte autour, sans markdown.'
    : '\nIci, réponds en texte simple (pas de JSON, pas de markdown).';
  return WEBBINA_PERSONA + (ctx ? `\n${ctx}` : '') + extra;
}

/** Claude wants alternating user/assistant turns; drop system + map roles. */
function toMessages(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content } as const));
}

interface ClaudeResponse { content?: Array<{ type: string; text?: string }>; }

export const claudeService = {
  async chat(messages: ChatMessage[], context?: TripContext): Promise<ChatResponse> {
    assertConfigured();
    const data = await httpClaude({
      system: system(context, true),
      messages: toMessages(messages),
      stream: false,
    });
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('') || '{}';
    let parsed: Partial<ChatResponse> | null = null;
    try { parsed = JSON.parse(text) as Partial<ChatResponse>; }
    catch {
      // Claude sometimes wraps JSON in prose — extract the first {...} block.
      const m = text.match(/\{[\s\S]*\}/);
      try { parsed = m ? (JSON.parse(m[0]) as Partial<ChatResponse>) : { reply: text }; }
      catch { parsed = { reply: text }; }
    }
    return coerceWebbina(parsed);
  },

  async *streamChat(messages: ChatMessage[], context?: TripContext): AsyncGenerator<string> {
    assertConfigured();
    const ctrl = new AbortController();
    const res = await fetch(CLAUDE_URL, {
      method: 'POST', signal: ctrl.signal,
      headers: {
        'x-api-key': env.claudeApiKey,
        'anthropic-version': VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.claudeModel,
        max_tokens: 1024,
        temperature: 0.7,
        system: system(context, false),
        messages: toMessages(messages),
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw ApiError.upstream('claude', res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const j = JSON.parse(payload) as { type?: string; delta?: { text?: string } };
          if (j.type === 'content_block_delta' && j.delta?.text) yield j.delta.text;
        } catch { /* ignore */ }
      }
    }
  },
};

async function httpClaude(body: { system: string; messages: Array<{ role: string; content: string }>; stream: boolean }): Promise<ClaudeResponse> {
  const res = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': env.claudeApiKey,
      'anthropic-version': VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.claudeModel,
      max_tokens: 1024,
      temperature: 0.7,
      system: body.system,
      messages: body.messages,
    }),
  });
  if (!res.ok) throw ApiError.upstream('claude', res.status);
  return (await res.json()) as ClaudeResponse;
}
