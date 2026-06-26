import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveUser, userId, type AuthedRequest } from '../middleware/auth.js';
import { loyaltyService, type Plan } from '../services/loyalty.service.js';

export const loyaltyRouter = Router();

/** Auth like memory: a valid token wins; otherwise fall back to :userId. */
loyaltyRouter.use('/:userId', resolveUser);

function plan(req: AuthedRequest): Plan {
  return (String(req.query['plan'] || 'free') === 'premium') ? 'premium' : 'free';
}

/** GET /api/loyalty/:userId — full loyalty state (tier, cagnotte, perks, next). */
loyaltyRouter.get('/:userId', asyncHandler(async (req: AuthedRequest, res) => {
  res.json(await loyaltyService.compute(userId(req), plan(req)));
}));

/** GET /api/loyalty/:userId/commission — commission multiplier for this user. */
loyaltyRouter.get('/:userId/commission', asyncHandler(async (req: AuthedRequest, res) => {
  const multiplier = await loyaltyService.commissionMultiplier(userId(req), plan(req));
  res.json({ multiplier });
}));
