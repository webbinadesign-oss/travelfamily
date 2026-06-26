/**
 * Admin service — powers the Espace Gérante.
 * Every sensitive action runs through here (service-role Supabase) and is
 * journaled in admin_audit for traceability (RGPD). The browser never holds
 * the service key; it only calls the admin endpoints with the gérante's token.
 */
import { supabase } from './supabase.service.js';
import { memoryService } from './memory.service.js';
import { loyaltyService, type Plan } from './loyalty.service.js';

interface UserRow {
  id: string; email: string; active?: boolean; premium_until?: string | null;
  notes?: string | null; created_at?: string;
}

function premiumActive(row: UserRow): boolean {
  return Boolean(row.premium_until && new Date(row.premium_until).getTime() > Date.now());
}

export const adminService = {
  /** Journal an admin action (best-effort; never blocks the response). */
  async audit(adminEmail: string, action: string, targetUser?: string, detail?: unknown): Promise<void> {
    try {
      await supabase.upsert('admin_audit', {
        admin_email: adminEmail, action, target_user: targetUser ?? null, detail: detail ?? null,
      });
    } catch { /* non-blocking */ }
  },

  /** Dashboard KPIs. */
  async stats(): Promise<Record<string, number>> {
    const [users, trips, tickets] = await Promise.all([
      supabase.select<UserRow>('users', { limit: 1000 }),
      supabase.select<{ status: string; budget_amount: number | null }>('saved_trips', { limit: 5000 }),
      supabase.select<{ status: string }>('support_tickets', { limit: 1000 }),
    ]);
    const booked = trips.filter((t) => t.status === 'booked' || t.status === 'completed');
    const gmv = booked.reduce((s, t) => s + (Number(t.budget_amount) || 0), 0);
    return {
      users: users.length,
      premium: users.filter((u) => premiumActive(u)).length,
      suspended: users.filter((u) => u.active === false).length,
      bookings: booked.length,
      gmv: Math.round(gmv),
      openTickets: tickets.filter((t) => t.status !== 'closed').length,
    };
  },

  /** Search / list clients (lightweight). */
  async listUsers(search = ''): Promise<Array<Record<string, unknown>>> {
    const rows = await supabase.select<UserRow>('users', { order: 'created_at.desc', limit: 500 });
    const q = search.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => (r.email || '').toLowerCase().includes(q)) : rows;
    return filtered.map((r) => ({
      id: r.id, email: r.email, active: r.active !== false,
      premium: premiumActive(r), premiumUntil: r.premium_until ?? null, createdAt: r.created_at,
    }));
  },

  /** Full client file: profile, trips, loyalty, passports (masked), tickets, grants. */
  async getUser(id: string): Promise<Record<string, unknown>> {
    const [row] = await supabase.select<UserRow>('users', { match: { id }, limit: 1 });
    if (!row) throw new Error('Utilisateur introuvable.');
    const plan: Plan = premiumActive(row) ? 'premium' : 'free';
    const [ctx, loyalty, adjustments, tickets] = await Promise.all([
      memoryService.getContext(id),
      loyaltyService.compute(id, plan),
      supabase.select('loyalty_adjustments', { match: { user_id: id }, order: 'created_at.desc', limit: 100 }),
      supabase.select('support_tickets', { match: { user_id: id }, order: 'created_at.desc', limit: 100 }),
    ]);
    // Mask passports: never expose full numbers in the back-office.
    const passports = (ctx.passports || []).map((p: Record<string, unknown>) => ({
      country: p['country'], expiresAt: p['expiresAt'], holder: p['holder'] ?? p['fullName'],
    }));
    return {
      id: row.id, email: row.email, active: row.active !== false,
      premium: plan === 'premium', premiumUntil: row.premium_until ?? null, notes: row.notes ?? '',
      profile: ctx.profile ?? null, travelers: ctx.travelers ?? [], recentTrips: ctx.recentTrips ?? [],
      summary: ctx.summary, passports, loyalty, adjustments, tickets,
    };
  },

  /** Grant / extend a Premium pass (months). */
  async grantPremium(adminEmail: string, id: string, months: number): Promise<void> {
    const until = new Date();
    until.setMonth(until.getMonth() + Math.max(1, months));
    await supabase.update('users', { id }, { premium_until: until.toISOString() });
    await supabase.upsert('loyalty_adjustments', {
      user_id: id, kind: 'premium', amount_eur: 0, reason: `Pass Premium ${months} mois`, created_by: adminEmail,
    });
    await this.audit(adminEmail, 'grant_premium', id, { months, until: until.toISOString() });
  },

  /** Credit travel-wallet (cagnotte) manually. */
  async creditCagnotte(adminEmail: string, id: string, amount: number, reason: string): Promise<void> {
    await supabase.upsert('loyalty_adjustments', {
      user_id: id, kind: 'credit', amount_eur: Math.round(amount * 100) / 100, reason: reason || 'Geste commercial', created_by: adminEmail,
    });
    await this.audit(adminEmail, 'credit_cagnotte', id, { amount, reason });
  },

  /** Enable / suspend an account (revoke access). */
  async setActive(adminEmail: string, id: string, active: boolean): Promise<void> {
    await supabase.update('users', { id }, { active });
    await this.audit(adminEmail, 'set_active', id, { active });
  },

  /** Free-text private note on a client. */
  async setNotes(adminEmail: string, id: string, notes: string): Promise<void> {
    await supabase.update('users', { id }, { notes });
    await this.audit(adminEmail, 'set_notes', id);
  },

  /* ── SAV ─────────────────────────────────────────────────────────────── */
  async listTickets(status = ''): Promise<Array<Record<string, unknown>>> {
    const opts: Record<string, unknown> = { order: 'created_at.desc', limit: 300 };
    if (status) opts['match'] = { status };
    return supabase.select('support_tickets', opts);
  },
  async replyTicket(adminEmail: string, id: string, reply: string, status = 'closed'): Promise<void> {
    await supabase.update('support_tickets', { id }, { reply, status, updated_at: new Date().toISOString() });
    await this.audit(adminEmail, 'reply_ticket', undefined, { ticket: id, status });
  },

  /** Recent audit trail (for the gérante's own oversight). */
  async auditLog(limit = 100): Promise<Array<Record<string, unknown>>> {
    return supabase.select('admin_audit', { order: 'created_at.desc', limit });
  },
};
