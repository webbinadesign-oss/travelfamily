/**
 * Google Gemini — Webbina's brain (free tier, generous quota).
 * Drop-in alternative to OpenAI: same WEBBINA_PERSONA, same structured output
 * { reply, emotion, suggestions, action }, plus a streaming generator.
 * Uses the Generative Language API with an API key (AIza...).
 * Docs: https://ai.google.dev/api
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';
import type { ChatMessage, ChatResponse, TripContext } from '../types/index.js';
import { WEBBINA_PERSONA, webbinaContextToText, coerceWebbina } from './openai.service.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function assertConfigured(): void {
  if (!env.geminiApiKey) {
    throw ApiError.serviceUnavailable(
      'gemini_not_configured',
      'Gemini key is not set. Define GEMINI_API_KEY.',
    );
  }
}

/** Map our chat messages → Gemini "contents" (user/model roles). */
function toContents(messages: ChatMessage[]): Array<{ role: string; parts: { text: string }[] }> {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

function systemInstruction(context?: TripContext, jsonMode = true): { parts: { text: string }[] } {
  const ctx = webbinaContextToText(context);
  const extra = jsonMode
    ? '\nRéponds UNIQUEMENT avec un objet JSON valide correspondant au schéma demandé, sans texte autour.'
    : '\nIci, réponds en texte simple (pas de JSON).';
  return { parts: [{ text: WEBBINA_PERSONA + (ctx ? `\n${ctx}` : '') + extra }] };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

function extractText(data: GeminiResponse): string {
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
}

export const geminiService = {
  /** One-shot structured reply (same shape as openaiService.chat). */
  async chat(messages: ChatMessage[], context?: TripContext): Promise<ChatResponse> {
    assertConfigured();
    const data = await httpRequest<GeminiResponse>(
      `${BASE}/${env.geminiModel}:generateContent`,
      {
        method: 'POST',
        provider: 'gemini',
        timeoutMs: 30_000,
        query: { key: env.geminiApiKey },
        body: {
          systemInstruction: systemInstruction(context, true),
          contents: toContents(messages),
          generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
        },
      },
    );
    const content = extractText(data) || '{}';
    let parsed: Partial<ChatResponse> | null = null;
    try {
      parsed = JSON.parse(content) as Partial<ChatResponse>;
    } catch {
      parsed = { reply: content };
    }
    return coerceWebbina(parsed);
  },

  /** Streaming generator: yields text chunks via Gemini's SSE endpoint. */
  async *streamChat(messages: ChatMessage[], context?: TripContext): AsyncGenerator<string> {
    assertConfigured();
    const res = await fetch(
      `${BASE}/${env.geminiModel}:streamGenerateContent?alt=sse&key=${env.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemInstruction(context, false),
          contents: toContents(messages),
          generationConfig: { temperature: 0.7 },
        }),
      },
    );
    if (!res.ok || !res.body) throw ApiError.upstream('gemini', res.status);

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
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const payload = s.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload) as GeminiResponse;
          const text = extractText(json);
          if (text) yield text;
        } catch {
          /* ignore partial keep-alive lines */
        }
      }
    }
  },
};
