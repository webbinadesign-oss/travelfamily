import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { dealsService } from '../services/deals.service.js';

export const dealsRouter = Router();

const DealsQuery = z.object({
  origin: z.string().length(3).optional(),
  limit: z.coerce.number().int().min(1).max(8).optional(),
});

/** GET /api/deals — "Bon plan du jour": cheapest real fares to curated
 *  family destinations, scored against a typical reference price. */
dealsRouter.get(
  '/',
  validate(DealsQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = valid<{ origin?: string; limit?: number }>(req);
    const deals = await dealsService.dealOfTheDay((q.origin || 'CDG').toUpperCase(), q.limit ?? 6);
    res.json({ items: deals, total: deals.length, origin: (q.origin || 'CDG').toUpperCase() });
  }),
);
