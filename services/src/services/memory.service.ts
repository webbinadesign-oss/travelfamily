/**
 * Webbina Memory service.
 * - Reads/writes the user's travel memory (profile, travelers, passports,
 *   preferences, trips, conversation).
 * - Auto-summarises preferences (OpenAI, with a deterministic fallback).
 * - Builds the context + a ready-to-speak greeting for a returning user, e.g.
 *   "Bonjour, vous voyagez habituellement en classe Premium au départ de
 *    Marseille. Souhaitez-vous que je recherche des options similaires ?"
 */
import { supabase } from './supabase.service.js';
import { openaiService } from './openai.service.js';
import { logger } from '../lib/logger.js';
import type {
  TravelProfile,
  Traveler,
  Passport,
  TripPreferences,
  SavedTrip,
  ConversationEntry,
  MemoryContext,
  CabinClass,
} from '../types/memory.js';

const CABIN_FR: Record<CabinClass, string> = {
  ECONOMY: 'Économique',
  PREMIUM_ECONOMY: 'Premium',
  BUSINESS: 'Affaires',
  FIRST: 'Première',
};

/* ── Row mappers (snake_case DB → camelCase domain) ───────────────────────── */
/* eslint-disable @typescript-eslint/no-explicit-any */
const mapProfile = (r: any): TravelProfile => ({
  userId: r.user_id,
  homeAirport: r.home_airport ?? undefined,
  homeCity: r.home_city ?? undefined,
  preferredCabin: r.preferred_cabin ?? undefined,
  preferredAirlines: r.preferred_airlines ?? [],
  typicalBudget: r.typical_budget != null ? Number(r.typical_budget) : undefined,
  budgetCurrency: r.budget_currency ?? 'EUR',
  pace: r.pace ?? undefined,
  preferenceSummary: r.preference_summary ?? undefined,
  summaryUpdatedAt: r.summary_updated_at ?? undefined,
});
const mapTraveler = (r: any): Traveler => ({
  id: r.id, userId: r.user_id, fullName: r.full_name, relation: r.relation ?? undefined,
  birthdate: r.birthdate ?? undefined, isDefault: !!r.is_default, notes: r.notes ?? undefined,
});
const mapPassport = (r: any): Passport => ({
  id: r.id, userId: r.user_id, travelerId: r.traveler_id ?? undefined,
  holderName: r.holder_name, nationality: r.nationality,
  numberLast4: r.number_last4 ?? undefined, issuedOn: r.issued_on ?? undefined, expiresOn: r.expires_on,
});
const mapPrefs = (r: any): TripPreferences => ({
  userId: r.user_id, interests: r.interests ?? [], climates: r.climates ?? [],
  avoid: r.avoid ?? [], travelsWithChildren: !!r.travels_with_children,
  accessibility: r.accessibility ?? [], dietary: r.dietary ?? [],
});
const mapTrip = (r: any): SavedTrip => ({
  id: r.id, userId: r.user_id, title: r.title, destination: r.destination ?? undefined,
  country: r.country ?? undefined, startDate: r.start_date ?? undefined, endDate: r.end_date ?? undefined,
  status: r.status, budget: r.budget_amount != null ? { amount: Number(r.budget_amount), currency: r.budget_currency } : undefined,
  travelersCount: r.travelers_count ?? undefined, summary: r.summary ?? undefined,
  coverUrl: r.cover_url ?? undefined, createdAt: r.created_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export const memoryService = {
  /* ── User bootstrap ─────────────────────────────────────────────────────── */
  /** Make sure a users row exists before writing anything that references it.
      With service_role we own this; in production the id comes from the JWT. */
  async ensureUser(userId: string, email?: string): Promise<void> {
    await supabase.upsert('users', {
      id: userId,
      ...(email ? { email } : {}),
    }, 'id');
  },

  /* ── Reads ──────────────────────────────────────────────────────────────── */
  async getProfile(userId: string): Promise<TravelProfile | null> {
    const r = await supabase.selectOne<Record<string, unknown>>('travel_profiles', { match: { user_id: userId } });
    return r ? mapProfile(r) : null;
  },
  async getTravelers(userId: string): Promise<Traveler[]> {
    const r = await supabase.select<Record<string, unknown>>('travelers', { match: { user_id: userId }, order: 'is_default.desc' });
    return r.map(mapTraveler);
  },
  async getPassports(userId: string): Promise<Passport[]> {
    const r = await supabase.select<Record<string, unknown>>('passports', { match: { user_id: userId }, order: 'expires_on.asc' });
    return r.map(mapPassport);
  },
  async getPreferences(userId: string): Promise<TripPreferences | null> {
    const r = await supabase.selectOne<Record<string, unknown>>('trip_preferences', { match: { user_id: userId } });
    return r ? mapPrefs(r) : null;
  },
  async getTrips(userId: string, limit = 10): Promise<SavedTrip[]> {
    const r = await supabase.select<Record<string, unknown>>('saved_trips', { match: { user_id: userId }, order: 'created_at.desc', limit });
    return r.map(mapTrip);
  },

  /* ── Writes ─────────────────────────────────────────────────────────────── */
  async upsertProfile(userId: string, patch: Partial<TravelProfile>): Promise<TravelProfile> {
    await this.ensureUser(userId);
    const row = {
      user_id: userId,
      ...(patch.homeAirport !== undefined ? { home_airport: patch.homeAirport } : {}),
      ...(patch.homeCity !== undefined ? { home_city: patch.homeCity } : {}),
      ...(patch.preferredCabin !== undefined ? { preferred_cabin: patch.preferredCabin } : {}),
      ...(patch.preferredAirlines !== undefined ? { preferred_airlines: patch.preferredAirlines } : {}),
      ...(patch.typicalBudget !== undefined ? { typical_budget: patch.typicalBudget } : {}),
      ...(patch.budgetCurrency !== undefined ? { budget_currency: patch.budgetCurrency } : {}),
      ...(patch.pace !== undefined ? { pace: patch.pace } : {}),
    };
    const [saved] = await supabase.upsert<Record<string, unknown>>('travel_profiles', row, 'user_id');
    return mapProfile(saved);
  },
  async upsertPreferences(userId: string, patch: Partial<TripPreferences>): Promise<TripPreferences> {
    await this.ensureUser(userId);
    const row = {
      user_id: userId,
      ...(patch.interests !== undefined ? { interests: patch.interests } : {}),
      ...(patch.climates !== undefined ? { climates: patch.climates } : {}),
      ...(patch.avoid !== undefined ? { avoid: patch.avoid } : {}),
      ...(patch.travelsWithChildren !== undefined ? { travels_with_children: patch.travelsWithChildren } : {}),
      ...(patch.accessibility !== undefined ? { accessibility: patch.accessibility } : {}),
      ...(patch.dietary !== undefined ? { dietary: patch.dietary } : {}),
    };
    const [saved] = await supabase.upsert<Record<string, unknown>>('trip_preferences', row, 'user_id');
    return mapPrefs(saved);
  },
  async addTraveler(userId: string, t: Partial<Traveler>): Promise<Traveler> {
    await this.ensureUser(userId);
    const [saved] = await supabase.upsert<Record<string, unknown>>('travelers', {
      user_id: userId, full_name: t.fullName, relation: t.relation ?? null,
      birthdate: t.birthdate ?? null, is_default: t.isDefault ?? false, notes: t.notes ?? null,
    });
    return mapTraveler(saved);
  },
  async addPassport(userId: string, p: Partial<Passport> & { numberLast4?: string }): Promise<Passport> {
    await this.ensureUser(userId);
    const [saved] = await supabase.upsert<Record<string, unknown>>('passports', {
      user_id: userId, traveler_id: p.travelerId ?? null, holder_name: p.holderName,
      nationality: p.nationality, number_last4: p.numberLast4 ?? null,
      issued_on: p.issuedOn ?? null, expires_on: p.expiresOn,
    });
    return mapPassport(saved);
  },
  async saveTrip(userId: string, t: Partial<SavedTrip>): Promise<SavedTrip> {
    await this.ensureUser(userId);
    const [saved] = await supabase.upsert<Record<string, unknown>>('saved_trips', {
      user_id: userId, title: t.title, destination: t.destination ?? null, country: t.country ?? null,
      start_date: t.startDate ?? null, end_date: t.endDate ?? null, status: t.status ?? 'idea',
      budget_amount: t.budget?.amount ?? null, budget_currency: t.budget?.currency ?? 'EUR',
      travelers_count: t.travelersCount ?? null, summary: t.summary ?? null, cover_url: t.coverUrl ?? null,
    });
    return mapTrip(saved);
  },
  async recordConversation(entries: ConversationEntry[]): Promise<void> {
    if (!entries.length) return;
    await this.ensureUser(entries[0]!.userId);
    await supabase.upsert('conversation_memory', entries.map((e) => ({
      user_id: e.userId, session_id: e.sessionId ?? null, kind: e.kind ?? 'message',
      role: e.role ?? null, content: e.content, emotion: e.emotion ?? null, importance: e.importance ?? 0,
    })));
  },

  /* ── Auto-summary ───────────────────────────────────────────────────────── */
  /** Deterministic fallback summary (no LLM needed). */
  fallbackSummary(profile: TravelProfile | null, prefs: TripPreferences | null, trips: SavedTrip[]): string {
    const bits: string[] = [];
    if (profile?.preferredCabin) bits.push(`voyage habituellement en classe ${CABIN_FR[profile.preferredCabin]}`);
    if (profile?.homeCity || profile?.homeAirport) bits.push(`au départ de ${profile.homeCity ?? profile.homeAirport}`);
    if (profile?.typicalBudget) bits.push(`budget habituel d'environ ${profile.typicalBudget} ${profile.budgetCurrency}`);
    if (prefs?.interests?.length) bits.push(`aime ${prefs.interests.slice(0, 3).join(', ')}`);
    if (prefs?.travelsWithChildren) bits.push('voyage en famille avec enfants');
    if (trips[0]?.destination) bits.push(`dernier voyage : ${trips[0].destination}`);
    return bits.length ? `Cet utilisateur ${bits.join(', ')}.` : '';
  },

  /** Generate + persist a natural-language preference summary. */
  async summarize(userId: string): Promise<string> {
    const [profile, prefs, trips] = await Promise.all([
      this.getProfile(userId), this.getPreferences(userId), this.getTrips(userId, 5),
    ]);
    const facts = this.fallbackSummary(profile, prefs, trips);
    let summary = facts;
    try {
      const res = await openaiService.chat([
        { role: 'user', content:
          `Voici des faits sur un voyageur: ${facts || 'aucun historique'}.\n` +
          `Résume en UNE phrase chaleureuse en français à la 2e personne ("vous"), ` +
          `comme une conseillère qui se souvient de lui. Réponds en JSON {"reply": "..."}.` },
      ]);
      if (res.reply) summary = res.reply;
    } catch (e) {
      logger.warn('summary LLM unavailable, using fallback', { err: String(e) });
    }
    await supabase.update('travel_profiles', { user_id: userId }, {
      preference_summary: summary, summary_updated_at: new Date().toISOString(),
    }).catch(() => undefined);
    return summary;
  },

  /* ── Context + greeting (the headline feature) ──────────────────────────── */
  buildGreeting(profile: TravelProfile | null, summary: string): string {
    if (profile?.preferredCabin && (profile.homeCity || profile.homeAirport)) {
      const cabin = CABIN_FR[profile.preferredCabin];
      const from = profile.homeCity ?? profile.homeAirport;
      return `Bonjour, vous voyagez habituellement en classe ${cabin} au départ de ${from}. ` +
             `Souhaitez-vous que je recherche des options similaires ?`;
    }
    if (summary) return `Bonjour ! ${summary} Souhaitez-vous repartir sur ces bases ?`;
    return "Bonjour, je suis Webbina. Où rêvez-vous de partir en famille ?";
  },

  async getContext(userId: string): Promise<MemoryContext> {
    const [profile, preferences, travelers, passports, recentTrips] = await Promise.all([
      this.getProfile(userId), this.getPreferences(userId), this.getTravelers(userId),
      this.getPassports(userId), this.getTrips(userId, 5),
    ]);
    const summary = profile?.preferenceSummary || this.fallbackSummary(profile, preferences, recentTrips);
    const returning = Boolean(profile || preferences || recentTrips.length);
    return {
      ...(profile ? { profile } : {}),
      ...(preferences ? { preferences } : {}),
      travelers, passports, recentTrips, summary,
      greeting: this.buildGreeting(profile, summary),
      returning,
    };
  },
};
