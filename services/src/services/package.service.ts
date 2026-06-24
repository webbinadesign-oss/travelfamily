/**
 * Package intelligent — Webbina assembles a complete family trip in ONE place:
 *   • Flight  : REAL cheapest fare (Duffel)
 *   • Hotel   : ESTIMATE for now (per-night × nights) — flagged honestly,
 *               ready to be replaced by RateHawk net rates (hotel.source).
 *   • Activities: REAL top picks (Google Places)
 * Computes a single total, applies the package commission, and reports whether
 * it fits the family budget. One assembled object → one Stripe payment.
 */
import { duffelService } from './duffel.service.js';
import { googleMapsService } from './googlemaps.service.js';
import { quote } from './pricing.service.js';
import { logger } from '../lib/logger.js';

export interface PackageInput {
  origin: string;            // IATA
  destinationIata: string;   // IATA
  destinationName: string;
  lat?: number;
  lng?: number;
  departureDate: string;
  returnDate: string;
  adults: number;
  children?: number;
  budget?: number;           // total family budget (€)
}

export interface PackageResult {
  destination: string;
  travelers: number;
  nights: number;
  flight: { pricePerPax: number; total: number; carrier: string; stops: number; source: 'duffel-live' | 'unavailable' };
  hotel: { perNight: number; nights: number; total: number; name: string; source: 'estimate' | 'ratehawk-live'; estimated: boolean };
  activities: { items: { name: string; rating?: number }[]; total: number; source: 'google-live' | 'estimate' };
  pricing: { base: number; fee: number; total: number; feeLabel: string; currency: string };
  budget: number | null;
  withinBudget: boolean | null;
  remaining: number | null;
  capturedAt: string;
}

function nightsBetween(a: string, b: string): number {
  const d1 = new Date(a), d2 = new Date(b);
  const n = Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
  return Math.max(1, n || 5);
}

/** Rough nightly hotel estimate per family until RateHawk net rates are wired. */
function estimateNightly(children: number, adults: number): number {
  const rooms = Math.max(1, Math.ceil((adults + children) / 3));
  return rooms * 95; // ~95€/room/night family-friendly midscale — replaced by RateHawk
}

export const packageService = {
  async assemble(input: PackageInput): Promise<PackageResult> {
    const pax = Math.max(1, input.adults + (input.children ?? 0));
    const nights = nightsBetween(input.departureDate, input.returnDate);
    const now = new Date().toISOString();

    // 1) REAL flight (round trip), cheapest.
    let flight: PackageResult['flight'] = { pricePerPax: 0, total: 0, carrier: '', stops: 0, source: 'unavailable' };
    try {
      const offers = await duffelService.searchFlights({
        origin: input.origin, destination: input.destinationIata,
        departureDate: input.departureDate, returnDate: input.returnDate,
        adults: input.adults, children: input.children ?? 0, maxResults: 1,
      });
      const o = offers[0];
      if (o?.price?.amount) {
        const perPax = Math.round(o.price.amount / pax);
        flight = { pricePerPax: perPax, total: Math.round(o.price.amount), carrier: o.segments?.[0]?.carrierCode || '', stops: o.stops || 0, source: 'duffel-live' };
      }
    } catch (e) { logger.warn('package flight failed', { err: String(e) }); }

    // 2) Hotel ESTIMATE (RateHawk-ready).
    const perNight = estimateNightly(input.children ?? 0, input.adults);
    const hotel: PackageResult['hotel'] = {
      perNight, nights, total: perNight * nights,
      name: `Hébergement famille à ${input.destinationName}`,
      source: 'estimate', estimated: true,
    };

    // 3) REAL activities (Google Places), best 3.
    let activities: PackageResult['activities'] = { items: [], total: 0, source: 'estimate' };
    try {
      if (input.lat != null && input.lng != null) {
        const places = await googleMapsService.searchPlaces({
          query: `activités en famille à ${input.destinationName}`,
          near: { lat: input.lat, lng: input.lng },
          radiusKm: 25,
        });
        const top = (places || []).filter((p: any) => p.rating).slice(0, 3).map((p: any) => ({ name: p.name, rating: p.rating }));
        if (top.length) {
          // budget ~25€/activity/person as a planning line (booked à la carte later)
          activities = { items: top, total: top.length * 25 * pax, source: 'google-live' };
        }
      }
    } catch (e) { logger.warn('package activities failed', { err: String(e) }); }

    // 4) Assemble + single package commission.
    const base = flight.total + hotel.total + activities.total;
    const q = quote('package', base, pax);
    const budget = input.budget ?? null;
    const withinBudget = budget != null ? q.total <= budget : null;
    const remaining = budget != null ? Math.round(budget - q.total) : null;

    return {
      destination: input.destinationName,
      travelers: pax,
      nights,
      flight,
      hotel,
      activities,
      pricing: { base: q.base, fee: q.fee, total: q.total, feeLabel: q.label, currency: q.currency },
      budget,
      withinBudget,
      remaining,
      capturedAt: now,
    };
  },
};
