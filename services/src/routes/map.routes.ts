import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { googleMapsService } from '../services/googlemaps.service.js';
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';

export const mapRouter = Router();

const Q = z.object({
  points: z.string().min(2).max(300),   // "Porto|Lisbonne|Faro"
  region: z.string().max(80).optional(),
  size: z.string().regex(/^\d{2,4}x\d{2,4}$/).optional(),
});

/** GET /api/map/route.png — static Google map with markers + path for a list of
 *  cities. Geocoded server-side; the Google key never leaves the backend. */
mapRouter.get('/route.png', validate(Q, 'query'), asyncHandler(async (req, res) => {
  if (!env.googleApiKey) throw ApiError.serviceUnavailable('Carte indisponible.');
  const q = valid<z.infer<typeof Q>>(req);
  const cities = q.points.split('|').map((c) => c.trim()).filter(Boolean).slice(0, 8);
  const suffix = q.region ? `, ${q.region}` : '';

  const coords: Array<{ lat: number; lng: number }> = [];
  for (const c of cities) {
    try { const g = await googleMapsService.geocode(c + suffix); if (g && g.lat != null && g.lng != null) coords.push({ lat: g.lat, lng: g.lng }); }
    catch { /* skip */ }
  }
  if (!coords.length) throw ApiError.badRequest('Villes introuvables.');

  const size = q.size || '640x360';
  const markers = coords.map((p, i) => `markers=color:0x1E63C7|label:${i + 1}|${p.lat},${p.lng}`).join('&');
  const path = coords.length > 1 ? `&path=color:0x1E63C7AA|weight:4|${coords.map((p) => `${p.lat},${p.lng}`).join('|')}` : '';
  const url = `https://maps.googleapis.com/maps/api/staticmap?size=${size}&scale=2&maptype=roadmap&${markers}${path}&key=${env.googleApiKey}`;

  try {
    const img = await fetch(url);
    if (!img.ok) throw new Error('static map ' + img.status);
    const buf = Buffer.from(await img.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e) {
    throw ApiError.upstream('google-staticmap', 502);
  }
}));
