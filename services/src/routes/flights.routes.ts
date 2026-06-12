import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { amadeusService } from '../services/amadeus.service.js';
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
    const items = await amadeusService.searchFlights(q);
    res.json({ items, total: items.length });
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
    const items = await amadeusService.searchHotels(q);
    res.json({ items, total: items.length });
  }),
);
