import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { roadtripService } from '../services/roadtrip.service.js';
import { ApiError } from '../lib/ApiError.js';

export const roadtripRouter = Router();

const PlanBody = z.object({
  origin: z.string().min(2).max(120),
  region: z.string().min(2).max(120),
  mustSee: z.array(z.string().max(80)).max(12).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  travelers: z.coerce.number().int().min(1).max(12),
  mode: z.enum(['fly-drive', 'road']),
  originIata: z.string().min(3).max(4).optional(),
  hasCar: z.coerce.boolean().optional(),
  nightsPerCity: z.array(z.object({ city: z.string().max(80), nights: z.coerce.number().int().min(1).max(30) })).max(12).optional(),
});

/** POST /api/roadtrip/plan — generate a full multi-stop road-trip roadbook. */
roadtripRouter.post('/plan', validate(PlanBody, 'body'), asyncHandler(async (req, res) => {
  const b = valid<z.infer<typeof PlanBody>>(req);
  const plan = await roadtripService.plan(b);
  if (!plan) throw ApiError.serviceUnavailable('Webbina n\'a pas pu générer ce carnet de route. Réessayez.');
  res.json(plan);
}));

/** GET /api/roadtrip/hotels?city=&region= — REAL hotels near a city (Google
 *  Places): name, rating, address, coords (for the map). Price = estimate by
 *  rating until Duffel Stays / RateHawk are live. */
const HotelsQuery = z.object({ city: z.string().min(2).max(80), region: z.string().max(80).optional() });
roadtripRouter.get('/hotels', validate(HotelsQuery, 'query'), asyncHandler(async (req, res) => {
  const q = valid<z.infer<typeof HotelsQuery>>(req);
  const near = await googleMapsService.geocode(`${q.city}${q.region ? ', ' + q.region : ''}`);
  const places = await googleMapsService.searchPlaces({ query: `hôtel à ${q.city}`, near, radiusKm: 12 });
  const items = (places || []).filter((p) => p.location && p.location.lat).slice(0, 12).map((p) => {
    const r = p.rating || 3.5;
    // Estimate €/night from rating (indicative; real prices come with partners).
    const est = Math.round(45 + (r - 3) * 55 + (Math.min(p.userRatingsTotal || 0, 2000) / 2000) * 20);
    return {
      name: p.name || 'Hôtel', rating: p.rating || null, reviews: p.userRatingsTotal || 0,
      address: p.address || '', lat: p.location!.lat, lng: p.location!.lng,
      photo: p.photoUrl || null, pricePerNight: Math.max(40, est),
    };
  });
  res.json({ city: q.city, center: near, items });
}));

/** POST /api/roadtrip/suggest — light itinerary (cities + things to see, no pricing). */
roadtripRouter.post('/suggest', validate(PlanBody, 'body'), asyncHandler(async (req, res) => {
  const b = valid<z.infer<typeof PlanBody>>(req);
  const r = await roadtripService.suggest(b);
  if (!r.stops.length) throw ApiError.serviceUnavailable('Webbina n\'a pas pu proposer d\'itinéraire. Réessayez.');
  res.json(r);
}));

/** POST /api/roadtrip/options — several complete itineraries to COMPARE before booking. */
roadtripRouter.post('/options', validate(PlanBody, 'body'), asyncHandler(async (req, res) => {
  const b = valid<z.infer<typeof PlanBody>>(req);
  const options = await roadtripService.options(b);
  if (!options.length) throw ApiError.serviceUnavailable('Webbina n\'a pas pu générer d\'itinéraires. Réessayez.');
  res.json({ options });
}));
