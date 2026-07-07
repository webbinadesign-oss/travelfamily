/**
 * SerpApi (Google Flights) — REAL low-cost fares (Ryanair, easyJet, Wizz,
 * Transavia…) that Duffel/Travelpayouts miss. Pay-as-you-go, no airline
 * partnership required. Activate by setting SERPAPI_KEY on the backend.
 *
 * We only read the CHEAPEST fare for a route+dates (one call), used to power the
 * carnet's airport comparison and the price grid. Booking still happens via the
 * airline/affiliate link — this is a PRICE source, not a payment path.
 */
import { env } from '../config/env.js';
import { httpRequest } from '../lib/httpClient.js';

const BASE = 'https://serpapi.com/search.json';

interface SerpFlightsResponse {
  best_flights?: Array<{ price?: number }>;
  other_flights?: Array<{ price?: number }>;
  error?: string;
}

export const serpFlightsService = {
  configured(): boolean {
    return Boolean(env.serpapiKey);
  },

  /**
   * Cheapest fare for a route (Google Flights via SerpApi).
   * departDate/returnDate = YYYY-MM-DD. Omit returnDate for one-way.
   * Returns price in EUR (per person) or null when unavailable.
   */
  async cheapest(origin: string, destination: string, departDate: string, returnDate?: string): Promise<number | null> {
    if (!env.serpapiKey || !departDate) return null;
    try {
      const data = await httpRequest<SerpFlightsResponse>(BASE, {
        method: 'GET', provider: 'serpapi', timeoutMs: 12_000, retries: 0,
        query: {
          engine: 'google_flights',
          departure_id: origin,
          arrival_id: destination,
          outbound_date: departDate,
          ...(returnDate ? { return_date: returnDate } : { type: '2' }), // 2 = one-way
          currency: 'EUR',
          hl: 'fr', gl: 'fr',
          api_key: env.serpapiKey,
        },
      });
      const all = [...(data.best_flights || []), ...(data.other_flights || [])]
        .map((f) => f.price).filter((p): p is number => typeof p === 'number' && p > 0);
      return all.length ? Math.min(...all) : null;
    } catch {
      return null;
    }
  },
};
