import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { googleMapsService } from '../services/googlemaps.service.js';
import type { PlaceSearchQuery } from '../types/index.js';

export const placesRouter = Router();

const SearchQuery = z.object({
  query: z.string().min(2).max(200),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(1).max(50).optional(),
  language: z.string().optional(),
});

placesRouter.get(
  '/search',
  validate(SearchQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = valid<{ query: string; lat?: number; lng?: number; radiusKm?: number; language?: string }>(req);
    const params: PlaceSearchQuery = {
      query: q.query,
      ...(q.lat !== undefined && q.lng !== undefined ? { near: { lat: q.lat, lng: q.lng } } : {}),
      ...(q.radiusKm ? { radiusKm: q.radiusKm } : {}),
      ...(q.language ? { language: q.language } : {}),
    };
    const items = await googleMapsService.searchPlaces(params);
    res.json({ items, total: items.length });
  }),
);

placesRouter.get(
  '/geocode',
  validate(z.object({ address: z.string().min(2) }), 'query'),
  asyncHandler(async (req, res) => {
    const { address } = valid<{ address: string }>(req);
    res.json(await googleMapsService.geocode(address));
  }),
);

placesRouter.get(
  '/:placeId',
  asyncHandler(async (req, res) => {
    res.json(await googleMapsService.placeDetails(req.params.placeId));
  }),
);
