import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { resolveUser, userId, type AuthedRequest } from '../middleware/auth.js';
import { priceWatchService } from '../services/price-watch.service.js';

export const watchRouter = Router();

watchRouter.use('/:userId', resolveUser);

/** GET /api/watch/:userId — list watches with current prices + drop flags. */
watchRouter.get('/:userId', asyncHandler(async (req: AuthedRequest, res) => {
  res.json({ items: await priceWatchService.listWithPrices(userId(req)) });
}));

const AddBody = z.object({
  origin: z.string().length(3),
  destination: z.string().length(3),
  departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currency: z.string().length(3).optional(),
});

/** POST /api/watch/:userId — follow a route's price. */
watchRouter.post('/:userId', validate(AddBody, 'body'), asyncHandler(async (req: AuthedRequest, res) => {
  const b = valid<z.infer<typeof AddBody>>(req);
  res.status(201).json(await priceWatchService.add(userId(req), b));
}));

/** DELETE /api/watch/:userId/:id — stop following. */
watchRouter.delete('/:userId/:id', asyncHandler(async (req: AuthedRequest, res) => {
  await priceWatchService.remove(userId(req), req.params['id']!);
  res.json({ ok: true });
}));
