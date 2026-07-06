/**
 * Itinerary engine — door-to-door, multimodal (like Google Maps).
 *
 * Real ground routing (origin address → hub: airport/station/port) via the
 * Google Routes API (computeRoutes). Returns leg-by-leg steps with exact
 * duration/distance for: TRANSIT (public transport), DRIVE, WALK.
 *
 * Long-distance BUS (BlaBlaBus/Flixbus) and CARPOOL (BlaBlaCar) have no public
 * booking API → we surface them as compared options with a direct search link
 * (honest, same pattern as our other affiliates).
 *
 * Requires the "Routes API" enabled in Google Cloud (same key as Places).
 */
import { env } from '../config/env.js';
import { httpRequest } from '../lib/httpClient.js';
import { ApiError } from '../lib/ApiError.js';

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

type GMode = 'TRANSIT' | 'DRIVE' | 'WALK' | 'BICYCLE';

export interface ItinStep {
  mode: string;            // walk | transit | drive | bus | rail | metro | tram
  instruction: string;
  durationMin: number;
  distanceKm?: number;
  line?: string;           // transit line short name
  vehicle?: string;        // BUS | SUBWAY | HEAVY_RAIL | TRAM …
  from?: string;
  to?: string;
}
export interface ItinOption {
  id: string;
  label: string;           // "Le plus rapide" | "Le moins cher" | …
  mode: GMode | 'BUS' | 'CARPOOL';
  durationMin: number;
  distanceKm: number;
  cost?: { amount: number; currency: string; estimated?: boolean };
  steps: ItinStep[];
  bookUrl?: string;        // external link for bus/carpool
  note?: string;
  profileFit?: string;     // why it suits the profile
}

function fieldMask(): string {
  return [
    'routes.duration',
    'routes.distanceMeters',
    'routes.legs.steps.travelMode',
    'routes.legs.steps.distanceMeters',
    'routes.legs.steps.staticDuration',
    'routes.legs.steps.navigationInstruction',
    'routes.legs.steps.transitDetails',
  ].join(',');
}

function vehicleToMode(v?: string): string {
  switch ((v || '').toUpperCase()) {
    case 'BUS': return 'bus';
    case 'SUBWAY': case 'METRO_RAIL': return 'metro';
    case 'TRAM': case 'LIGHT_RAIL': return 'tram';
    case 'HEAVY_RAIL': case 'RAIL': case 'HIGH_SPEED_TRAIN': case 'LONG_DISTANCE_TRAIN': return 'rail';
    default: return 'transit';
  }
}
const min = (iso?: string) => iso ? Math.max(1, Math.round(parseInt(iso.replace('s', ''), 10) / 60)) : 0;
const km = (m?: number) => m ? Math.round((m / 1000) * 10) / 10 : 0;

async function computeRoute(origin: string, destination: string, mode: GMode): Promise<ItinOption | null> {
  if (!env.googleApiKey) throw ApiError.serviceUnavailable('Itinéraire indisponible.');
  const body: Record<string, unknown> = {
    origin: { address: origin },
    destination: { address: destination },
    travelMode: mode,
    ...(mode === 'DRIVE' ? { routingPreference: 'TRAFFIC_AWARE' } : {}),
    ...(mode === 'TRANSIT' ? { transitPreferences: { routingPreference: 'LESS_WALKING' } } : {}),
    languageCode: 'fr-FR', units: 'METRIC',
  };
  let data: { routes?: Array<{ duration?: string; distanceMeters?: number; legs?: Array<{ steps?: Array<Record<string, unknown>> }> }> };
  try {
    data = await httpRequest(ROUTES_URL, {
      method: 'POST', provider: 'google-routes', timeoutMs: 20_000, retries: 1,
      headers: { 'X-Goog-Api-Key': env.googleApiKey, 'X-Goog-FieldMask': fieldMask() },
      body,
    });
  } catch { return null; }
  const r = data.routes?.[0];
  if (!r) return null;
  const steps: ItinStep[] = [];
  for (const leg of r.legs || []) {
    for (const s of leg.steps || []) {
      const tm = String(s['travelMode'] || '').toUpperCase();
      const td = s['transitDetails'] as Record<string, unknown> | undefined;
      const nav = s['navigationInstruction'] as Record<string, unknown> | undefined;
      if (tm === 'TRANSIT' && td) {
        const line = (td['transitLine'] as Record<string, unknown>) || {};
        const veh = ((line['vehicle'] as Record<string, unknown>) || {})['type'] as string | undefined;
        const stops = (td['stopDetails'] as Record<string, unknown>) || {};
        steps.push({
          mode: vehicleToMode(veh), vehicle: veh,
          line: (line['nameShort'] as string) || (line['name'] as string) || '',
          instruction: `${(line['nameShort'] as string) || 'Ligne'} → ${((stops['arrivalStop'] as Record<string, unknown>)?.['name'] as string) || ''}`,
          from: (stops['departureStop'] as Record<string, unknown>)?.['name'] as string,
          to: (stops['arrivalStop'] as Record<string, unknown>)?.['name'] as string,
          durationMin: min(s['staticDuration'] as string), distanceKm: km(s['distanceMeters'] as number),
        });
      } else {
        steps.push({
          mode: tm === 'WALK' ? 'walk' : tm === 'DRIVE' ? 'drive' : tm.toLowerCase(),
          instruction: (nav?.['instructions'] as string) || (tm === 'WALK' ? 'Marche' : tm === 'DRIVE' ? 'En voiture' : ''),
          durationMin: min(s['staticDuration'] as string), distanceKm: km(s['distanceMeters'] as number),
        });
      }
    }
  }
  // collapse consecutive walk steps for readability
  const merged: ItinStep[] = [];
  for (const s of steps) {
    const last = merged[merged.length - 1];
    if (s.mode === 'walk' && last && last.mode === 'walk') {
      last.durationMin += s.durationMin; last.distanceKm = (last.distanceKm || 0) + (s.distanceKm || 0);
    } else merged.push({ ...s });
  }
  return {
    id: mode.toLowerCase(), label: '', mode,
    durationMin: min(r.duration), distanceKm: km(r.distanceMeters),
    steps: merged.filter((s) => s.durationMin > 0 || s.mode !== 'walk'),
  };
}

/** Rough cost helpers (estimates, clearly flagged). */
function driveCost(distanceKm: number): number { return Math.round(distanceKm * 0.20); }      // ~fuel+wear
function busCost(distanceKm: number): number { return Math.max(5, Math.round(distanceKm * 0.07)); }
function carpoolCost(distanceKm: number): number { return Math.max(4, Math.round(distanceKm * 0.06)); }

function blablacarUrl(from: string, to: string): string {
  return `https://www.blablacar.fr/search?fn=${encodeURIComponent(from)}&tn=${encodeURIComponent(to)}`;
}
function busUrl(from: string, to: string): string {
  // Generic Flixbus/BlaBlaBus search (BlaBlaBus is operated by Flixbus).
  return `https://global.flixbus.com/track/searchresult?departureCity=${encodeURIComponent(from)}&arrivalCity=${encodeURIComponent(to)}`;
}
function parkingUrl(hub: string): string {
  return `https://www.parkos.fr/recherche/?q=${encodeURIComponent(hub)}`;
}
function transferUrl(from: string, to: string): string {
  // Kiwitaxi via Travelpayouts (affiliate). Configurable; falls back to the
  // generic GetTransfer search if no affiliate link is set.
  if (env.kiwitaxiUrl) return env.kiwitaxiUrl;
  return `https://gettransfer.com/en?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

/** Build the compared ground options between two points (shared by to/from hub). */
async function groundOptions(from: string, to: string, profile: { family?: boolean; budget?: boolean; pax?: number } = {}, opts: { side: 'depart' | 'arrive' } = { side: 'depart' }): Promise<ItinOption[]> {
  const [transit, drive] = await Promise.all([
    computeRoute(from, to, 'TRANSIT'),
    computeRoute(from, to, 'DRIVE'),
  ]);
  const options: ItinOption[] = [];
  const pax = profile.pax || 1;

  if (transit) {
    transit.label = 'Transports en commun';
    transit.cost = { amount: Math.max(2, Math.round(2.2 * Math.min(pax, 5))), currency: 'EUR', estimated: true };
    transit.profileFit = profile.budget ? 'Économique' : 'Sans voiture, écologique';
    options.push(transit);
  }
  if (drive) {
    drive.label = opts.side === 'depart' ? 'En voiture (dépose ou parking)' : 'Voiture de location / taxi';
    drive.cost = { amount: driveCost(drive.distanceKm), currency: 'EUR', estimated: true };
    drive.profileFit = profile.family ? 'Le plus simple en famille (porte-à-porte, bagages)' : 'Direct, flexible';
    options.push(drive);
  }

  const dist = drive?.distanceKm || transit?.distanceKm || 0;

  if (opts.side === 'arrive') {
    // Private transfer (door-to-door at arrival) — great for families/late arrivals.
    options.push({
      id: 'transfer', label: 'Transfert privé / taxi', mode: 'DRIVE',
      durationMin: drive?.durationMin || 30, distanceKm: dist,
      cost: { amount: Math.max(15, Math.round(dist * 1.6)) , currency: 'EUR', estimated: true },
      steps: [{ mode: 'drive', instruction: `Transfert privé ${from} → ${to}`, durationMin: drive?.durationMin || 30 }],
      bookUrl: transferUrl(from, to),
      profileFit: 'Porte-à-porte, idéal avec enfants ou arrivée de nuit', note: 'Prix indicatif — confirmé par le prestataire de transfert.',
    });
  } else {
    // Airport parking (you drive and leave the car) — only on departure side.
    if (drive) {
      options.push({
        id: 'parking', label: 'Voiture + parking aéroport', mode: 'DRIVE',
        durationMin: drive.durationMin, distanceKm: drive.distanceKm,
        cost: { amount: driveCost(drive.distanceKm) + 8, currency: 'EUR', estimated: true },
        steps: [
          { mode: 'drive', instruction: `Route vers ${to}`, durationMin: drive.durationMin, distanceKm: drive.distanceKm },
          { mode: 'parking', instruction: 'Stationnement longue durée à l\'aéroport', durationMin: 0 },
        ],
        bookUrl: parkingUrl(to),
        profileFit: 'Vous gardez votre voiture sur place', note: 'Tarif parking selon durée — réservez à l\'avance pour économiser.',
      });
    }
  }

  if (dist >= 40) {
    options.push({
      id: 'bus', label: 'Bus (BlaBlaBus / Flixbus)', mode: 'BUS',
      durationMin: Math.round((drive?.durationMin || 60) * 1.5), distanceKm: dist,
      cost: { amount: busCost(dist) * pax, currency: 'EUR', estimated: true },
      steps: [{ mode: 'bus', instruction: `Bus longue distance ${from} → ${to}`, durationMin: Math.round((drive?.durationMin || 60) * 1.5) }],
      bookUrl: busUrl(from, to),
      profileFit: 'Le moins cher', note: 'Horaires et prix à confirmer chez le transporteur.',
    });
    options.push({
      id: 'carpool', label: 'Covoiturage (BlaBlaCar)', mode: 'CARPOOL',
      durationMin: drive?.durationMin || 60, distanceKm: dist,
      cost: { amount: carpoolCost(dist) * pax, currency: 'EUR', estimated: true },
      steps: [{ mode: 'drive', instruction: `Covoiturage ${from} → ${to}`, durationMin: drive?.durationMin || 60 }],
      bookUrl: blablacarUrl(from, to),
      profileFit: 'Convivial et économique', note: 'Trajets proposés par des particuliers — disponibilités variables.',
    });
  }

  // Tag fastest + cheapest.
  if (options.length) {
    const fastest = options.reduce((a, b) => (b.durationMin < a.durationMin ? b : a));
    fastest.label = `${fastest.label} · le plus rapide`;
    const priced = options.filter((o) => o.cost);
    if (priced.length) {
      const cheapest = priced.reduce((a, b) => ((b.cost!.amount) < (a.cost!.amount) ? b : a));
      if (cheapest !== fastest) cheapest.label = `${cheapest.label} · le moins cher`;
    }
  }
  return options;
}

export const itineraryService = {
  /** Simple city→city driving leg (duration + distance), for the road-trip planner. */
  async driveLeg(from: string, to: string): Promise<{ durationMin: number; distanceKm: number } | null> {
    const r = await computeRoute(from, to, 'DRIVE');
    return r ? { durationMin: r.durationMin, distanceKm: r.distanceKm } : null;
  },

  /** Door → hub (reach the first transport), several options, profile-aware. */
  async toHub(input: { origin: string; hub: string; profile?: { family?: boolean; budget?: boolean; pax?: number } }): Promise<{ origin: string; hub: string; options: ItinOption[] }> {
    const options = await groundOptions(input.origin, input.hub, input.profile || {}, { side: 'depart' });
    return { origin: input.origin, hub: input.hub, options };
  },

  /** Hub → final destination/hotel (last mile at arrival). */
  async fromHub(input: { hub: string; destination: string; profile?: { family?: boolean; budget?: boolean; pax?: number } }): Promise<{ hub: string; destination: string; options: ItinOption[] }> {
    const options = await groundOptions(input.hub, input.destination, input.profile || {}, { side: 'arrive' });
    return { hub: input.hub, destination: input.destination, options };
  },

  /** Full door-to-door: origin → departure hub … arrival hub → destination. */
  async full(input: { origin: string; departHub: string; arriveHub: string; destination: string; profile?: { family?: boolean; budget?: boolean; pax?: number } }): Promise<{ toHub: ItinOption[]; fromHub: ItinOption[] }> {
    const [a, b] = await Promise.all([
      groundOptions(input.origin, input.departHub, input.profile || {}, { side: 'depart' }),
      groundOptions(input.arriveHub, input.destination, input.profile || {}, { side: 'arrive' }),
    ]);
    return { toHub: a, fromHub: b };
  },
};
