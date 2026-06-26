/**
 * Webbina Loyalty engine — honors the rewards program automatically.
 *
 * Source of truth = the user's real saved_trips (no manual flags). From them we
 * derive: validated trips, distinct continents, family trips, the loyalty tier,
 * and the travel-wallet (cagnotte) balance — all per the published rules.
 *
 * RULES (kept in sync with the app's "transparence" card):
 *  - A trip counts only if BOOKED/COMPLETED, not cancelled, amount ≥ 150 €.
 *  - Cagnotte is credited only for REALIZED trips (completed or past end date),
 *    capped per booking, valid 24 months.
 *  - Rate: 0.5% free, 2% premium. The "Famille Voyageuse" tier earns 2% for life.
 *  - Tiers: Explorateur (1 validated) · Aventurier (3) · Globe Trotter
 *    (3 continents) · Famille Voyageuse (5 family trips, ≥2 travelers).
 *  - Globe Trotter / Famille → reduced commission (applied at quote time).
 */
import type { SavedTrip } from '../types/memory.js';
import { memoryService } from './memory.service.js';
import { supabase } from './supabase.service.js';

export type Plan = 'free' | 'premium';
export type TierId = 'none' | 'explorer' | 'adventurer' | 'globe' | 'family';

export interface LoyaltyState {
  tier: TierId;
  tierName: string;
  plan: Plan;
  validatedTrips: number;
  familyTrips: number;
  continents: number;
  continentList: string[];
  rate: number;          // cagnotte % currently earned
  capPerBooking: number; // € cap credited per booking
  balance: number;       // € available in the travel wallet
  reducedCommission: boolean;
  vip: boolean;
  perks: string[];
  next: { id: TierId; name: string; remaining: string } | null;
}

const RULES = {
  minAmount: 150,        // € minimum for a trip to count
  rateFree: 0.005,       // 0.5%
  ratePremium: 0.02,     // 2%
  capFree: 25,           // € per booking (free)
  capPremium: 150,       // € per booking (premium / family)
  welcomeExplorer: 10,   // € one-off welcome credit
  bonusFamily: 50,       // € one-off at the family tier
  expiryMonths: 24,
};

/* Minimal country → continent map (FR + EN names). Extend as needed. */
const CONTINENT: Record<string, string> = {
  france:'Europe', espagne:'Europe', spain:'Europe', italie:'Europe', italy:'Europe', portugal:'Europe',
  grèce:'Europe', grece:'Europe', greece:'Europe', allemagne:'Europe', 'royaume-uni':'Europe', irlande:'Europe',
  croatie:'Europe', 'pays-bas':'Europe', belgique:'Europe', suisse:'Europe', autriche:'Europe', islande:'Europe',
  maroc:'Afrique', morocco:'Afrique', tunisie:'Afrique', égypte:'Afrique', egypte:'Afrique', egypt:'Afrique',
  sénégal:'Afrique', senegal:'Afrique', 'afrique du sud':'Afrique', kenya:'Afrique', tanzanie:'Afrique',
  'états-unis':'Amérique', 'etats-unis':'Amérique', usa:'Amérique', canada:'Amérique', mexique:'Amérique',
  brésil:'Amérique', bresil:'Amérique', argentine:'Amérique', pérou:'Amérique', perou:'Amérique', cuba:'Amérique',
  thaïlande:'Asie', thailande:'Asie', thailand:'Asie', japon:'Asie', japan:'Asie', indonésie:'Asie', indonesie:'Asie',
  bali:'Asie', vietnam:'Asie', inde:'Asie', india:'Asie', chine:'Asie', 'sri lanka':'Asie', maldives:'Asie',
  émirats:'Asie', emirats:'Asie', 'dubaï':'Asie', dubai:'Asie', turquie:'Asie', 'arabie saoudite':'Asie',
  australie:'Océanie', australia:'Océanie', 'nouvelle-zélande':'Océanie', 'polynésie':'Océanie', fidji:'Océanie',
};

function continentOf(country?: string, destination?: string): string | null {
  const key = (country || destination || '').trim().toLowerCase();
  if (!key) return null;
  if (CONTINENT[key]) return CONTINENT[key];
  // try matching any known token inside the string (e.g. "Bali, Indonésie")
  for (const k of Object.keys(CONTINENT)) {
    if (key.includes(k)) return CONTINENT[k];
  }
  return null;
}

function amountOf(t: SavedTrip): number {
  return t.budget?.amount != null ? Number(t.budget.amount) : 0;
}
/** Paid & not cancelled, above the minimum. */
function isValidated(t: SavedTrip): boolean {
  return (t.status === 'booked' || t.status === 'completed') && amountOf(t) >= RULES.minAmount;
}
/** Realized = trip has actually happened (cagnotte is credited only then). */
function isRealized(t: SavedTrip): boolean {
  if (t.status === 'completed') return true;
  if (t.endDate) return new Date(t.endDate).getTime() < Date.now();
  return false;
}
/** Within the cagnotte validity window. */
function withinExpiry(t: SavedTrip): boolean {
  const ref = t.endDate || t.createdAt;
  if (!ref) return true;
  const ageMonths = (Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return ageMonths <= RULES.expiryMonths;
}

const TIER_NAME: Record<TierId, string> = {
  none: 'Nouveau voyageur', explorer: 'Explorateur', adventurer: 'Aventurier',
  globe: 'Globe Trotter', family: 'Famille Voyageuse',
};

export const loyaltyService = {
  async compute(userId: string, plan: Plan = 'free'): Promise<LoyaltyState> {
    const trips = await memoryService.getTrips(userId, 200);
    const validated = trips.filter(isValidated);
    const familyTrips = validated.filter((t) => (t.travelersCount ?? 1) >= 2).length;

    const continentSet = new Set<string>();
    for (const t of validated) {
      const c = continentOf(t.country, t.destination);
      if (c) continentSet.add(c);
    }
    const continents = continentSet.size;
    const validatedCount = validated.length;

    // Tier resolution (ordered, highest wins).
    let tier: TierId = 'none';
    if (validatedCount >= 1) tier = 'explorer';
    if (validatedCount >= 3) tier = 'adventurer';
    if (continents >= 3) tier = 'globe';
    if (familyTrips >= 5) tier = 'family';

    const isFamilyTier = tier === 'family';
    const rate = (plan === 'premium' || isFamilyTier) ? RULES.ratePremium : RULES.rateFree;
    const cap = (plan === 'premium' || isFamilyTier) ? RULES.capPremium : RULES.capFree;

    // Cagnotte = credits on realized, non-expired validated trips + one-off bonuses.
    let balance = 0;
    for (const t of validated) {
      if (!isRealized(t) || !withinExpiry(t)) continue;
      balance += Math.min(amountOf(t) * rate, cap);
    }
    if (tier !== 'none') balance += RULES.welcomeExplorer;          // welcome credit
    if (tier === 'family') balance += RULES.bonusFamily;            // family milestone

    // Manual gestures from the gérante (Espace Gérante) — credits add to the wallet.
    try {
      const adj = await supabase.select<{ kind: string; amount_eur: number }>(
        'loyalty_adjustments', { match: { user_id: userId }, limit: 200 },
      );
      for (const a of adj) {
        if (a.kind === 'credit') balance += Number(a.amount_eur) || 0;
      }
    } catch { /* table may not exist yet — ignore */ }
    balance = Math.round(balance * 100) / 100;

    const reducedCommission = tier === 'globe' || tier === 'family';
    const vip = tier === 'family';

    const perks: string[] = [];
    if (tier !== 'none') perks.push('Bons plans du jour');
    if (tier === 'adventurer') perks.push('1 mois Premium offert');
    if (reducedCommission) perks.push('Commission réduite à vie');
    if (vip) perks.push('Cagnotte 2 % à vie', 'Statut VIP — SAV prioritaire', 'Bons plans exclusifs');

    // Next tier hint.
    let next: LoyaltyState['next'] = null;
    if (tier === 'none' || tier === 'explorer') {
      const r = Math.max(0, 3 - validatedCount);
      next = { id: 'adventurer', name: 'Aventurier', remaining: `${r} voyage${r > 1 ? 's' : ''} pour 1 mois Premium offert` };
    } else if (tier === 'adventurer') {
      const r = Math.max(0, 3 - continents);
      next = { id: 'globe', name: 'Globe Trotter', remaining: `${r} continent${r > 1 ? 's' : ''} pour la commission réduite à vie` };
    } else if (tier === 'globe') {
      const r = Math.max(0, 5 - familyTrips);
      next = { id: 'family', name: 'Famille Voyageuse', remaining: `${r} voyage${r > 1 ? 's' : ''} en famille pour le statut VIP` };
    }

    return {
      tier, tierName: TIER_NAME[tier], plan,
      validatedTrips: validatedCount, familyTrips, continents, continentList: [...continentSet],
      rate, capPerBooking: cap, balance, reducedCommission, vip, perks, next,
    };
  },

  /** Commission multiplier to apply at quote time (1 = full, <1 = reduced). */
  async commissionMultiplier(userId: string, plan: Plan = 'free'): Promise<number> {
    const s = await this.compute(userId, plan);
    // Premium and reduced-commission tiers shave the service fee.
    let m = 1;
    if (s.reducedCommission) m -= 0.2;   // -20% for Globe Trotter / Famille
    if (plan === 'premium') m -= 0.15;   // -15% for Premium subscribers
    return Math.max(0.5, Math.round(m * 100) / 100);
  },
};
