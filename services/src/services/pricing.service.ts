/**
 * Pricing / commission — Webbina's transparent service fee.
 * Duffel (and others) do NOT add a margin automatically; we compute it here so
 * it's visible to the user as a clear line item, never hidden.
 *
 * Philosophy (why these defaults):
 *  - FLIGHTS are compared to the cent → a flat fee/pax (≈9€) keeps the headline
 *    price competitive instead of a % that inflates a 900€ ticket.
 *  - HOTELS / ACTIVITIES carry more room → a modest % (10–12%) stays below most
 *    OTAs while still earning.
 *  - A PACKAGE (assembled flight+hotel+activities) gets a single concierge % (7%).
 *  - A hard cap (maxMarkupPct) guarantees we never look more expensive than rivals.
 */
import { env } from '../config/env.js';

export type FeeCategory = 'flight' | 'hotel' | 'activity' | 'package' | 'car' | 'transfer' | 'train';

export interface PriceBreakdown {
  base: number;        // supplier price (what we pay)
  fee: number;         // Webbina service fee (our margin)
  total: number;       // base + fee (what the user pays)
  feePct: number;      // effective fee as % of base (for display)
  currency: string;
  label: string;       // transparent label shown to the user
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compute a transparent fee for a given category. */
export function quote(
  category: FeeCategory,
  base: number,
  pax = 1,
  currency = env.stripeCurrency.toUpperCase(),
): PriceBreakdown {
  let fee = 0;
  let label = 'Frais de service Webbina';

  switch (category) {
    case 'flight':
      fee = env.flightFeePerPax * Math.max(1, pax);
      label = `Frais de service Webbina (${env.flightFeePerPax} ${currency}/voyageur)`;
      break;
    case 'hotel':
      fee = base * env.hotelMarkupPct;
      label = `Frais de service Webbina (${Math.round(env.hotelMarkupPct * 100)} %)`;
      break;
    case 'activity':
      fee = base * env.activityMarkupPct;
      label = `Frais de service Webbina (${Math.round(env.activityMarkupPct * 100)} %)`;
      break;
    case 'package':
      fee = base * env.packageMarkupPct;
      label = `Frais de conciergerie Webbina (${Math.round(env.packageMarkupPct * 100)} %)`;
      break;
    case 'car':
      fee = base * env.carMarkupPct;
      label = `Frais de service Webbina (${Math.round(env.carMarkupPct * 100)} %)`;
      break;
    case 'transfer':
      fee = base * env.transferMarkupPct;
      label = `Frais de service Webbina (${Math.round(env.transferMarkupPct * 100)} %)`;
      break;
    case 'train':
      fee = env.trainFee;
      label = `Frais de service Webbina (${env.trainFee} ${currency})`;
      break;
  }

  // Floor + safety cap so we never look abusive vs competitors.
  // Train uses a flat fee (no floor/cap — price is transparent), others get the guard rails.
  if (category !== 'train') {
    fee = Math.max(fee, env.minFee);
    const cap = base * env.maxMarkupPct;
    if (cap > 0) fee = Math.min(fee, cap);
  }
  fee = round2(fee);

  const total = round2(base + fee);
  return {
    base: round2(base),
    fee,
    total,
    feePct: base > 0 ? Math.round((fee / base) * 1000) / 10 : 0,
    currency,
    label,
  };
}

/** Public, non-secret view of the current commission policy (for transparency UI). */
export function commissionPolicy() {
  return {
    flightFeePerPax: env.flightFeePerPax,
    hotelMarkupPct: env.hotelMarkupPct,
    activityMarkupPct: env.activityMarkupPct,
    packageMarkupPct: env.packageMarkupPct,
    carMarkupPct: env.carMarkupPct,
    transferMarkupPct: env.transferMarkupPct,
    trainFee: env.trainFee,
    minFee: env.minFee,
    maxMarkupPct: env.maxMarkupPct,
    currency: env.stripeCurrency.toUpperCase(),
  };
}
