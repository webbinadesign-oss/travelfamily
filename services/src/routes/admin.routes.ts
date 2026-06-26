import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { requireAdmin, type AuthedRequest } from '../middleware/auth.js';
import { adminService } from '../services/admin.service.js';

export const adminRouter = Router();

/** Every admin route requires an allow-listed gérante token. */
adminRouter.use(requireAdmin);

const who = (req: AuthedRequest) => req.userEmail || 'admin';

/** GET /api/admin/me — confirm admin access (used by the login screen). */
adminRouter.get('/me', (req: AuthedRequest, res) => res.json({ ok: true, email: who(req) }));

/** GET /api/admin/stats — dashboard KPIs. */
adminRouter.get('/stats', asyncHandler(async (_req, res) => res.json(await adminService.stats())));

/** GET /api/admin/users?search= — list / search clients. */
adminRouter.get('/users', asyncHandler(async (req, res) => {
  res.json({ items: await adminService.listUsers(String(req.query['search'] || '')) });
}));

/** GET /api/admin/users/:id — full client file (logs a view in the audit). */
adminRouter.get('/users/:id', asyncHandler(async (req: AuthedRequest, res) => {
  const id = req.params['id']!;
  const data = await adminService.getUser(id);
  await adminService.audit(who(req), 'view_user', id);
  res.json(data);
}));

/** POST /api/admin/users/:id/premium { months } — grant / extend a Premium pass. */
const PremiumBody = z.object({ months: z.number().int().min(1).max(120) });
adminRouter.post('/users/:id/premium', validate(PremiumBody), asyncHandler(async (req: AuthedRequest, res) => {
  const { months } = valid<z.infer<typeof PremiumBody>>(req);
  await adminService.grantPremium(who(req), req.params['id']!, months);
  res.json({ ok: true });
}));

/** POST /api/admin/users/:id/cagnotte { amount, reason } — credit the travel wallet. */
const CreditBody = z.object({ amount: z.number().min(-500).max(500), reason: z.string().max(200).optional() });
adminRouter.post('/users/:id/cagnotte', validate(CreditBody), asyncHandler(async (req: AuthedRequest, res) => {
  const { amount, reason } = valid<z.infer<typeof CreditBody>>(req);
  await adminService.creditCagnotte(who(req), req.params['id']!, amount, reason || '');
  res.json({ ok: true });
}));

/** POST /api/admin/users/:id/active { active } — enable / suspend the account. */
const ActiveBody = z.object({ active: z.boolean() });
adminRouter.post('/users/:id/active', validate(ActiveBody), asyncHandler(async (req: AuthedRequest, res) => {
  const { active } = valid<z.infer<typeof ActiveBody>>(req);
  await adminService.setActive(who(req), req.params['id']!, active);
  res.json({ ok: true });
}));

/** POST /api/admin/users/:id/notes { notes } — private note. */
const NotesBody = z.object({ notes: z.string().max(2000) });
adminRouter.post('/users/:id/notes', validate(NotesBody), asyncHandler(async (req: AuthedRequest, res) => {
  const { notes } = valid<z.infer<typeof NotesBody>>(req);
  await adminService.setNotes(who(req), req.params['id']!, notes);
  res.json({ ok: true });
}));

/** GET /api/admin/tickets?status= — SAV queue. */
adminRouter.get('/tickets', asyncHandler(async (req, res) => {
  res.json({ items: await adminService.listTickets(String(req.query['status'] || '')) });
}));

/** POST /api/admin/tickets/:id/reply { reply, status } — answer a ticket. */
const ReplyBody = z.object({ reply: z.string().min(1).max(4000), status: z.enum(['open', 'pending', 'closed']).optional() });
adminRouter.post('/tickets/:id/reply', validate(ReplyBody), asyncHandler(async (req: AuthedRequest, res) => {
  const { reply, status } = valid<z.infer<typeof ReplyBody>>(req);
  await adminService.replyTicket(who(req), req.params['id']!, reply, status || 'closed');
  res.json({ ok: true });
}));

/** GET /api/admin/audit — recent action log. */
adminRouter.get('/audit', asyncHandler(async (_req, res) => res.json({ items: await adminService.auditLog(150) })));
