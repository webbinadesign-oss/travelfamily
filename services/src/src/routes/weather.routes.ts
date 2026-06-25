import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { weatherService } from '../services/weather.service.js';
import { googleMapsService } from '../services/googlemaps.service.js';
import type { WeatherQuery } from '../types/index.js';

export const weatherRouter = Router();

const ByCoords = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  lang: z.string().optional(),
  units: z.enum(['metric', 'imperial']).optional(),
});

/** GET /api/weather?lat=&lng= */
weatherRouter.get(
  '/',
  validate(ByCoords, 'query'),
  asyncHandler(async (req, res) => {
    const q = valid<WeatherQuery>(req);
    res.json(await weatherService.getWeather(q));
  }),
);

/** GET /api/weather/by-place?place=Bali — geocodes then fetches weather. */
weatherRouter.get(
  '/by-place',
  validate(z.object({ place: z.string().min(2), lang: z.string().optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const { place, lang } = valid<{ place: string; lang?: string }>(req);
    const geo = await googleMapsService.geocode(place);
    res.json(await weatherService.getWeather({ lat: geo.lat, lng: geo.lng, ...(lang ? { lang } : {}) }));
  }),
);
