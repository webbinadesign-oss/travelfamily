import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { checkCoherence, type CoherenceInput } from '../services/coherence.service.js';

export const coherenceRouter = Router();

const Leg = z.object({
  mode: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  departure: z.string().min(10),
  arrival: z.string().min(10),
  label: z.string().optional(),
});

const Body = z.object({
  legs: z.array(Leg).max(12),
  hotel: z
    .object({
      name: z.string().optional(),
      checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
  hasYoungChildren: z.boolean().optional(),
  minConnectionMinutes: z.number().int().min(0).max(720).optional(),
});

/** POST /api/coherence — validate a trip's timing (J+1, connections, hotel nights). */
coherenceRouter.post(
  '/',
  validate(Body, 'body'),
  asyncHandler(async (req, res) => {
    const input = valid<CoherenceInput>(req);
    res.json(checkCoherence(input));
  }),
);
