import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { openaiService } from '../services/openai.service.js';
import type { ChatRequest } from '../types/index.js';

export const chatRouter = Router();

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

    if (body.stream) {
      // Server-Sent Events stream of text tokens for dynamic display.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      try {
        for await (const token of openaiService.streamChat(body.messages, body.context)) {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
      } catch (err) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`);
      } finally {
        res.end();
      }
      return;
    }

    const reply = await openaiService.chat(body.messages, body.context);
    res.json(reply);
  }),
);
