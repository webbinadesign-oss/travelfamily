import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { formalitiesService } from '../services/formalities.service.js';

export const formalitiesRouter = Router();

const Query = z.object({
  nationality: z.string().min(2).max(60),
  destination: z.string().min(2).max(80),
  residence: z.string().max(60).optional(),
});

/** GET /api/formalities?nationality=&destination=&residence= — real, dynamic (Gemini). */
formalitiesRouter.get('/', validate(Query, 'query'), asyncHandler(async (req, res) => {
  const q = valid<z.infer<typeof Query>>(req);
  res.json(await formalitiesService.forTrip(q));
}));
