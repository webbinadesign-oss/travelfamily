import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { env } from '../config/env.js';
import { duffelService } from '../services/duffel.service.js';
import { duffelStaysService } from '../services/duffel-stays.service.js';
import { kiwiService } from '../services/kiwi.service.js';
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
    // Query the configured providers IN PARALLEL and merge.
    //  - Duffel: full-service carriers, bookable in-app.
    //  - Kiwi/Tequila: low-cost carriers (Ryanair, easyJet, Transavia…).
    // Either one failing must not kill the whole search.
    const tasks: Array<Promise<{ src: string; offers: import('../types/index.js').FlightOffer[] }>> = [];
    if (env.duffelApiKey) {
      tasks.push(
        duffelService.searchFlights(q)
          .then((offers) => ({ src: 'duffel', offers: offers.map((o) => ({ ...o, source: 'duffel' })) }))
          .catch(() => ({ src: 'duffel', offers: [] })),
      );
    } else if (env.amadeusApiKey && env.amadeusApiSecret) {
      tasks.push(
        amadeusService.searchFlights(q)
          .then((offers) => ({ src: 'amadeus', offers: offers.map((o) => ({ ...o, source: 'amadeus' })) }))
          .catch(() => ({ src: 'amadeus', offers: [] })),
      );
    }
    if (env.kiwiApiKey) {
      tasks.push(
        kiwiService.searchFlights(q)
          .then((offers) => ({ src: 'kiwi', offers }))
          .catch(() => ({ src: 'kiwi', offers: [] })),
      );
    }
    if (tasks.length === 0) {
      throw ApiError.serviceUnavailable('flights_not_configured', 'Aucune source de vols configurée (Duffel, Kiwi ou Amadeus).');
    }
    const settled = await Promise.all(tasks);
    const providers = settled.filter((s) => s.offers.length).map((s) => s.src);
    const merged = settled.flatMap((s) => s.offers).sort((a, b) => a.price.amount - b.price.amount);
    const items = merged.slice(0, q.maxResults ?? 20);
    res.json({ items, total: items.length, provider: providers.join('+') || 'none', providers });
  }),
);

const HotelQuery = z.object({
  cityCode: z.string().length(3).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).max(9),
  children: z.coerce.number().int().min(0).max(9).optional(),
  roomQuantity: z.coerce.number().int().min(1).max(9).optional(),
  radiusKm: z.coerce.number().int().min(1).max(100).optional(),
  currencyCode: z.string().length(3).optional(),
});

flightsRouter.get(
  '/hotels',
  validate(HotelQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = valid<HotelSearchQuery>(req);
    // Duffel Stays (geo search) is the current provider when lat/lng are given.
    if (env.duffelApiKey && q.lat !== undefined && q.lng !== undefined) {
      const items = await duffelStaysService.searchHotels(q);
      res.json({ items, total: items.length, provider: 'duffel-stays' });
      return;
    }
    // Fallback: Amadeus by cityCode, if configured.
    if (env.amadeusApiKey && env.amadeusApiSecret && q.cityCode) {
      const items = await amadeusService.searchHotels(q);
      res.json({ items, total: items.length, provider: 'amadeus' });
      return;
    }
    throw ApiError.serviceUnavailable('hotels_not_configured', 'La recherche d\'hôtels nécessite des coordonnées (lat/lng) avec Duffel Stays, ou des clés Amadeus avec un cityCode.');
  }),
);
