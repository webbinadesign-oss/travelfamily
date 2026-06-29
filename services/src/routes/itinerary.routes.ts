import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { itineraryService } from '../services/itinerary.service.js';

export const itineraryRouter = Router();

const HubQuery = z.object({
  origin: z.string().min(2).max(160),
  hub: z.string().min(2).max(160),
  family: z.coerce.boolean().optional(),
  budget: z.coerce.boolean().optional(),
  pax: z.coerce.number().int().min(1).max(9).optional(),
});

/** GET /api/itinerary/to-hub — door-to-door options to reach the first transport. */
itineraryRouter.get('/to-hub', validate(HubQuery, 'query'), asyncHandler(async (req, res) => {
  const q = valid<z.infer<typeof HubQuery>>(req);
  res.json(await itineraryService.toHub({
    origin: q.origin, hub: q.hub,
    profile: { ...(q.family != null ? { family: q.family } : {}), ...(q.budget != null ? { budget: q.budget } : {}), ...(q.pax != null ? { pax: q.pax } : {}) },
  }));
}));

const FromQuery = z.object({
  hub: z.string().min(2).max(160),
  destination: z.string().min(2).max(160),
  family: z.coerce.boolean().optional(),
  budget: z.coerce.boolean().optional(),
  pax: z.coerce.number().int().min(1).max(9).optional(),
});

/** GET /api/itinerary/from-hub — last-mile options (arrival hub → hotel/destination). */
itineraryRouter.get('/from-hub', validate(FromQuery, 'query'), asyncHandler(async (req, res) => {
  const q = valid<z.infer<typeof FromQuery>>(req);
  res.json(await itineraryService.fromHub({
    hub: q.hub, destination: q.destination,
    profile: { ...(q.family != null ? { family: q.family } : {}), ...(q.budget != null ? { budget: q.budget } : {}), ...(q.pax != null ? { pax: q.pax } : {}) },
  }));
}));

const FullQuery = z.object({
  origin: z.string().min(2).max(160),
  departHub: z.string().min(2).max(160),
  arriveHub: z.string().min(2).max(160),
  destination: z.string().min(2).max(160),
  family: z.coerce.boolean().optional(),
  budget: z.coerce.boolean().optional(),
  pax: z.coerce.number().int().min(1).max(9).optional(),
});

/** GET /api/itinerary/full — full door-to-door (origin→departHub … arriveHub→destination). */
itineraryRouter.get('/full', validate(FullQuery, 'query'), asyncHandler(async (req, res) => {
  const q = valid<z.infer<typeof FullQuery>>(req);
  res.json(await itineraryService.full({
    origin: q.origin, departHub: q.departHub, arriveHub: q.arriveHub, destination: q.destination,
    profile: { ...(q.family != null ? { family: q.family } : {}), ...(q.budget != null ? { budget: q.budget } : {}), ...(q.pax != null ? { pax: q.pax } : {}) },
  }));
}));
