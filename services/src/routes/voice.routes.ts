import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { elevenLabsService, emotionToStyle } from '../services/elevenlabs.service.js';
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

/** POST /api/voice/tts — synthesize Webbina speaking; returns audio bytes. */
voiceRouter.post(
  '/tts',
  validate(TtsBody, 'body'),
  asyncHandler(async (req, res) => {
    const body = valid<{ text: string; voiceId?: string; emotion?: WebbinaEmotion; format?: 'mp3_44100_128' | 'pcm_16000' }>(req);
    const { audio, contentType } = await elevenLabsService.tts({
      text: body.text,
      ...(body.voiceId ? { voiceId: body.voiceId } : {}),
      ...(body.format ? { format: body.format } : {}),
      style: emotionToStyle(body.emotion ?? 'happy'),
    });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(audio));
  }),
);
