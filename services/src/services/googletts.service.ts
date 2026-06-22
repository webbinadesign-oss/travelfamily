/**
 * Google Cloud Text-to-Speech — Webbina's voice (free up to ~1M chars/month).
 * Server-side, so EVERY user hears the SAME consistent voice. Uses the same
 * GOOGLE_CLOUD_API_KEY (API-key auth via ?key=). Returns MP3 bytes.
 * Enable "Cloud Text-to-Speech API" in Google Cloud Console.
 * Docs: https://cloud.google.com/text-to-speech/docs
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';
import type { WebbinaEmotion } from '../types/index.js';

const URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/** Webbina's voice. Chirp3-HD = Google's most natural, human voice (2024+).
 * Aoede is a warm, friendly female timbre. Falls back to Wavenet if HD fails. */
const WEBBINA_VOICE_HD = 'fr-FR-Chirp3-HD-Aoede';
const WEBBINA_VOICE_FALLBACK = 'fr-FR-Wavenet-E';

function assertConfigured(): void {
  if (!env.googleApiKey) {
    throw ApiError.serviceUnavailable(
      'googletts_not_configured',
      'Google key is not set. Define GOOGLE_CLOUD_API_KEY.',
    );
  }
}

/** Map emotion → speaking rate. (Chirp3-HD ignores pitch, so we drive warmth via rate.) */
function rateFor(emotion: WebbinaEmotion): number {
  const map: Record<WebbinaEmotion, number> = {
    neutral: 1.0, focused: 0.98, reassuring: 0.94,
    happy: 1.02, surprised: 1.05, enthusiastic: 1.04,
  };
  return map[emotion];
}

async function synth(voice: string, text: string, rate: number, withPitch: boolean, pitch: number): Promise<ArrayBuffer> {
  const data = await httpRequest<{ audioContent?: string }>(URL, {
    method: 'POST',
    provider: 'google-tts',
    timeoutMs: 20_000,
    query: { key: env.googleApiKey },
    body: {
      input: { text },
      voice: { languageCode: 'fr-FR', name: voice },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: rate,
        ...(withPitch ? { pitch } : {}),       // HD voices reject pitch
      },
    },
  });
  if (!data.audioContent) throw ApiError.upstream('google-tts', 502, { reason: 'no_audio' });
  return Buffer.from(data.audioContent, 'base64').buffer as ArrayBuffer;
}

export const googleTtsService = {
  async tts(text: string, emotion: WebbinaEmotion = 'happy'): Promise<ArrayBuffer> {
    assertConfigured();
    const rate = rateFor(emotion);
    // 1) Try the natural HD voice (no pitch param — HD doesn't allow it).
    try {
      return await synth(WEBBINA_VOICE_HD, text, rate, false, 0);
    } catch (e) {
      // 2) Fallback to Wavenet (supports pitch for a touch of warmth).
      const pitch = emotion === 'reassuring' ? -1.0 : emotion === 'enthusiastic' ? 2.0 : 1.0;
      return await synth(WEBBINA_VOICE_FALLBACK, text, rate, true, pitch);
    }
  },
};
