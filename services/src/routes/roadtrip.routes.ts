import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { roadtripService } from '../services/roadtrip.service.js';
import { ApiError } from '../lib/ApiError.js';

export const roadtripRouter = Router();

const PlanBody = z.object({
  origin: z.string().min(2).max(120),
  region: z.string().min(2).max(120),
  mustSee: z.array(z.string().max(80)).max(12).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  travelers: z.coerce.number().int().min(1).max(12),
  mode: z.enum(['fly-drive', 'road']),
  originIata: z.string().min(3).max(4).optional(),
});

/** POST /api/roadtrip/plan — generate a full multi-stop road-trip roadbook. */
roadtripRouter.post('/plan', validate(PlanBody, 'body'), asyncHandler(async (req, res) => {
  const b = valid<z.infer<typeof PlanBody>>(req);
  const plan = await roadtripService.plan(b);
  if (!plan) throw ApiError.serviceUnavailable('Webbina n\'a pas pu générer ce carnet de route. Réessayez.');
  res.json(plan);
}));

/** POST /api/roadtrip/options — several complete itineraries to COMPARE before booking. */
roadtripRouter.post('/options', validate(PlanBody, 'body'), asyncHandler(async (req, res) => {
  const b = valid<z.infer<typeof PlanBody>>(req);
  const options = await roadtripService.options(b);
  if (!options.length) throw ApiError.serviceUnavailable('Webbina n\'a pas pu générer d\'itinéraires. Réessayez.');
  res.json({ options });
}));
