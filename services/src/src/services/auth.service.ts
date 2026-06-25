/**
 * Supabase Auth — verify a user's access token (JWT) server-side.
 * We validate by asking Supabase "who is this token?" via GET /auth/v1/user.
 * This needs no JWT secret and always reflects the current session state.
 */
import { env } from '../config/env.js';
import { httpRequest } from '../lib/httpClient.js';

export interface AuthUser {
  id: string;
  email?: string;
}

function authBase(): string {
  const u = env.supabaseUrl.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  return `${u}/auth/v1`;
}

/** Returns the user for a bearer token, or null if invalid/expired. */
export async function getUserFromToken(token: string): Promise<AuthUser | null> {
  if (!token || !env.supabaseUrl) return null;
  const key = env.supabaseAnonKey || env.supabaseServiceRoleKey;
  try {
    const user = await httpRequest<{ id: string; email?: string }>(`${authBase()}/user`, {
      provider: 'supabase-auth',
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      retries: 0,
    });
    return user && user.id ? { id: user.id, ...(user.email ? { email: user.email } : {}) } : null;
  } catch {
    return null;
  }
}
