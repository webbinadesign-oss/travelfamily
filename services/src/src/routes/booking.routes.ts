import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { quote, commissionPolicy, type FeeCategory } from '../services/pricing.service.js';
import { stripeService } from '../services/stripe.service.js';
import { env } from '../config/env.js';

export const bookingRouter = Router();

const QuoteBody = z.object({
  category: z.enum(['flight', 'hotel', 'activity', 'package']),
  base: z.coerce.number().min(0),
  pax: z.coerce.number().int().min(1).max(12).optional(),
  currency: z.string().length(3).optional(),
});

/** POST /api/booking/quote — transparent price breakdown (base + Webbina fee). */
bookingRouter.post(
  '/quote',
  validate(QuoteBody, 'body'),
  asyncHandler(async (req, res) => {
    const b = valid<{ category: FeeCategory; base: number; pax?: number; currency?: string }>(req);
    res.json(quote(b.category, b.base, b.pax ?? 1, b.currency));
  }),
);

/** GET /api/booking/policy — public commission policy (for the transparency UI). */
bookingRouter.get(
  '/policy',
  asyncHandler(async (_req, res) => {
    res.json(commissionPolicy());
  }),
);

const IntentBody = z.object({
  category: z.enum(['flight', 'hotel', 'activity', 'package']),
  base: z.coerce.number().min(0),
  pax: z.coerce.number().int().min(1).max(12).optional(),
  label: z.string().max(120).optional(),
});

/** POST /api/booking/intent — compute total (incl. fee) SERVER-SIDE, then create
 *  a Stripe PaymentIntent. The amount is never trusted from the client. */
bookingRouter.post(
  '/intent',
  validate(IntentBody, 'body'),
  asyncHandler(async (req, res) => {
    const b = valid<{ category: FeeCategory; base: number; pax?: number; label?: string }>(req);
    const breakdown = quote(b.category, b.base, b.pax ?? 1);
    const amountMinor = Math.round(breakdown.total * 100); // euros → cents
    const intent = await stripeService.createPaymentIntent(amountMinor, breakdown.currency, {
      category: b.category,
      label: b.label ?? b.category,
      base: String(breakdown.base),
      fee: String(breakdown.fee),
    });
    res.json({
      clientSecret: intent.clientSecret,
      publishableKey: env.stripePublishableKey,
      breakdown,
    });
  }),
);
