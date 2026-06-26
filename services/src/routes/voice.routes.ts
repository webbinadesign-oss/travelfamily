import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { elevenLabsService, emotionToStyle } from '../services/elevenlabs.service.js';
import { googleTtsService } from '../services/googletts.service.js';
import { sttService } from '../services/stt.service.js';
import { googleSttService, googleSttSupports } from '../services/googlestt.service.js';
import express from 'express';
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

    // 1) Google Cloud TTS FIRST — free, consistent, natural Chirp3-HD voice.
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

    // 2) Fallback: ElevenLabs premium voice (consumes credits).
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

/** POST /api/voice/stt — transcribe recorded audio to text (works on iPhone too).
 * Body = raw audio bytes; Content-Type carries the mime (audio/mp4, audio/webm…). */
voiceRouter.post(
  '/stt',
  express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '20mb' }),
  asyncHandler(async (req, res) => {
    const buf = req.body as Buffer;
    if (!buf || !buf.length) { res.status(400).json({ error: { status: 400, code: 'empty_audio', message: 'No audio received.' } }); return; }
    const mime = (req.headers['content-type'] as string) || 'audio/mp4';

    // 1) Google STT FIRST when the format is opus (webm/ogg) — FREE. Covers Android + desktop.
    if (env.googleApiKey && googleSttSupports(mime)) {
      try {
        const text = await googleSttService.transcribe(buf, mime);
        res.json({ text, provider: 'google' });
        return;
      } catch (e) {
        logger.warn('Google STT failed, falling back to Whisper', { err: String(e) });
      }
    }

    // 2) Fallback: Whisper — reads everything, incl. iPhone's mp4/aac.
    //    Only if OpenAI is configured; otherwise stay 100% off OpenAI.
    if (env.openaiApiKey) {
      const text = await sttService.transcribe(buf, mime);
      res.json({ text, provider: 'whisper' });
      return;
    }
    res.json({ text: '', provider: 'none', note: 'format non pris en charge sans OpenAI' });
  }),
);
