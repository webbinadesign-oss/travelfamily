/**
 * Duffel Stays — hotel search (test mode supported).
 * Searches by geographic coordinates + radius, returns accommodation with a
 * cheapest rate. Maps onto our HotelOffer type so the frontend stays unchanged.
 * Same DUFFEL_API_KEY as flights.
 * Docs: https://duffel.com/docs/api/stays
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';
import type { HotelSearchQuery, HotelOffer } from '../types/index.js';

const BASE = 'https://api.duffel.com';

function assertConfigured(): void {
  if (!env.duffelApiKey) {
    throw ApiError.serviceUnavailable(
      'duffel_not_configured',
      'Duffel key is not set. Define DUFFEL_API_KEY.',
    );
  }
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.duffelApiKey}`,
    'Duffel-Version': env.duffelVersion || 'v2',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

interface RawResult {
  id: string;
  cheapest_rate_total_amount?: string;
  cheapest_rate_currency?: string;
  accommodation: {
    id: string;
    name: string;
    rating?: number; // star rating
    review_score?: number;
    location?: { geographic_coordinates?: { latitude: number; longitude: number } };
    photos?: { url: string }[];
  };
}
interface SearchResponse {
  data: { results?: RawResult[] };
}

function mapResult(r: RawResult, currency: string): HotelOffer {
  const a = r.accommodation;
  const geo = a.location?.geographic_coordinates;
  const photo = a.photos && a.photos[0];
  return {
    hotelId: a.id,
    name: a.name,
    available: true,
    perNight: false, // Duffel total is for the whole stay
    price: {
      amount: Number(r.cheapest_rate_total_amount || 0),
      currency: r.cheapest_rate_currency || currency,
    },
    ...(a.rating !== undefined ? { rating: a.rating } : {}),
    ...(a.review_score !== undefined ? { reviewScore: a.review_score } : {}),
    ...(geo ? { geo: { lat: geo.latitude, lng: geo.longitude } } : {}),
    ...(photo ? { photoUrl: photo.url } : {}),
  };
}

export const duffelStaysService = {
  async searchHotels(q: HotelSearchQuery): Promise<HotelOffer[]> {
    assertConfigured();
    if (q.lat === undefined || q.lng === undefined) {
      throw ApiError.badRequest('Duffel Stays requires lat/lng coordinates.');
    }
    const currency = q.currencyCode ?? 'EUR';

    const guests: Array<{ type: string }> = [];
    for (let i = 0; i < q.adults; i++) guests.push({ type: 'adult' });
    // Duffel Stays counts children as guests too (age handling varies); keep simple.
    for (let i = 0; i < (q.children ?? 0); i++) guests.push({ type: 'adult' });

    const body = {
      data: {
        check_in_date: q.checkInDate,
        check_out_date: q.checkOutDate,
        rooms: q.roomQuantity ?? 1,
        guests,
        location: {
          radius: q.radiusKm ?? 10,
          geographic_coordinates: { latitude: q.lat, longitude: q.lng },
        },
      },
    };

    const res = await httpRequest<SearchResponse>(`${BASE}/stays/search`, {
      method: 'POST',
      provider: 'duffel-stays',
      timeoutMs: 30_000,
      headers: headers(),
      body,
    });

    const results = res.data.results ?? [];
    return results
      .map((r) => mapResult(r, currency))
      .filter((h) => h.price.amount > 0)
      .sort((a, b) => a.price.amount - b.price.amount)
      .slice(0, 8);
  },
};
