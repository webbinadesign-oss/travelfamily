import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { quote, commissionPolicy, type FeeCategory } from '../services/pricing.service.js';
import { stripeService } from '../services/stripe.service.js';
import { mailService } from '../services/mail.service.js';
import { getUserFromToken } from '../services/auth.service.js';
import { isAdminEmail } from '../middleware/auth.js';
import { env } from '../config/env.js';

export const bookingRouter = Router();

/** Fee multiplier for the caller: 0 (net) for the gérante, 1 otherwise. */
async function feeMultiplierFor(req: { headers: Record<string, unknown> }): Promise<number> {
  try {
    const h = String(req.headers['authorization'] || '');
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!token) return 1;
    const user = await getUserFromToken(token);
    return user && isAdminEmail(user.email) ? 0 : 1;
  } catch { return 1; }
}

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
    const mult = await feeMultiplierFor(req);
    res.json(quote(b.category, b.base, b.pax ?? 1, b.currency, mult));
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
    const mult = await feeMultiplierFor(req);
    const breakdown = quote(b.category, b.base, b.pax ?? 1, undefined, mult);
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

const ConfirmBody = z.object({
  email: z.string().email(),
  destination: z.string().max(120),
  ref: z.string().max(40),
  total: z.coerce.number().min(0),
  pax: z.coerce.number().int().min(1).max(12).optional(),
});

/** POST /api/booking/confirm — send a confirmation e-mail (no-op if mail not configured). */
bookingRouter.post('/confirm', validate(ConfirmBody, 'body'), asyncHandler(async (req, res) => {
  const b = valid<z.infer<typeof ConfirmBody>>(req);
  const sent = await mailService.sendBookingConfirmation(b.email, {
    destination: b.destination, ref: b.ref, total: b.total, pax: b.pax ?? 1,
  });
  res.json({ ok: true, emailSent: sent });
}));
