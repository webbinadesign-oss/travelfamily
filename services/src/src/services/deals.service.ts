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
  pricePerPax: number;     // REAL fare found right now (one-way, €/pax)
  currency: string;
  carrier: string;
  stops: number;
  hot: boolean;            // among the cheapest found in this scan
  capturedAt: string;      // ISO timestamp — price is "as of" this moment
}

/** Curated family destinations (no invented reference price — we show REAL fares). */
const CATALOG: { iata: string; name: string; country: string }[] = [
  { iata: 'LIS', name: 'Lisbonne', country: 'Portugal' },
  { iata: 'CTA', name: 'Sicile', country: 'Italie' },
  { iata: 'BCN', name: 'Barcelone', country: 'Espagne' },
  { iata: 'AGP', name: 'Malaga', country: 'Espagne' },
  { iata: 'ATH', name: 'Athènes', country: 'Grèce' },
  { iata: 'DPS', name: 'Bali', country: 'Indonésie' },
  { iata: 'RAK', name: 'Marrakech', country: 'Maroc' },
  { iata: 'DBV', name: 'Dubrovnik', country: 'Croatie' },
  { iata: 'FAO', name: 'Algarve', country: 'Portugal' },
  { iata: 'NAP', name: 'Naples', country: 'Italie' },
  { iata: 'PMI', name: 'Majorque', country: 'Espagne' },
  { iata: 'OPO', name: 'Porto', country: 'Portugal' },
];

interface CacheEntry { day: string; deals: Deal[]; }
const cache = new Map<string, CacheEntry>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** One upcoming window (~4 weeks out) — keeps the daily scan fast on free tier. */
function windows(): { dep: string; ret: string }[] {
  const mk = (offsetDays: number, nights: number) => {
    const d = new Date(); d.setDate(d.getDate() + offsetDays);
    const r = new Date(d); r.setDate(r.getDate() + nights);
    return { dep: d.toISOString().slice(0, 10), ret: r.toISOString().slice(0, 10) };
  };
  return [mk(28, 7)];
}

async function cheapestFor(origin: string, iata: string): Promise<{ price: number; currency: string; carrier: string; stops: number; dep: string; ret: string } | null> {
  let best: { price: number; currency: string; carrier: string; stops: number; dep: string; ret: string } | null = null;
  // Both date windows in parallel.
  const perWindow = await Promise.all(windows().map(async (w) => {
    try {
      const offers = await duffelService.searchFlights({
        origin, destination: iata, departureDate: w.dep,
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

    // Don't scan a flight from the origin to itself.
    const targets = CATALOG.filter((c) => c.iata !== origin);
    const now = new Date().toISOString();

    const scans = await Promise.all(
      targets.map(async (c) => ({ c, best: await cheapestFor(origin, c.iata) })),
    );
    const results: Deal[] = [];
    for (const { c, best } of scans) {
      if (!best) continue;
      results.push({
        destination: c.name, country: c.country, iata: c.iata, origin,
        departureDate: best.dep, returnDate: best.ret,
        pricePerPax: best.price, currency: best.currency,
        carrier: best.carrier, stops: best.stops,
        hot: false, capturedAt: now,
      });
    }
    // Cheapest first — a real, honest ranking of what's available now.
    results.sort((a, b) => a.pricePerPax - b.pricePerPax);
    // Mark the 2 cheapest as "hot" (genuinely the best prices found in this scan).
    results.slice(0, 2).forEach((d) => { d.hot = true; });
    cache.set(key, { day: todayKey(), deals: results });
    return results.slice(0, limit);
  },
};
