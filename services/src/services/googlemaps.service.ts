/**
 * Google Maps Platform — Places API (NEW) + Geocoding via Places.
 * Uses the modern Places API (places.googleapis.com/v1) which is the one newly
 * created Google Cloud projects can enable. Grounds Webbina's suggestions
 * (activities, hotels, restaurants) in real, rated places with photos.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/op-overview
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';
import type { GeoPoint, Place, PlaceSearchQuery } from '../types/index.js';

const BASE = 'https://places.googleapis.com/v1';

function assertConfigured(): void {
  if (!env.googleApiKey) {
    throw ApiError.serviceUnavailable(
      'google_not_configured',
      'Google key is not set. Define GOOGLE_CLOUD_API_KEY.',
    );
  }
}

/** New Places API photo media endpoint. */
function photoUrl(name: string, maxWidth = 720): string {
  return `${BASE}/${name}/media?maxWidthPx=${maxWidth}&key=${env.googleApiKey}`;
}

interface NewPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  photos?: { name: string }[];
}

function mapPlace(p: NewPlace): Place {
  const first = p.photos?.[0];
  return {
    id: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? p.shortFormattedAddress ?? '',
    location: p.location
      ? { lat: p.location.latitude, lng: p.location.longitude }
      : { lat: 0, lng: 0 },
    types: p.types ?? [],
    ...(p.rating !== undefined ? { rating: p.rating } : {}),
    ...(p.userRatingCount !== undefined ? { userRatingsTotal: p.userRatingCount } : {}),
    ...(first ? { photoUrl: photoUrl(first.name) } : {}),
  };
}

const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.photos',
].join(',');

export const googleMapsService = {
  /** Geocode via Places text search (avoids needing the separate Geocoding API). */
  async geocode(address: string): Promise<GeoPoint> {
    assertConfigured();
    const data = await httpRequest<{ places?: NewPlace[] }>(`${BASE}/places:searchText`, {
      method: 'POST',
      provider: 'google',
      query: { key: env.googleApiKey },
      headers: {
        'X-Goog-Api-Key': env.googleApiKey,
        'X-Goog-FieldMask': 'places.location,places.displayName',
      },
      body: { textQuery: address, languageCode: 'fr', maxResultCount: 1 },
    });
    const loc = data.places?.[0]?.location;
    if (!loc) throw ApiError.notFound(`No location found for "${address}".`);
    return { lat: loc.latitude, lng: loc.longitude };
  },

  async searchPlaces(q: PlaceSearchQuery): Promise<Place[]> {
    assertConfigured();
    const body: Record<string, unknown> = {
      textQuery: q.query,
      languageCode: q.language ?? 'fr',
      maxResultCount: 12,
    };
    if (q.near) {
      body['locationBias'] = {
        circle: {
          center: { latitude: q.near.lat, longitude: q.near.lng },
          radius: Math.min((q.radiusKm ?? 20) * 1000, 50000),
        },
      };
    }
    const data = await httpRequest<{ places?: NewPlace[] }>(`${BASE}/places:searchText`, {
      method: 'POST',
      provider: 'google',
      query: { key: env.googleApiKey },
      headers: {
        'X-Goog-Api-Key': env.googleApiKey,
        'X-Goog-FieldMask': SEARCH_FIELD_MASK,
      },
      body,
    });
    return (data.places ?? []).map(mapPlace);
  },

  async placeDetails(placeId: string): Promise<Place> {
    assertConfigured();
    const data = await httpRequest<NewPlace>(`${BASE}/places/${placeId}`, {
      method: 'GET',
      provider: 'google',
      query: { key: env.googleApiKey },
      headers: {
        'X-Goog-Api-Key': env.googleApiKey,
        'X-Goog-FieldMask':
          'id,displayName,formattedAddress,location,rating,userRatingCount,types,photos',
      },
    });
    if (!data.id) throw ApiError.notFound(`Place "${placeId}" not found.`);
    return mapPlace(data);
  },
};
