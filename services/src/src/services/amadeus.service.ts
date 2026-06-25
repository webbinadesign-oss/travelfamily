/**
 * Amadeus Self-Service — flights & hotels.
 * Handles OAuth2 (client_credentials) with in-memory token caching.
 * Docs: https://developers.amadeus.com
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';
import type {
  FlightSearchQuery,
  FlightOffer,
  FlightSegment,
  HotelSearchQuery,
  HotelOffer,
} from '../types/index.js';

const BASE =
  env.amadeusEnv === 'production'
    ? 'https://api.amadeus.com'
    : 'https://test.api.amadeus.com';

function assertConfigured(): void {
  if (!env.amadeusApiKey || !env.amadeusApiSecret) {
    throw ApiError.serviceUnavailable(
      'amadeus_not_configured',
      'Amadeus keys are not set. Define AMADEUS_API_KEY and AMADEUS_API_SECRET.',
    );
  }
}

/* ── Token cache ──────────────────────────────────────────── */
let token: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  assertConfigured();
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;

  const data = await httpRequest<{ access_token: string; expires_in: number }>(
    `${BASE}/v1/security/oauth2/token`,
    {
      method: 'POST',
      provider: 'amadeus',
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.amadeusApiKey,
        client_secret: env.amadeusApiSecret,
      }),
    },
  );
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return token.value;
}

async function authed<T>(path: string, query?: Record<string, string | number | boolean>): Promise<T> {
  const access = await getToken();
  return httpRequest<T>(`${BASE}${path}`, {
    provider: 'amadeus',
    headers: { Authorization: `Bearer ${access}` },
    query,
  });
}

/* ── Mappers (raw Amadeus → our domain types) ─────────────── */
interface RawFlightOffer {
  id: string;
  oneWay: boolean;
  numberOfBookableSeats?: number;
  price: { grandTotal: string; currency: string };
  itineraries: { duration: string; segments: RawSegment[] }[];
}
interface RawSegment {
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  carrierCode: string;
  number: string;
  duration: string;
}

function mapFlight(raw: RawFlightOffer): FlightOffer {
  const segments: FlightSegment[] = raw.itineraries.flatMap((it) =>
    it.segments.map((s) => ({
      from: s.departure.iataCode,
      to: s.arrival.iataCode,
      departureAt: s.departure.at,
      arrivalAt: s.arrival.at,
      carrierCode: s.carrierCode,
      flightNumber: `${s.carrierCode}${s.number}`,
      durationIso: s.duration,
    })),
  );
  return {
    id: raw.id,
    oneWay: raw.oneWay,
    price: { amount: Number(raw.price.grandTotal), currency: raw.price.currency },
    stops: Math.max(0, segments.length - raw.itineraries.length),
    durationIso: raw.itineraries[0]?.duration ?? '',
    segments,
    ...(raw.numberOfBookableSeats !== undefined
      ? { bookableSeats: raw.numberOfBookableSeats }
      : {}),
  };
}

export const amadeusService = {
  async searchFlights(q: FlightSearchQuery): Promise<FlightOffer[]> {
    const data = await authed<{ data: RawFlightOffer[] }>('/v2/shopping/flight-offers', {
      originLocationCode: q.origin,
      destinationLocationCode: q.destination,
      departureDate: q.departureDate,
      ...(q.returnDate ? { returnDate: q.returnDate } : {}),
      adults: q.adults,
      ...(q.children ? { children: q.children } : {}),
      ...(q.infants ? { infants: q.infants } : {}),
      ...(q.travelClass ? { travelClass: q.travelClass } : {}),
      ...(q.nonStop !== undefined ? { nonStop: q.nonStop } : {}),
      currencyCode: q.currencyCode ?? 'EUR',
      max: q.maxResults ?? 20,
    });
    return (data.data ?? []).map(mapFlight);
  },

  async searchHotels(q: HotelSearchQuery): Promise<HotelOffer[]> {
    // 1) hotels by city → ids, 2) offers for those ids
    const list = await authed<{ data: { hotelId: string; name: string; geoCode?: { latitude: number; longitude: number }; rating?: string }[] }>(
      '/v1/reference-data/locations/hotels/by-city',
      { cityCode: q.cityCode, radius: q.radiusKm ?? 20, radiusUnit: 'KM' },
    );
    const ids = (list.data ?? []).slice(0, 25).map((h) => h.hotelId);
    if (ids.length === 0) return [];

    const offers = await authed<{
      data: {
        hotel: { hotelId: string; name: string; latitude?: number; longitude?: number; rating?: string };
        available: boolean;
        offers?: { price: { total: string; currency: string }; boardType?: string }[];
      }[];
    }>('/v3/shopping/hotel-offers', {
      hotelIds: ids.join(','),
      adults: q.adults,
      checkInDate: q.checkInDate,
      checkOutDate: q.checkOutDate,
      roomQuantity: q.roomQuantity ?? 1,
      currency: q.currencyCode ?? 'EUR',
      bestRateOnly: true,
    });

    return (offers.data ?? []).map((o): HotelOffer => {
      const best = o.offers?.[0];
      return {
        hotelId: o.hotel.hotelId,
        name: o.hotel.name,
        available: o.available,
        ...(o.hotel.rating ? { rating: Number(o.hotel.rating) } : {}),
        ...(o.hotel.latitude !== undefined && o.hotel.longitude !== undefined
          ? { geo: { lat: o.hotel.latitude, lng: o.hotel.longitude } }
          : {}),
        price: best
          ? { amount: Number(best.price.total), currency: best.price.currency }
          : { amount: 0, currency: q.currencyCode ?? 'EUR' },
        ...(best?.boardType ? { boardType: best.boardType } : {}),
      };
    });
  },
};
