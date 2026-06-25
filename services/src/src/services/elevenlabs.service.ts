/**
 * ElevenLabs — voice.
 *  - tts(): text-to-speech audio for Webbina's replies.
 *  - getAgentSignedUrl(): a short-lived signed URL so the BROWSER can open a
 *    secure WebSocket to Webbina's Conversational AI agent WITHOUT ever seeing
 *    the API key. This is the recommended way to connect the frontend.
 * Docs: https://elevenlabs.io/docs/conversational-ai
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';
import type { TtsRequest, SignedAgentUrl, WebbinaEmotion } from '../types/index.js';

const BASE = 'https://api.elevenlabs.io/v1';

function assertConfigured(): void {
  if (!env.elevenLabsApiKey) {
    throw ApiError.serviceUnavailable(
      'elevenlabs_not_configured',
      'ElevenLabs key is not set. Define ELEVENLABS_API_KEY.',
    );
  }
}

/** Map Webbina's emotion → voice expressiveness (style 0..1). */
export function emotionToStyle(emotion: WebbinaEmotion): number {
  const map: Record<WebbinaEmotion, number> = {
    neutral: 0.2,
    focused: 0.25,
    reassuring: 0.35,
    happy: 0.55,
    surprised: 0.7,
    enthusiastic: 0.85,
  };
  return map[emotion];
}

export const elevenLabsService = {
  /** Returns MP3 audio bytes for the given text. */
  async tts(req: TtsRequest): Promise<{ audio: ArrayBuffer; contentType: string }> {
    assertConfigured();
    const voiceId = req.voiceId || env.elevenLabsVoiceId;
    if (!voiceId) {
      throw ApiError.badRequest('No voiceId provided and ELEVENLABS_VOICE_ID is unset.');
    }
    const format = req.format ?? 'mp3_44100_128';
    const audio = await httpRequest<ArrayBuffer>(
      `${BASE}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        provider: 'elevenlabs',
        as: 'arrayBuffer',
        timeoutMs: 30_000,
        query: { output_format: format },
        headers: { 'xi-api-key': env.elevenLabsApiKey, Accept: 'audio/mpeg' },
        body: {
          text: req.text,
          model_id: req.modelId ?? 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
            style: req.style ?? 0.4,
            use_speaker_boost: true,
          },
        },
      },
    );
    return { audio, contentType: format.startsWith('mp3') ? 'audio/mpeg' : 'audio/wav' };
  },

  /** Short-lived signed URL for the browser to open the agent WebSocket. */
  async getAgentSignedUrl(): Promise<SignedAgentUrl> {
    assertConfigured();
    if (!env.elevenLabsAgentId) {
      throw ApiError.serviceUnavailable('elevenlabs_agent_unset', 'ELEVENLABS_AGENT_ID is not set.');
    }
    const data = await httpRequest<{ signed_url: string }>(
      `${BASE}/convai/conversation/get-signed-url`,
      {
        provider: 'elevenlabs',
        query: { agent_id: env.elevenLabsAgentId },
        headers: { 'xi-api-key': env.elevenLabsApiKey },
      },
    );
    return { signedUrl: data.signed_url, agentId: env.elevenLabsAgentId, expiresInSeconds: 900 };
  },

  /** List available voices (to pick/clone Webbina's voice). */
  async listVoices(): Promise<{ id: string; name: string }[]> {
    assertConfigured();
    const data = await httpRequest<{ voices: { voice_id: string; name: string }[] }>(
      `${BASE}/voices`,
      { provider: 'elevenlabs', headers: { 'xi-api-key': env.elevenLabsApiKey } },
    );
    return data.voices.map((v) => ({ id: v.voice_id, name: v.name }));
  },
};
