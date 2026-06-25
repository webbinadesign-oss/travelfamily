import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { travelpayoutsService } from '../services/travelpayouts.service.js';

export const travelpayoutsRouter = Router();

const RouteQuery = z.object({
  origin: z.string().length(3),
  destination: z.string().length(3),
  departureDate: z.string().regex(/^\d{4}(-\d{2}){0,2}$/).optional(),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  oneWay: z.coerce.boolean().optional(),
  currency: z.string().length(3).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

/** GET /api/tp/prices — real cached fares for a route (cheapest first). */
travelpayoutsRouter.get(
  '/prices',
  validate(RouteQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = valid<z.infer<typeof RouteQuery>>(req);
    const fares = await travelpayoutsService.cheapestForRoute(q);
    res.json({ fares });
  }),
);

const DatesQuery = z.object({
  origin: z.string().length(3),
  destination: z.string().length(3),
  currency: z.string().length(3).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

/** GET /api/tp/best-dates — cheapest upcoming DATES for a route
 *  (the "Voyages Pirates" effect). */
travelpayoutsRouter.get(
  '/best-dates',
  validate(DatesQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = valid<z.infer<typeof DatesQuery>>(req);
    const dates = await travelpayoutsService.bestDates(q);
    res.json({ dates });
  }),
);
