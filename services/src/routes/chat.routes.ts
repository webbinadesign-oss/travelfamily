import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { openaiService } from '../services/openai.service.js';
import { geminiService } from '../services/gemini.service.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { ChatRequest } from '../types/index.js';

export const chatRouter = Router();

/** Brain order: Gemini (free) → OpenAI (paid fallback). */
function brains() {
  const list = [] as Array<{ name: string; svc: typeof geminiService | typeof openaiService }>;
  if (env.geminiApiKey) list.push({ name: 'gemini', svc: geminiService });
  if (env.openaiApiKey) list.push({ name: 'openai', svc: openaiService });
  return list;
}

const Message = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const ChatBody = z.object({
  messages: z.array(Message).min(1).max(40),
  context: z
    .object({
      origin: z.string().optional(),
      destination: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      adults: z.number().int().optional(),
      children: z.number().int().optional(),
      childrenAges: z.array(z.number().int()).optional(),
      budget: z.object({ amount: z.number(), currency: z.string() }).optional(),
      interests: z.array(z.string()).optional(),
    })
    .optional(),
  stream: z.boolean().optional(),
});

/** POST /api/chat — Webbina's structured reply (reply + emotion + suggestions). */
chatRouter.post(
  '/',
  validate(ChatBody, 'body'),
  asyncHandler(async (req, res) => {
    const body = valid<ChatRequest>(req);
    const available = brains();
    if (available.length === 0) {
      res.status(503).json({ error: { status: 503, code: 'no_brain_configured', message: 'Aucun cerveau IA configuré (définissez GEMINI_API_KEY ou OPENAI_API_KEY).' } });
      return;
    }

    if (body.stream) {
      // Server-Sent Events stream of text tokens for dynamic display.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      // Try each brain in order until one starts streaming successfully.
      let streamed = false;
      for (const b of available) {
        if (streamed) break;
        try {
          for await (const token of b.svc.streamChat(body.messages, body.context)) {
            streamed = true;
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
          // finished cleanly
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        } catch (err) {
          logger.warn(`Brain "${b.name}" stream failed`, { err: String(err) });
          // try next brain only if nothing was sent yet
          if (streamed) break;
        }
      }
      if (!streamed) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Tous les cerveaux IA sont indisponibles.' })}\n\n`);
      } else {
        res.write('data: [DONE]\n\n');
      }
      res.end();
      return;
    }

    // Non-streaming: try each brain until one answers.
    let lastErr: unknown;
    for (const b of available) {
      try {
        const reply = await b.svc.chat(body.messages, body.context);
        res.json(reply);
        return;
      } catch (err) {
        lastErr = err;
        logger.warn(`Brain "${b.name}" chat failed, trying next`, { err: String(err) });
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('All brains failed');
  }),
);
