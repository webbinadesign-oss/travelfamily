/**
 * Kiwi.com (Tequila API) — flight search WITH low-cost carriers.
 *
 * Why this exists: Duffel covers mostly full-service airlines and very few
 * low-cost carriers (Ryanair, easyJet, Transavia, Vueling, Wizz…). Kiwi/Tequila
 * aggregates LCCs and "virtual interlining", so it surfaces the cheap fares
 * families actually book.
 *
 * Two levels:
 *   1. SEARCH (this file, live as soon as KIWI_API_KEY is set) — real prices
 *      incl. LCCs, mapped onto our FlightOffer shape so the UI shows them
 *      alongside Duffel. Each offer carries a `deepLink` to finish on Kiwi.
 *   2. BOOKING (Tequila Booking API) — true in-app booking. Requires a Kiwi
 *      partner agreement + deposit; wire it once approved (check_flights →
 *      save_booking → payment). Not enabled here.
 *
 * Docs: https://tequila.kiwi.com/portal/docs/tequila_api
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';
import type { FlightSearchQuery, FlightOffer, FlightSegment } from '../types/index.js';

const BASE = 'https://api.tequila.kiwi.com';

function assertConfigured(): void {
  if (!env.kiwiApiKey) {
    throw ApiError.serviceUnavailable(
      'kiwi_not_configured',
      'Clé Kiwi/Tequila absente. Définir KIWI_API_KEY (ou TEQUILA_API_KEY) sur le serveur.',
    );
  }
}

/** Tequila wants dd/mm/yyyy. Our queries use yyyy-mm-dd. */
function toKiwiDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/** Seconds → ISO 8601 duration (PT#H#M). */
function secToIso(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `PT${h ? h + 'H' : ''}${m ? m + 'M' : ''}` || 'PT0M';
}

interface KiwiRouteLeg {
  flyFrom: string;
  flyTo: string;
  local_departure: string;
  local_arrival: string;
  airline: string;
  flight_no: number;
  return: number; // 0 = outbound, 1 = inbound
}
interface KiwiItinerary {
  id: string;
  price: number;
  deep_link: string;
  duration?: { departure?: number; return?: number; total?: number };
  route: KiwiRouteLeg[];
  airlines?: string[];
}
interface KiwiSearchResponse {
  currency?: string;
  data?: KiwiItinerary[];
}

function mapItinerary(it: KiwiItinerary, currency: string): FlightOffer {
  // Outbound legs only for the headline segments (return leg handled by Kiwi).
  const outbound = it.route.filter((r) => r.return === 0);
  const legs = outbound.length ? outbound : it.route;
  const segments: FlightSegment[] = legs.map((r) => ({
    from: r.flyFrom,
    to: r.flyTo,
    departureAt: r.local_departure,
    arrivalAt: r.local_arrival,
    carrierCode: r.airline,
    flightNumber: `${r.airline}${r.flight_no}`,
    durationIso: '',
  }));
  const hasReturn = it.route.some((r) => r.return === 1);
  return {
    id: `kiwi_${it.id}`,
    price: { amount: Math.round(it.price), currency: (currency || 'EUR').toUpperCase() },
    oneWay: !hasReturn,
    stops: Math.max(0, legs.length - 1),
    durationIso: secToIso(it.duration?.departure),
    segments,
    source: 'kiwi',
    lowCost: true,
    deepLink: it.deep_link,
  };
}

export const kiwiService = {
  configured(): boolean {
    return Boolean(env.kiwiApiKey);
  },

  async searchFlights(q: FlightSearchQuery): Promise<FlightOffer[]> {
    assertConfigured();
    const currency = (q.currencyCode || 'EUR').toUpperCase();
    const query: Record<string, string | number> = {
      fly_from: q.origin,
      fly_to: q.destination,
      date_from: toKiwiDate(q.departureDate),
      date_to: toKiwiDate(q.departureDate),
      adults: q.adults,
      children: q.children ?? 0,
      infants: q.infants ?? 0,
      curr: currency,
      locale: 'fr',
      vehicle_type: 'aircraft',
      sort: 'price',
      limit: Math.min(q.maxResults ?? 10, 30),
      one_for_city: 0,
    };
    if (q.returnDate) {
      query.return_from = toKiwiDate(q.returnDate);
      query.return_to = toKiwiDate(q.returnDate);
    }
    if (q.travelClass) {
      const map: Record<string, string> = { ECONOMY: 'M', PREMIUM_ECONOMY: 'W', BUSINESS: 'C', FIRST: 'F' };
      query.selected_cabins = map[q.travelClass] || 'M';
    }

    const res = await httpRequest<KiwiSearchResponse>(`${BASE}/v2/search`, {
      provider: 'kiwi',
      timeoutMs: 20_000,
      headers: { apikey: env.kiwiApiKey, Accept: 'application/json' },
      query,
    });
    const items = Array.isArray(res?.data) ? res!.data! : [];
    return items
      .map((it) => mapItinerary(it, res?.currency || currency))
      .filter((o) => o.price.amount > 0)
      .sort((a, b) => a.price.amount - b.price.amount)
      .slice(0, q.maxResults ?? 10);
  },
};
