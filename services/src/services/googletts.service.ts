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

/** Warm, natural French female neural voice for Webbina. */
const WEBBINA_VOICE = 'fr-FR-Neural2-C';

function assertConfigured(): void {
  if (!env.googleApiKey) {
    throw ApiError.serviceUnavailable(
      'googletts_not_configured',
      'Google key is not set. Define GOOGLE_CLOUD_API_KEY.',
    );
  }
}

/** Map emotion → light prosody (rate/pitch) so she's expressive, not flat. */
function prosody(emotion: WebbinaEmotion): { rate: number; pitch: number } {
  const map: Record<WebbinaEmotion, { rate: number; pitch: number }> = {
    neutral: { rate: 1.0, pitch: 0 },
    focused: { rate: 0.99, pitch: -0.5 },
    reassuring: { rate: 0.95, pitch: -1.0 },
    happy: { rate: 1.03, pitch: 1.5 },
    surprised: { rate: 1.05, pitch: 3.0 },
    enthusiastic: { rate: 1.06, pitch: 2.5 },
  };
  return map[emotion];
}

export const googleTtsService = {
  async tts(text: string, emotion: WebbinaEmotion = 'happy'): Promise<ArrayBuffer> {
    assertConfigured();
    const p = prosody(emotion);
    const data = await httpRequest<{ audioContent?: string }>(URL, {
      method: 'POST',
      provider: 'google-tts',
      timeoutMs: 20_000,
      query: { key: env.googleApiKey },
      body: {
        input: { text },
        voice: { languageCode: 'fr-FR', name: WEBBINA_VOICE, ssmlGender: 'FEMALE' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: p.rate, pitch: p.pitch },
      },
    });
    if (!data.audioContent) throw ApiError.upstream('google-tts', 502, { reason: 'no_audio' });
    // audioContent is base64-encoded MP3.
    return Buffer.from(data.audioContent, 'base64').buffer as ArrayBuffer;
  },
};
