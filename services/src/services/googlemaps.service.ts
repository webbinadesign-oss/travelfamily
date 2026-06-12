/**
 * Google Maps Platform — Places & Geocoding.
 * Used to ground Webbina's suggestions (hotels, activities, restaurants) in
 * real, rated places with photos.
 * Docs: https://developers.google.com/maps/documentation
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';
import type { GeoPoint, Place, PlaceSearchQuery } from '../types/index.js';

const BASE = 'https://maps.googleapis.com/maps/api';

function assertConfigured(): void {
  if (!env.googleApiKey) {
    throw ApiError.serviceUnavailable(
      'google_not_configured',
      'Google key is not set. Define GOOGLE_CLOUD_API_KEY.',
    );
  }
}

function photoUrl(ref: string, maxWidth = 720): string {
  return `${BASE}/place/photo?maxwidth=${maxWidth}&photo_reference=${ref}&key=${env.googleApiKey}`;
}

interface RawPlace {
  place_id: string;
  name: string;
  formatted_address?: string;
  vicinity?: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  photos?: { photo_reference: string }[];
}

function mapPlace(p: RawPlace): Place {
  const first = p.photos?.[0];
  return {
    id: p.place_id,
    name: p.name,
    address: p.formatted_address ?? p.vicinity ?? '',
    location: p.geometry.location,
    types: p.types ?? [],
    ...(p.rating !== undefined ? { rating: p.rating } : {}),
    ...(p.user_ratings_total !== undefined ? { userRatingsTotal: p.user_ratings_total } : {}),
    ...(first ? { photoUrl: photoUrl(first.photo_reference) } : {}),
  };
}

export const googleMapsService = {
  async geocode(address: string): Promise<GeoPoint> {
    assertConfigured();
    const data = await httpRequest<{ status: string; results: RawPlace[] }>(
      `${BASE}/geocode/json`,
      { provider: 'google', query: { address, key: env.googleApiKey } },
    );
    const first = data.results[0];
    if (!first) throw ApiError.notFound(`No location found for "${address}".`);
    return first.geometry.location;
  },

  async searchPlaces(q: PlaceSearchQuery): Promise<Place[]> {
    assertConfigured();
    const data = await httpRequest<{ status: string; results: RawPlace[] }>(
      `${BASE}/place/textsearch/json`,
      {
        provider: 'google',
        query: {
          query: q.query,
          language: q.language ?? 'fr',
          key: env.googleApiKey,
          ...(q.near ? { location: `${q.near.lat},${q.near.lng}` } : {}),
          ...(q.near && q.radiusKm ? { radius: q.radiusKm * 1000 } : {}),
        },
      },
    );
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw ApiError.upstream('google', 502, { status: data.status });
    }
    return (data.results ?? []).map(mapPlace);
  },

  async placeDetails(placeId: string): Promise<Place> {
    assertConfigured();
    const data = await httpRequest<{ status: string; result: RawPlace }>(
      `${BASE}/place/details/json`,
      {
        provider: 'google',
        query: {
          place_id: placeId,
          language: 'fr',
          fields: 'place_id,name,formatted_address,geometry,rating,user_ratings_total,types,photos',
          key: env.googleApiKey,
        },
      },
    );
    if (!data.result) throw ApiError.notFound(`Place "${placeId}" not found.`);
    return mapPlace(data.result);
  },
};
