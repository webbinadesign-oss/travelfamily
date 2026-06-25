/**
 * Travelpayouts (Aviasales) DATA API — real cached fares + "best dates" engine.
 *
 * IMPORTANT — what this is and isn't:
 *  Travelpayouts is an AFFILIATE / referral network. There is NO product that
 *  lets a customer pay INSIDE our app via Travelpayouts — final checkout always
 *  happens on the partner site (Aviasales/airline). True in-app PAYMENT for
 *  flights comes from Duffel; for hotels from RateHawk / Duffel Stays.
 *
 *  What the Data API token unlocks, and what we use here:
 *   - real cached fares for a route (display natively, "white-label" feel)
 *   - the cheapest upcoming DATES for a route ("Voyages Pirates" effect)
 *  The final "Réserver" deep-links to the partner with our affiliate marker,
 *  so browsing feels native and the booking still earns commission.
 *
 * Docs: https://support.travelpayouts.com/hc/en-us/sections/200166550
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';

const BASE = 'https://api.travelpayouts.com';
const AVIA = 'https://www.aviasales.com';

export interface TpFare {
  origin: string;
  destination: string;
  departureDate: string;       // YYYY-MM-DD
  returnDate: string | null;
  price: number;               // total for the itinerary, in `currency`
  currency: string;
  airline: string;             // IATA carrier code
  flightNumber: string | null;
  transfers: number;           // 0 = direct
  capturedAt: string | null;   // when the price was last seen (ISO)
  bookLink: string;            // affiliate deep link to finish on the partner
}

function assertConfigured(): void {
  if (!env.travelpayoutsToken) {
    throw ApiError.serviceUnavailable(
      'travelpayouts_not_configured',
      'Travelpayouts token absent. Définir TRAVELPAYOUTS_TOKEN sur le serveur.',
    );
  }
}

/** Affiliate deep link to the Aviasales search/result, carrying our marker. */
function affiliateLink(rawLink: string | undefined, origin: string, destination: string, dep: string): string {
  const marker = env.travelpayoutsMarker || '741019';
  if (rawLink && rawLink.startsWith('/')) {
    const sep = rawLink.includes('?') ? '&' : '?';
    return `${AVIA}${rawLink}${sep}marker=${marker}`;
  }
  // Fallback: a clean search deep link (DDMM origin→dest).
  const d = dep.slice(8, 10) + dep.slice(5, 7); // DDMM
  return `${AVIA}/search/${origin}${d}${destination}1?marker=${marker}`;
}

interface V3Row {
  origin: string;
  destination: string;
  departure_at: string;
  return_at?: string;
  price: number;
  airline: string;
  flight_number?: number | string;
  transfers?: number;
  link?: string;
}

export const travelpayoutsService = {
  configured(): boolean {
    return Boolean(env.travelpayoutsToken);
  },

  /**
   * Real cached fares for a route, cheapest first.
   * Uses /aviasales/v3/prices_for_dates (one-way or round-trip).
   */
  async cheapestForRoute(params: {
    origin: string;
    destination: string;
    departureDate?: string;   // YYYY-MM or YYYY-MM-DD; omitted = any upcoming
    returnDate?: string;
    oneWay?: boolean;
    currency?: string;
    limit?: number;
  }): Promise<TpFare[]> {
    assertConfigured();
    const currency = (params.currency || 'eur').toLowerCase();
    const data = await httpRequest<{ success?: boolean; data?: V3Row[] }>(
      `${BASE}/aviasales/v3/prices_for_dates`,
      {
        provider: 'travelpayouts',
        timeoutMs: 12_000,
        query: {
          origin: params.origin,
          destination: params.destination,
          departure_at: params.departureDate || undefined,
          return_at: params.returnDate || undefined,
          one_way: params.oneWay ? 'true' : 'false',
          currency,
          sorting: 'price',
          direct: 'false',
          limit: Math.min(params.limit || 12, 30),
          token: env.travelpayoutsToken,
        },
        headers: { 'X-Access-Token': env.travelpayoutsToken },
      },
    );
    const rows = Array.isArray(data?.data) ? data!.data! : [];
    return rows
      .map((r): TpFare => ({
        origin: r.origin,
        destination: r.destination,
        departureDate: (r.departure_at || '').slice(0, 10),
        returnDate: r.return_at ? r.return_at.slice(0, 10) : null,
        price: Math.round(r.price),
        currency: currency.toUpperCase(),
        airline: r.airline,
        flightNumber: r.flight_number != null ? String(r.flight_number) : null,
        transfers: r.transfers ?? 0,
        capturedAt: null,
        bookLink: affiliateLink(r.link, r.origin, r.destination, (r.departure_at || '').slice(0, 10)),
      }))
      .sort((a, b) => a.price - b.price);
  },

  /**
   * Cheapest upcoming DATES for a route — the "best dates" / Voyages-Pirates
   * effect. Groups cached fares by departure date, cheapest first.
   */
  async bestDates(params: {
    origin: string;
    destination: string;
    currency?: string;
    limit?: number;
  }): Promise<TpFare[]> {
    assertConfigured();
    const currency = (params.currency || 'eur').toLowerCase();
    const data = await httpRequest<{ success?: boolean; data?: Record<string, V3Row> | V3Row[] }>(
      `${BASE}/aviasales/v3/grouped_prices`,
      {
        provider: 'travelpayouts',
        timeoutMs: 12_000,
        query: {
          origin: params.origin,
          destination: params.destination,
          group_by: 'departure_at',
          currency,
          sorting: 'price',
          token: env.travelpayoutsToken,
        },
        headers: { 'X-Access-Token': env.travelpayoutsToken },
      },
    );
    const raw = data?.data;
    const rows: V3Row[] = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object'
        ? Object.values(raw)
        : [];
    return rows
      .map((r): TpFare => ({
        origin: r.origin || params.origin,
        destination: r.destination || params.destination,
        departureDate: (r.departure_at || '').slice(0, 10),
        returnDate: r.return_at ? r.return_at.slice(0, 10) : null,
        price: Math.round(r.price),
        currency: currency.toUpperCase(),
        airline: r.airline,
        flightNumber: r.flight_number != null ? String(r.flight_number) : null,
        transfers: r.transfers ?? 0,
        capturedAt: null,
        bookLink: affiliateLink(r.link, r.origin || params.origin, r.destination || params.destination, (r.departure_at || '').slice(0, 10)),
      }))
      .filter((f) => f.departureDate && f.price > 0)
      .sort((a, b) => a.price - b.price)
      .slice(0, Math.min(params.limit || 8, 20));
  },
};
