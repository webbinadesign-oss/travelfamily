import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { env } from '../config/env.js';
import { duffelService } from '../services/duffel.service.js';
import { amadeusService } from '../services/amadeus.service.js';
import { ApiError } from '../lib/ApiError.js';
import type { FlightSearchQuery, HotelSearchQuery } from '../types/index.js';

export const flightsRouter = Router();

const FlightQuery = z.object({
  origin: z.string().length(3),
  destination: z.string().length(3),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  adults: z.coerce.number().int().min(1).max(9),
  children: z.coerce.number().int().min(0).max(9).optional(),
  infants: z.coerce.number().int().min(0).max(9).optional(),
  travelClass: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']).optional(),
  nonStop: z.coerce.boolean().optional(),
  currencyCode: z.string().length(3).optional(),
  maxResults: z.coerce.number().int().min(1).max(50).optional(),
});

flightsRouter.get(
  '/search',
  validate(FlightQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = valid<FlightSearchQuery>(req);
    // Prefer Duffel (current provider); fall back to Amadeus if only that is set.
    const items = env.duffelApiKey
      ? await duffelService.searchFlights(q)
      : await amadeusService.searchFlights(q);
    res.json({ items, total: items.length, provider: env.duffelApiKey ? 'duffel' : 'amadeus' });
  }),
);

const HotelQuery = z.object({
  cityCode: z.string().length(3),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).max(9),
  roomQuantity: z.coerce.number().int().min(1).max(9).optional(),
  radiusKm: z.coerce.number().int().min(1).max(100).optional(),
  currencyCode: z.string().length(3).optional(),
});

flightsRouter.get(
  '/hotels',
  validate(HotelQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = valid<HotelSearchQuery>(req);
    // Duffel is flights-only here; hotels still come from Amadeus when configured.
    if (!env.amadeusApiKey || !env.amadeusApiSecret) {
      throw ApiError.serviceUnavailable('hotels_not_configured', 'La recherche d\'hôtels nécessite des clés Amadeus (ou un futur service hôtels).');
    }
    const items = await amadeusService.searchHotels(q);
    res.json({ items, total: items.length });
  }),
);
