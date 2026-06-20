import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { elevenLabsService, emotionToStyle } from '../services/elevenlabs.service.js';
import { googleTtsService } from '../services/googletts.service.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { WebbinaEmotion } from '../types/index.js';

export const voiceRouter = Router();

/** GET /api/voice/agent-url — signed URL for the browser to open the agent WS. */
voiceRouter.get(
  '/agent-url',
  asyncHandler(async (_req, res) => {
    const signed = await elevenLabsService.getAgentSignedUrl();
    res.json(signed);
  }),
);

/** GET /api/voice/voices — available voices (to pick Webbina's). */
voiceRouter.get(
  '/voices',
  asyncHandler(async (_req, res) => {
    const voices = await elevenLabsService.listVoices();
    res.json({ items: voices, total: voices.length });
  }),
);

const TtsBody = z.object({
  text: z.string().min(1).max(2000),
  voiceId: z.string().optional(),
  emotion: z
    .enum(['neutral', 'happy', 'focused', 'reassuring', 'surprised', 'enthusiastic'])
    .optional(),
  format: z.enum(['mp3_44100_128', 'pcm_16000']).optional(),
});

/** POST /api/voice/tts — synthesize Webbina speaking; returns audio bytes.
 * Provider order: Google TTS (free, consistent) → ElevenLabs (premium, paid). */
voiceRouter.post(
  '/tts',
  validate(TtsBody, 'body'),
  asyncHandler(async (req, res) => {
    const body = valid<{ text: string; voiceId?: string; emotion?: WebbinaEmotion; format?: 'mp3_44100_128' | 'pcm_16000' }>(req);
    const emotion = body.emotion ?? 'happy';

    // 1) Google Cloud TTS — free up to ~1M chars/month, same voice for everyone.
    if (env.googleApiKey) {
      try {
        const audio = await googleTtsService.tts(body.text, emotion);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.send(Buffer.from(audio));
        return;
      } catch (e) {
        logger.warn('Google TTS failed, falling back to ElevenLabs', { err: String(e) });
      }
    }

    // 2) Fallback: ElevenLabs (premium, consumes credits).
    const { audio, contentType } = await elevenLabsService.tts({
      text: body.text,
      ...(body.voiceId ? { voiceId: body.voiceId } : {}),
      ...(body.format ? { format: body.format } : {}),
      style: emotionToStyle(emotion),
    });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(audio));
  }),
);
