import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { getUserFromToken } from '../services/auth.service.js';
import { supportService } from '../services/support.service.js';

export const supportRouter = Router();

const TicketBody = z.object({
  subject: z.string().max(160).optional(),
  message: z.string().min(2).max(4000),
  email: z.string().email().optional(),
});

/** POST /api/support — open a SAV ticket (auth optional; attaches the user if a token is sent). */
supportRouter.post('/', validate(TicketBody, 'body'), asyncHandler(async (req, res) => {
  const b = valid<z.infer<typeof TicketBody>>(req);
  let userId: string | null = null;
  let email = b.email ?? null;
  const h = String(req.headers['authorization'] || '');
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (token) {
    const user = await getUserFromToken(token);
    if (user) { userId = user.id; email = email || user.email || null; }
  }
  const r = await supportService.create({ userId, email, ...(b.subject ? { subject: b.subject } : {}), message: b.message });
  res.status(201).json({ ok: true, id: r.id });
}));
