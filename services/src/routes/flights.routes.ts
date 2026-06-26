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

const OrderBody = z.object({
  offerId: z.string().min(3),
  passengers: z.array(z.object({
    title: z.string().optional(),
    givenName: z.string().min(1),
    familyName: z.string().min(1),
    bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    gender: z.string().optional(),
    email: z.string().email().optional(),
    phoneNumber: z.string().optional(),
  })).min(1),
});

/** POST /api/flights/order — issue a real flight order (Duffel; test balance in test mode). */
flightsRouter.post('/order', validate(OrderBody, 'body'), asyncHandler(async (req, res) => {
  if (!env.duffelApiKey) throw ApiError.serviceUnavailable('Réservation de vol indisponible.');
  const b = valid<z.infer<typeof OrderBody>>(req);
  res.status(201).json(await duffelService.createOrder(b));
}));

/** GET /api/flights/order/:id — read an order. */
flightsRouter.get('/order/:id', asyncHandler(async (req, res) => {
  res.json(await duffelService.getOrder(req.params['id']!));
}));

/** POST /api/flights/order/:id/cancel-quote — quote the refund (pending cancellation). */
flightsRouter.post('/order/:id/cancel-quote', asyncHandler(async (req, res) => {
  res.json(await duffelService.cancelQuote(req.params['id']!));
}));

/** POST /api/flights/order/cancel-confirm — confirm a pending cancellation. */
const CancelConfirm = z.object({ cancellationId: z.string().min(3) });
flightsRouter.post('/order/cancel-confirm', validate(CancelConfirm, 'body'), asyncHandler(async (req, res) => {
  const b = valid<z.infer<typeof CancelConfirm>>(req);
  res.json(await duffelService.cancelConfirm(b.cancellationId));
}));

/** POST /api/flights/order/:id/change-quote — quote a new departure date. */
const ChangeQuote = z.object({ departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), cabin: z.string().optional() });
flightsRouter.post('/order/:id/change-quote', validate(ChangeQuote, 'body'), asyncHandler(async (req, res) => {
  const b = valid<z.infer<typeof ChangeQuote>>(req);
  const q = await duffelService.changeQuote(req.params['id']!, b.departureDate, b.cabin || 'economy');
  if (!q) throw ApiError.badRequest('Aucune option de modification disponible pour cette date.');
  res.json(q);
}));

/** POST /api/flights/order/change-confirm — create + confirm the change. */
const ChangeConfirm = z.object({ changeOfferId: z.string().min(3) });
flightsRouter.post('/order/change-confirm', validate(ChangeConfirm, 'body'), asyncHandler(async (req, res) => {
  const b = valid<z.infer<typeof ChangeConfirm>>(req);
  res.json(await duffelService.changeConfirm(b.changeOfferId));
}));

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
