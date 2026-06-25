import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { resolveUser, userId, type AuthedRequest } from '../middleware/auth.js';
import { memoryService } from '../services/memory.service.js';

export const memoryRouter = Router();

/**
 * AUTH: every route runs `resolveUser` first. If a valid Supabase token is sent
 * (Authorization: Bearer <access_token>), the authenticated user id wins and a
 * client can never touch another user's memory. Without a token we fall back to
 * the :userId in the path (transition/testing phase).
 */
memoryRouter.use('/:userId', resolveUser);

/** Ensure a users row exists (with email from the token when available). */
async function ensure(req: AuthedRequest): Promise<string> {
  const id = userId(req);
  await memoryService.ensureUser(id, req.userEmail);
  return id;
}

/** GET /api/memory/:userId/context — everything Webbina needs to greet + recall. */
memoryRouter.get('/:userId/context', asyncHandler(async (req, res) => {
  res.json(await memoryService.getContext(userId(req)));
}));

/** GET /api/memory/:userId/greeting — just the spoken greeting + summary. */
memoryRouter.get('/:userId/greeting', asyncHandler(async (req, res) => {
  const ctx = await memoryService.getContext(userId(req));
  res.json({ greeting: ctx.greeting, summary: ctx.summary, returning: ctx.returning });
}));

/* ── Profile ──────────────────────────────────────────────── */
const ProfileBody = z.object({
  homeAirport: z.string().optional(),
  homeCity: z.string().optional(),
  preferredCabin: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']).optional(),
  preferredAirlines: z.array(z.string()).optional(),
  typicalBudget: z.number().optional(),
  budgetCurrency: z.string().optional(),
  pace: z.enum(['relaxed', 'balanced', 'intense']).optional(),
});
memoryRouter.get('/:userId/profile', asyncHandler(async (req, res) => {
  res.json(await memoryService.getProfile(userId(req)));
}));
memoryRouter.put('/:userId/profile', validate(ProfileBody, 'body'), asyncHandler(async (req, res) => {
  const id = await ensure(req);
  res.json(await memoryService.upsertProfile(id, valid(req)));
}));

/* ── Preferences ──────────────────────────────────────────── */
const PrefsBody = z.object({
  interests: z.array(z.string()).optional(),
  climates: z.array(z.string()).optional(),
  avoid: z.array(z.string()).optional(),
  travelsWithChildren: z.boolean().optional(),
  accessibility: z.array(z.string()).optional(),
  dietary: z.array(z.string()).optional(),
});
memoryRouter.get('/:userId/preferences', asyncHandler(async (req, res) => {
  res.json(await memoryService.getPreferences(userId(req)));
}));
memoryRouter.put('/:userId/preferences', validate(PrefsBody, 'body'), asyncHandler(async (req, res) => {
  const id = await ensure(req);
  res.json(await memoryService.upsertPreferences(id, valid(req)));
}));

/* ── Travelers ────────────────────────────────────────────── */
const TravelerBody = z.object({
  fullName: z.string().min(1),
  relation: z.string().optional(),
  birthdate: z.string().optional(),
  isDefault: z.boolean().optional(),
  notes: z.string().optional(),
});
memoryRouter.get('/:userId/travelers', asyncHandler(async (req, res) => {
  res.json({ items: await memoryService.getTravelers(userId(req)) });
}));
memoryRouter.post('/:userId/travelers', validate(TravelerBody, 'body'), asyncHandler(async (req, res) => {
  const id = await ensure(req);
  res.status(201).json(await memoryService.addTraveler(id, valid(req)));
}));

/* ── Passports ────────────────────────────────────────────── */
const PassportBody = z.object({
  holderName: z.string().min(1),
  nationality: z.string().length(2),
  travelerId: z.string().uuid().optional(),
  numberLast4: z.string().max(4).optional(),
  issuedOn: z.string().optional(),
  expiresOn: z.string(),
});
memoryRouter.get('/:userId/passports', asyncHandler(async (req, res) => {
  res.json({ items: await memoryService.getPassports(userId(req)) });
}));
memoryRouter.post('/:userId/passports', validate(PassportBody, 'body'), asyncHandler(async (req, res) => {
  const id = await ensure(req);
  res.status(201).json(await memoryService.addPassport(id, valid(req)));
}));

/* ── Saved trips ──────────────────────────────────────────── */
const TripBody = z.object({
  title: z.string().min(1),
  destination: z.string().optional(),
  country: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['idea', 'quote', 'booked', 'completed', 'cancelled']).optional(),
  budget: z.object({ amount: z.number(), currency: z.string() }).optional(),
  travelersCount: z.number().int().optional(),
  summary: z.string().optional(),
  coverUrl: z.string().optional(),
});
memoryRouter.get('/:userId/trips', asyncHandler(async (req, res) => {
  res.json({ items: await memoryService.getTrips(userId(req)) });
}));
memoryRouter.post('/:userId/trips', validate(TripBody, 'body'), asyncHandler(async (req, res) => {
  const id = await ensure(req);
  res.status(201).json(await memoryService.saveTrip(id, valid(req)));
}));

/* ── Conversation memory + summary ────────────────────────── */
const ConvBody = z.object({
  entries: z.array(z.object({
    sessionId: z.string().optional(),
    kind: z.enum(['message', 'fact', 'summary']).optional(),
    role: z.enum(['user', 'assistant', 'system']).optional(),
    content: z.string().min(1),
    emotion: z.string().optional(),
    importance: z.number().int().min(0).max(5).optional(),
  })).min(1),
});
memoryRouter.post('/:userId/conversation', validate(ConvBody, 'body'), asyncHandler(async (req, res) => {
  const id = await ensure(req);
  const { entries } = valid<{ entries: Array<Record<string, unknown>> }>(req);
  await memoryService.recordConversation(entries.map((e) => ({ ...e, userId: id })) as never);
  res.status(201).json({ ok: true, stored: entries.length });
}));

/** POST /api/memory/:userId/summarize — regenerate the preference summary. */
memoryRouter.post('/:userId/summarize', asyncHandler(async (req, res) => {
  const summary = await memoryService.summarize(userId(req));
  res.json({ summary });
}));
