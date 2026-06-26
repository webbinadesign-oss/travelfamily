/**
 * Auth middleware for memory routes.
 *
 * resolveUser: if a valid "Authorization: Bearer <token>" is present, the
 * authenticated user's id (from Supabase) takes precedence over any :userId in
 * the URL — so a client can never read/write someone else's memory by guessing
 * an id. If NO token is present we fall back to the path :userId (kept so the
 * setup/test phase keeps working). Once every client logs in, switch to
 * requireUser to reject anonymous calls.
 */
import type { Request, Response, NextFunction } from 'express';
import { getUserFromToken } from '../services/auth.service.js';
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

export async function resolveUser(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  const token = bearer(req);
  if (token) {
    const user = await getUserFromToken(token);
    if (user) {
      req.userId = user.id;
      if (user.email) req.userEmail = user.email;
      return next();
    }
  }
  // Fallback: trust the path param (transition phase only).
  const pathId = req.params['userId'];
  if (pathId) req.userId = pathId;
  next();
}

/** Strict variant: requires a valid token. */
export async function requireUser(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  const token = bearer(req);
  const user = token ? await getUserFromToken(token) : null;
  if (!user) return next(ApiError.unauthorized('Connexion requise.'));
  req.userId = user.id;
  if (user.email) req.userEmail = user.email;
  next();
}

/** Reads the resolved user id (throws if absent). */
export function userId(req: AuthedRequest): string {
  if (!req.userId) throw ApiError.unauthorized('Utilisateur non identifié.');
  return req.userId;
}

/** Is this e-mail allowed into the Espace Gérante? (allowlist via ADMIN_EMAILS) */
export function isAdminEmail(email?: string): boolean {
  if (!email) return false;
  return env.adminEmails.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

/** Strict admin gate: requires a valid token AND an allow-listed e-mail. */
export async function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  const token = bearer(req);
  const user = token ? await getUserFromToken(token) : null;
  if (!user || !isAdminEmail(user.email)) {
    return next(ApiError.unauthorized('Accès réservé à la gérante.'));
  }
  req.userId = user.id;
  req.userEmail = user.email;
  next();
}
