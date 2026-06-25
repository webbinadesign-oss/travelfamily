/**
 * Google Cloud Speech-to-Text — Webbina listening, FREE (~60 min/month).
 * Handles the formats browsers produce with MediaRecorder on Android/desktop:
 * webm/opus and ogg/opus. (iPhone records mp4/aac, which this API does NOT
 * accept — the route falls back to Whisper for that case.)
 * Same GOOGLE_CLOUD_API_KEY. Docs: https://cloud.google.com/speech-to-text/docs
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';

const URL = 'https://speech.googleapis.com/v1/speech:recognize';

/** True when Google STT can read this mime (opus in webm/ogg). */
export function googleSttSupports(mime: string): boolean {
  const m = (mime || '').toLowerCase();
  return m.includes('webm') || m.includes('ogg') || m.includes('opus');
}

function encodingFor(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('ogg')) return 'OGG_OPUS';
  return 'WEBM_OPUS'; // webm/opus (Chrome/Android/Firefox MediaRecorder default)
}

interface RecognizeResponse {
  results?: { alternatives?: { transcript?: string }[] }[];
}

export const googleSttService = {
  async transcribe(audio: Buffer, mime: string): Promise<string> {
    if (!env.googleApiKey) {
      throw ApiError.serviceUnavailable('googlestt_not_configured', 'Google key is not set.');
    }
    const data = await httpRequest<RecognizeResponse>(URL, {
      method: 'POST',
      provider: 'google-stt',
      timeoutMs: 30_000,
      query: { key: env.googleApiKey },
      body: {
        config: {
          encoding: encodingFor(mime),
          languageCode: 'fr-FR',
          enableAutomaticPunctuation: true,
          model: 'latest_long',
        },
        audio: { content: audio.toString('base64') },
      },
    });
    const text = (data.results || [])
      .map((r) => r.alternatives?.[0]?.transcript || '')
      .join(' ')
      .trim();
    return text;
  },
};
