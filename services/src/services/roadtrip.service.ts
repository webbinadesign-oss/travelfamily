/**
 * Road-trip / multi-stop itinerary planner — Webbina's flagship "carnet de route".
 *
 * Produces a complete multi-city trip that ChatGPT can't: a Gemini-generated
 * day-by-day plan ENRICHED with real data:
 *   • Cheapest flights compared across candidate airports (Travelpayouts).
 *   • Real driving legs between cities (Google Routes: time + distance).
 *   • Car rental estimate (per-day) + Discover Cars link.
 *   • Per-city hotel price COMPARISON (3 tiers) — honest estimates until
 *     RateHawk/Duffel Stays are live.
 *   • Fuel + tolls estimate.
 *   • Full budget breakdown.
 *
 * Everything is clearly flagged real vs estimate. Never invents a bookable price.
 */
import { geminiService } from './gemini.service.js';
import { openaiService } from './openai.service.js';
import { travelpayoutsService } from './travelpayouts.service.js';
import { itineraryService } from './itinerary.service.js';
import { logger } from '../lib/logger.js';

export interface RoadStop {
  city: string;
  airportIata?: string;      // if this city has an airport (arrival/return)
  nights: number;
  summary: string;           // one-line why this stop
  days: Array<{ date?: string; title: string; items: string[] }>;
  hotels: Array<{ tier: 'éco' | 'confort' | 'premium'; name: string; pricePerNight: number; note?: string }>;
  driveFromPrev?: { from: string; to: string; durationMin: number; distanceKm: number; real: boolean };
}
export interface RoadTripPlan {
  strategy?: string;
  label?: string;
  angle?: string;
  hotelTier?: 'éco' | 'confort' | 'premium';
  title: string;
  origin: string;
  region: string;
  startDate?: string;
  endDate?: string;
  travelers: number;
  mode: 'fly-drive' | 'road';
  flight?: { origin: string; arrival: string; return?: string; price: number; currency: string; real: boolean; airport: string; lowcost?: boolean; note?: string; compared?: Array<{ iata: string; price: number }> };
  access?: { mode: string; label: string; durationMin: number; cost: number; currency: string; bookUrl?: string; note?: string; real: boolean };
  car?: { days: number; perDay: number; total: number; category: string; bookUrl: string };
  stops: RoadStop[];
  drivingTotalKm: number;
  fuelEstimate?: { amount: number; currency: string };
  tollsEstimate?: { amount: number; currency: string };
  budget: { flights: number; car: number; hotels: number; fuel: number; tolls: number; activities: number; access: number; total: number; perPerson: number; currency: string };
  notes: string[];
  source: 'webbina';
  generatedAt: string;
}

const num = (v: unknown, d = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/** Hard time-box any upstream call so nothing can hang the whole generation. */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}

/* Shared caches so generating 3 variants doesn't re-hit Google/TP for the same
   city pair or airport. Reset per request batch. */
type LegCache = Map<string, { durationMin: number; distanceKm: number } | null>;
type FareCache = Map<string, number | null>;

async function cachedLeg(cache: LegCache, from: string, to: string): Promise<{ durationMin: number; distanceKm: number } | null> {
  const key = `${from}|${to}`.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  let leg: { durationMin: number; distanceKm: number } | null = null;
  leg = await withTimeout(itineraryService.driveLeg(from, to), 7000, null);
  cache.set(key, leg);
  return leg;
}
async function cachedFare(cache: FareCache, origin: string, dest: string, start?: string, end?: string): Promise<number | null> {
  const key = `${origin}|${dest}|${start || ''}|${end || ''}`;
  if (cache.has(key)) return cache.get(key)!;
  // Travelpayouts only — fast, cached, and already includes low-cost carriers
  // (Ryanair, easyJet, Transavia…). Duffel per-cell was far too slow for the grid.
  let min: number | null = null;
  if (travelpayoutsService.configured()) {
    const fares = await withTimeout(travelpayoutsService.cheapestForRoute({
      origin, destination: dest,
      ...(start ? { departureDate: start } : {}), ...(end ? { returnDate: end } : {}),
      oneWay: !end, limit: 3,
    }), 6000, [] as Awaited<ReturnType<typeof travelpayoutsService.cheapestForRoute>>);
    if (fares.length) min = fares[0]!.price;
  }
  cache.set(key, min);
  return min;
}

/** Ask Gemini for 3 DISTINCT complete itinerary variants to compare. */
async function generateVariants(input: RoadTripInput): Promise<Array<{ strategy: string; label: string; angle: string; title: string; stops: RoadStop[]; notes: string[] }>> {
  const must = (input.mustSee || []).join(', ');
  const prompt = `Tu es une experte du voyage. Conçois TROIS itinéraires DISTINCTS et complets pour le MÊME voyage, afin que le client compare et choisisse.
Contexte : départ de "${input.origin}", région/pays "${input.region}", du ${input.startDate || '?'} au ${input.endDate || '?'}, ${input.travelers} voyageur(s), mode "${input.mode === 'road' ? 'road trip en voiture depuis le domicile' : 'avion + location de voiture sur place'}".
Villes indispensables (à inclure dans CHAQUE variante) : ${must || 'choisis les plus belles'}.

Les 3 variantes doivent être VRAIMENT différentes :
1) "eco" = Le plus économique : hôtels simples, étapes optimisées, moins de villes secondaires, budget serré.
2) "balanced" = Le mieux équilibré : bon rapport confort/prix, rythme agréable, hôtels confort.
3) "comfort" = Le plus confortable : hôtels haut de gamme, moins de route par jour, plus de temps sur place, quelques étapes premium en plus.

Contraintes : étapes de route raisonnables (idéalement <4-5h/jour), nuits bien réparties. Si "avion + voiture", indique l'aéroport (airportIata) des villes qui en ont un.

Réponds STRICTEMENT en JSON compact, sans texte autour. Sois CONCIS : max 2 items par jour, phrases courtes.
{"variants":[{"strategy":"eco","label":"Le plus économique","angle":"phrase courte","title":"...","stops":[{"city":"Porto","airportIata":"OPO|null","nights":2,"summary":"phrase courte","days":[{"title":"...","items":["v1","v2"]}],"hotels":[{"tier":"éco","name":"...","pricePerNight":65},{"tier":"confort","name":"...","pricePerNight":105},{"tier":"premium","name":"...","pricePerNight":175}]}],"notes":["conseil"]}, {...balanced...}, {...comfort...}]}
Prix hôtels/nuit réalistes. Toujours 3 tiers d'hôtel par ville. Reste bref pour tenir dans la réponse.`;

  try {
    let j = (await withTimeout(geminiService.generateJSON(prompt), 48000, null)) as any;
    let arr = Array.isArray(j?.variants) ? j.variants : (Array.isArray(j) ? j : []);
    // Fallback: if Gemini is rate-limited (429) or returns nothing, use OpenAI.
    if (!arr.length) {
      try {
        j = (await withTimeout(openaiService.generateJSON(prompt), 35000, null)) as any;
        arr = Array.isArray(j?.variants) ? j.variants : (Array.isArray(j) ? j : []);
      } catch { /* openai not configured or failed */ }
    }
    const out = arr.map((v: any) => ({
      strategy: String(v.strategy || 'balanced'),
      label: String(v.label || 'Itinéraire'),
      angle: String(v.angle || ''),
      title: String(v.title || `Voyage ${input.region}`),
      notes: Array.isArray(v.notes) ? v.notes.map((n: any) => String(n)) : [],
      stops: (Array.isArray(v.stops) ? v.stops : []).map((s: any) => ({
        city: String(s.city || '').trim(),
        airportIata: s.airportIata && String(s.airportIata).length === 3 ? String(s.airportIata).toUpperCase() : undefined,
        nights: Math.max(0, num(s.nights, 1)),
        summary: String(s.summary || ''),
        days: Array.isArray(s.days) ? s.days.map((d: any) => ({ title: String(d.title || ''), items: (Array.isArray(d.items) ? d.items : []).map((x: any) => String(x)) })) : [],
        hotels: Array.isArray(s.hotels) ? s.hotels.slice(0, 3).map((h: any) => ({
          tier: (['éco', 'confort', 'premium'].includes(h.tier) ? h.tier : 'confort') as RoadStop['hotels'][0]['tier'],
          name: String(h.name || 'Hôtel'), pricePerNight: num(h.pricePerNight, 90),
        })) : [],
      })).filter((s: RoadStop) => s.city),
    })).filter((v: any) => v.stops.length);
    return out.slice(0, 3);
  } catch (e) {
    logger.warn('roadtrip variants failed', { err: String(e) });
    return [];
  }
}

const HOTEL_FOR: Record<string, 'éco' | 'confort' | 'premium'> = { eco: 'éco', balanced: 'confort', comfort: 'premium' };

const AIRPORT_LABEL: Record<string, string> = {
  MPL: 'Aéroport de Montpellier', MRS: 'Aéroport de Marseille', TLS: 'Aéroport de Toulouse',
  NCE: 'Aéroport de Nice', LYS: 'Aéroport de Lyon Saint-Exupéry', BOD: 'Aéroport de Bordeaux',
  PGF: 'Aéroport de Perpignan', BCN: 'Aéroport de Barcelone', GRO: 'Aéroport de Gérone',
  GVA: 'Aéroport de Genève', NTE: 'Aéroport de Nantes', CDG: 'Aéroport Paris Charles de Gaulle',
  ORY: 'Aéroport Paris Orly', BRU: 'Aéroport de Bruxelles',
};

/* Airports with coords → pick those within ~3h drive of the traveller's home. */
const AIRPORTS_GEO: Array<{ iata: string; lat: number; lng: number }> = [
  { iata: 'MPL', lat: 43.58, lng: 3.96 }, { iata: 'MRS', lat: 43.44, lng: 5.22 },
  { iata: 'TLS', lat: 43.63, lng: 1.37 }, { iata: 'NCE', lat: 43.66, lng: 7.21 },
  { iata: 'LYS', lat: 45.72, lng: 5.08 }, { iata: 'BOD', lat: 44.83, lng: -0.72 },
  { iata: 'PGF', lat: 42.74, lng: 2.87 }, { iata: 'BCN', lat: 41.30, lng: 2.08 },
  { iata: 'GRO', lat: 41.90, lng: 2.76 }, { iata: 'GVA', lat: 46.24, lng: 6.11 },
  { iata: 'NTE', lat: 47.15, lng: -1.61 }, { iata: 'CDG', lat: 49.01, lng: 2.55 },
  { iata: 'ORY', lat: 48.72, lng: 2.38 }, { iata: 'BRU', lat: 50.90, lng: 4.48 },
  { iata: 'MRS', lat: 43.44, lng: 5.22 },
];
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
/** Nearest airports to a home city (geocoded), within ~300 km (≈3h drive). */
async function nearestAirports(home: string): Promise<string[]> {
  try {
    const g = await googleMapsService.geocode(home);
    if (g && g.lat != null && g.lng != null) {
      const ranked = AIRPORTS_GEO
        .map((ap) => ({ iata: ap.iata, km: haversineKm(g, ap) }))
        .filter((x) => x.km <= 300)
        .sort((a, b) => a.km - b.km);
      const uniq: string[] = [];
      for (const r of ranked) if (!uniq.includes(r.iata)) uniq.push(r.iata);
      if (uniq.length) return uniq.slice(0, 3);
    }
  } catch { /* fall through */ }
  return ['MPL', 'MRS', 'TLS']; // sensible default (south of France)
}

/** Home → departure airport access. hasCar → parking; else transit/bus/carpool.
 *  Cached by (home|airport|hasCar) so it's computed once across variants. */
type AccessCache = Map<string, RoadTripPlan['access']>;
async function airportAccess(home: string, iata: string, hasCar: boolean, pax: number, cache: AccessCache): Promise<RoadTripPlan['access']> {
  const key = `${home}|${iata}|${hasCar}`.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  let result: RoadTripPlan['access'];
  try {
    const hub = AIRPORT_LABEL[iata] || `aéroport ${iata}`;
    const { options } = await withTimeout(itineraryService.toHub({ origin: home, hub, profile: { pax } }), 8000, { origin: home, hub, options: [] as Awaited<ReturnType<typeof itineraryService.toHub>>['options'] });
    let pick: typeof options[0] | undefined;
    if (hasCar) pick = options.find((o) => o.id === 'parking') || options.find((o) => o.mode === 'DRIVE');
    else {
      const ground = options.filter((o) => o.id !== 'parking' && o.mode !== 'DRIVE');
      pick = ground.filter((o) => o.cost).sort((a, b) => (a.cost!.amount) - (b.cost!.amount))[0] || ground[0];
    }
    if (pick) {
      result = {
        mode: pick.mode, label: pick.label.replace(/ · le plus.*$/, ''),
        durationMin: pick.durationMin, cost: (pick.cost && pick.cost.amount) || 0,
        currency: (pick.cost && pick.cost.currency) || 'EUR',
        ...(pick.bookUrl ? { bookUrl: pick.bookUrl } : {}), ...(pick.note ? { note: pick.note } : {}),
        real: true,
      };
    }
  } catch { /* optional */ }
  cache.set(key, result);
  return result;
}
const CAR_FOR: Record<string, { cat: string; perDay: number }> = {
  eco: { cat: 'Économique', perDay: 42 }, balanced: { cat: 'Compacte', perDay: 55 }, comfort: { cat: 'SUV / Confort', perDay: 78 },
};

/** Enrich one variant skeleton with real driving legs, cheapest flight, budget. */
async function enrichVariant(
  v: { strategy: string; label: string; angle: string; title: string; stops: RoadStop[]; notes: string[] },
  input: RoadTripInput, legCache: LegCache, fareCache: FareCache, accessCache: AccessCache,
): Promise<RoadTripPlan> {
  const stops = v.stops;
  const pax = Math.max(1, input.travelers);
  const currency = 'EUR';
  const totalNights = stops.reduce((s, st) => s + st.nights, 0);
  const days = totalNights + 1;
  const chosenTier = HOTEL_FOR[v.strategy] || 'confort';

  // 1) Real driving legs between stops (cached, computed IN PARALLEL).
  let drivingTotalKm = 0;
  const legResults = await Promise.all(
    stops.slice(1).map((_, idx) => {
      const from = stops[idx]!.city, to = stops[idx + 1]!.city;
      return cachedLeg(legCache, `${from}, ${input.region}`, `${to}, ${input.region}`).then((leg) => ({ i: idx + 1, from, to, leg }));
    }),
  );
  for (const { i, from, to, leg } of legResults) {
    if (leg) { stops[i]!.driveFromPrev = { from, to, durationMin: leg.durationMin, distanceKm: leg.distanceKm, real: true }; drivingTotalKm += leg.distanceKm; }
  }

  // 2) Cheapest flight (fly-drive) — compare arrival airports AND, if origin is
  //    "AUTO", several candidate departure airports to find the cheapest overall.
  let flight: RoadTripPlan['flight'];
  if (input.mode === 'fly-drive' && input.originIata) {
    const arrivals = (stops.map((s) => s.airportIata).filter(Boolean) as string[]).slice(0, 2);
    const origins = input.originIata === 'AUTO' ? (input.originAirports || ['MPL', 'MRS', 'TLS']) : [input.originIata];
    const pairs: Array<{ o: string; a: string }> = [];
    for (const o of origins) for (const a of arrivals) pairs.push({ o, a });
    const fares = await Promise.all(pairs.map((p) => cachedFare(fareCache, p.o, p.a, input.startDate, input.endDate).then((price) => ({ ...p, price }))));
    // Best price per departure airport → the "compared" list the user sees.
    const perOrigin = new Map<string, number>();
    for (const f of fares) if (f.price != null) { const cur = perOrigin.get(f.o); if (cur == null || f.price < cur) perOrigin.set(f.o, f.price); }
    const compared = origins
      .filter((o) => perOrigin.has(o))
      .map((o) => ({ iata: o, price: Math.round(perOrigin.get(o)! * pax) }))
      .sort((a, b) => a.price - b.price);
    let best: { o: string; a: string; price: number } | null = null;
    for (const f of fares) if (f.price != null && (!best || f.price < best.price)) best = { o: f.o, a: f.a, price: f.price };
    if (best) flight = { origin: best.o, arrival: best.a, price: best.price * pax, currency, real: true, airport: best.a, lowcost: true, note: 'Tarif de base (souvent low-cost) : bagage cabine généralement inclus, bagage en soute en option — à ajouter au moment de la réservation. Conditions de modification/annulation selon la compagnie.', ...(compared.length > 1 ? { compared } : {}) };
    else if (arrivals.length) flight = { origin: origins[0]!, arrival: arrivals[0]!, price: 0, currency, real: false, airport: arrivals[0]! };
  }

  // 2b) Home → departure airport access (parking if personal car, else transit/bus/carpool).
  let access: RoadTripPlan['access'];
  if (input.mode === 'fly-drive' && flight) {
    access = await airportAccess(input.origin, flight.origin, !!input.hasCar, pax, accessCache);
  }

  // 3) Car rental estimate by strategy.
  let car: RoadTripPlan['car'];
  if (input.mode === 'fly-drive') {
    const c = CAR_FOR[v.strategy] || CAR_FOR.balanced;
    car = { days, perDay: c.perDay, total: c.perDay * days, category: c.cat, bookUrl: 'https://www.discovercars.com/?a_aid=TravelFamily' };
  }

  // 4) Fuel + tolls (real distance; road mode adds home↔region).
  let roadKm = drivingTotalKm;
  if (input.mode === 'road' && stops.length) {
    const [inLeg, outLeg] = await Promise.all([
      cachedLeg(legCache, input.origin, `${stops[0]!.city}, ${input.region}`),
      cachedLeg(legCache, `${stops[stops.length - 1]!.city}, ${input.region}`, input.origin),
    ]);
    roadKm += (inLeg?.distanceKm || 0) + (outLeg?.distanceKm || 0);
  }
  const fuel = Math.round((roadKm / 100) * 7 * 1.75);
  const tolls = Math.round(roadKm * 0.07);

  // 5) Hotels by strategy tier.
  const rooms = Math.max(1, Math.ceil(pax / 2));
  const hotelsBudget = stops.reduce((sum, s) => {
    const h = s.hotels.find((x) => x.tier === chosenTier) || s.hotels[0];
    return sum + (h ? h.pricePerNight * s.nights : 0);
  }, 0) * rooms;

  const perDayAct = v.strategy === 'comfort' ? 30 : v.strategy === 'eco' ? 12 : 20;
  const activities = stops.reduce((s, st) => s + st.days.length, 0) * perDayAct * pax;

  const flights = flight?.price || 0;
  const carTotal = car?.total || 0;
  const accessCost = access?.cost || 0;
  const total = flights + carTotal + hotelsBudget + fuel + tolls + activities + accessCost;

  return {
    strategy: v.strategy, label: v.label, angle: v.angle,
    title: v.title, origin: input.origin, region: input.region,
    ...(input.startDate ? { startDate: input.startDate } : {}),
    ...(input.endDate ? { endDate: input.endDate } : {}),
    travelers: pax, mode: input.mode, hotelTier: chosenTier,
    ...(flight ? { flight } : {}), ...(car ? { car } : {}), ...(access ? { access } : {}),
    stops, drivingTotalKm: Math.round(roadKm),
    fuelEstimate: { amount: fuel, currency }, tollsEstimate: { amount: tolls, currency },
    budget: {
      flights: Math.round(flights), car: Math.round(carTotal), hotels: Math.round(hotelsBudget),
      fuel, tolls, activities: Math.round(activities), access: Math.round(accessCost),
      total: Math.round(total), perPerson: Math.round(total / pax), currency,
    },
    notes: v.notes, source: 'webbina', generatedAt: new Date().toISOString(),
  };
}

export interface RoadTripInput {
  origin: string;              // home city
  region: string;              // country / region
  mustSee?: string[];
  startDate?: string;
  endDate?: string;
  travelers: number;
  mode: 'fly-drive' | 'road';
  originIata?: string;         // nearest airport to home (for fly-drive)
  originAirports?: string[];   // resolved candidate departure airports (AUTO)
  hasCar?: boolean;            // personal car? → parking, else transit/bus/carpool
}

export const roadtripService = {
  /** Generate SEVERAL complete itinerary options to compare BEFORE booking. */
  async options(input: RoadTripInput): Promise<RoadTripPlan[]> {
    const variants = await generateVariants(input);
    if (!variants.length) return [];
    // Resolve nearest departure airports ONCE (AUTO = airports ≤3h from home).
    if (input.mode === 'fly-drive' && input.originIata === 'AUTO') {
      input = { ...input, originAirports: await nearestAirports(input.origin) };
    }
    const legCache: LegCache = new Map();
    const fareCache: FareCache = new Map();
    const accessCache: AccessCache = new Map();
    // Enrich all variants IN PARALLEL (major speedup on cold Render).
    const settled = await Promise.allSettled(variants.map((v) => enrichVariant(v, input, legCache, fareCache, accessCache)));
    const plans: RoadTripPlan[] = [];
    for (const s of settled) { if (s.status === 'fulfilled') plans.push(s.value); else logger.warn('roadtrip enrich failed', { err: String(s.reason) }); }
    // Cheapest first.
    return plans.sort((a, b) => a.budget.total - b.budget.total);
  },

  /** Single plan (kept for compatibility) = the balanced variant. */
  async plan(input: RoadTripInput): Promise<RoadTripPlan | null> {
    const all = await this.options(input);
    return all.find((p) => p.strategy === 'balanced') || all[0] || null;
  },
};

