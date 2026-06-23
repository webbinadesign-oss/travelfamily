/**
 * "Bon plan du jour" — Webbina's deal discovery (like a travel-deals site, but
 * bookable in-app). Scans a curated set of family-friendly destinations from a
 * home airport across a few upcoming date windows, finds the cheapest real
 * Duffel fare per destination, and scores it against a typical reference price.
 *
 * Cached daily (in-memory) so we don't hammer Duffel — a "deal OF THE DAY"
 * naturally refreshes once per day.
 */
import { duffelService } from './duffel.service.js';
import { logger } from '../lib/logger.js';

export interface Deal {
  destination: string;
  country: string;
  iata: string;
  origin: string;
  departureDate: string;
  returnDate: string;
  pricePerPax: number;
  currency: string;
  typicalPrice: number;
  discountPct: number;   // 0..100, vs typical
  carrier: string;
  stops: number;
  hot: boolean;          // genuinely good deal (discount ≥ 15%)
}

/** Curated family destinations with a typical round-trip reference price (€/pax). */
const CATALOG: { iata: string; name: string; country: string; typical: number }[] = [
  { iata: 'LIS', name: 'Lisbonne', country: 'Portugal', typical: 220 },
  { iata: 'CTA', name: 'Sicile', country: 'Italie', typical: 240 },
  { iata: 'BCN', name: 'Barcelone', country: 'Espagne', typical: 180 },
  { iata: 'AGP', name: 'Malaga', country: 'Espagne', typical: 210 },
  { iata: 'ATH', name: 'Athènes', country: 'Grèce', typical: 260 },
  { iata: 'DPS', name: 'Bali', country: 'Indonésie', typical: 950 },
  { iata: 'RAK', name: 'Marrakech', country: 'Maroc', typical: 230 },
  { iata: 'DBV', name: 'Dubrovnik', country: 'Croatie', typical: 250 },
];

interface CacheEntry { day: string; deals: Deal[]; }
const cache = new Map<string, CacheEntry>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Two upcoming weekend-ish windows: ~3 and ~6 weeks out, 5-night trips. */
function windows(): { dep: string; ret: string }[] {
  const mk = (offsetDays: number, nights: number) => {
    const d = new Date(); d.setDate(d.getDate() + offsetDays);
    const r = new Date(d); r.setDate(r.getDate() + nights);
    return { dep: d.toISOString().slice(0, 10), ret: r.toISOString().slice(0, 10) };
  };
  return [mk(21, 5), mk(45, 7)];
}

async function cheapestFor(origin: string, iata: string): Promise<{ price: number; currency: string; carrier: string; stops: number; dep: string; ret: string } | null> {
  let best: { price: number; currency: string; carrier: string; stops: number; dep: string; ret: string } | null = null;
  // Both date windows in parallel.
  const perWindow = await Promise.all(windows().map(async (w) => {
    try {
      const offers = await duffelService.searchFlights({
        origin, destination: iata, departureDate: w.dep, returnDate: w.ret,
        adults: 1, maxResults: 1,
      });
      const o = offers[0];
      if (o && o.price?.amount) {
        return {
          price: Math.round(o.price.amount),
          currency: o.price.currency || 'EUR',
          carrier: o.segments?.[0]?.carrierCode || '',
          stops: o.stops || 0, dep: w.dep, ret: w.ret,
        };
      }
    } catch (e) {
      logger.warn('deal scan failed', { iata, err: String(e) });
    }
    return null;
  }));
  for (const r of perWindow) {
    if (r && (!best || r.price < best.price)) best = r;
  }
  return best;
}

export const dealsService = {
  async dealOfTheDay(origin = 'CDG', limit = 6): Promise<Deal[]> {
    const key = `${origin}:${todayKey()}`;
    const cached = cache.get(key);
    if (cached && cached.day === todayKey()) return cached.deals.slice(0, limit);

    const results: Deal[] = [];
    // Scan ALL destinations in parallel — turns ~45s sequential into ~5s.
    const scans = await Promise.all(
      CATALOG.map(async (c) => ({ c, best: await cheapestFor(origin, c.iata) })),
    );
    for (const { c, best } of scans) {
      if (!best) continue;
      const discount = Math.max(0, Math.round((1 - best.price / c.typical) * 100));
      results.push({
        destination: c.name, country: c.country, iata: c.iata, origin,
        departureDate: best.dep, returnDate: best.ret,
        pricePerPax: best.price, currency: best.currency,
        typicalPrice: c.typical, discountPct: discount,
        carrier: best.carrier, stops: best.stops, hot: discount >= 15,
      });
    }
    // Best deals first (highest discount, then lowest price).
    results.sort((a, b) => (b.discountPct - a.discountPct) || (a.pricePerPax - b.pricePerPax));
    cache.set(key, { day: todayKey(), deals: results });
    return results.slice(0, limit);
  },
};
