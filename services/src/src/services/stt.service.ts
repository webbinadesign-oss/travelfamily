/**
 * Speech-to-Text — Webbina listening. Works on EVERY phone (incl. iPhone/Safari)
 * because transcription happens server-side: the browser just records audio
 * (MediaRecorder, universally supported) and posts it here.
 * Uses OpenAI Whisper (we already have OPENAI_API_KEY).
 * Docs: https://platform.openai.com/docs/api-reference/audio/createTranscription
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';

const URL = 'https://api.openai.com/v1/audio/transcriptions';

function assertConfigured(): void {
  if (!env.openaiApiKey) {
    throw ApiError.serviceUnavailable(
      'stt_not_configured',
      'OpenAI key is not set. Define OPENAI_API_KEY for speech-to-text.',
    );
  }
}

export const sttService = {
  /** Transcribe an audio buffer (mp4/m4a/webm/wav/mp3) to French text. */
  async transcribe(audio: Buffer, mime: string): Promise<string> {
    assertConfigured();
    const ext = mime.includes('mp4') || mime.includes('m4a') ? 'mp4'
      : mime.includes('webm') ? 'webm'
      : mime.includes('wav') ? 'wav'
      : mime.includes('ogg') ? 'ogg'
      : 'mp3';

    const form = new FormData();
    const blob = new Blob([audio], { type: mime || 'audio/mp4' });
    form.append('file', blob, `audio.${ext}`);
    form.append('model', 'whisper-1');
    form.append('language', 'fr');
    form.append('response_format', 'json');

    const res = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.openaiApiKey}` },
      body: form,
    });
    if (!res.ok) {
      let detail: unknown;
      try { detail = await res.json(); } catch { detail = await res.text().catch(() => undefined); }
      throw ApiError.upstream('whisper', res.status, detail);
    }
    const data = (await res.json()) as { text?: string };
    return (data.text || '').trim();
  },
};
