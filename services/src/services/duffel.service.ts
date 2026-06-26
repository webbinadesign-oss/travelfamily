/**
 * Duffel — flight search (test mode supported).
 * Uses the Offer Requests API: create an offer request with passengers + slices,
 * then read back the returned offers. Maps Duffel's shape onto our FlightOffer
 * type so the existing /api/flights routes & frontend keep working unchanged.
 * Docs: https://duffel.com/docs/api
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';
import type { FlightSearchQuery, FlightOffer, FlightSegment } from '../types/index.js';

const BASE = 'https://api.duffel.com';

function assertConfigured(): void {
  if (!env.duffelApiKey) {
    throw ApiError.serviceUnavailable(
      'duffel_not_configured',
      'Duffel key is not set. Define DUFFEL_API_KEY.',
    );
  }
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.duffelApiKey}`,
    'Duffel-Version': env.duffelVersion || 'v2',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/* ── Raw Duffel shapes (only the fields we use) ───────────── */
interface RawSegment {
  origin: { iata_code: string };
  destination: { iata_code: string };
  departing_at: string;
  arriving_at: string;
  duration?: string;
  operating_carrier?: { iata_code?: string };
  marketing_carrier?: { iata_code?: string };
  marketing_carrier_flight_number?: string;
}
interface RawSlice {
  duration?: string;
  segments: RawSegment[];
}
interface RawOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  slices: RawSlice[];
  conditions?: {
    change_before_departure?: { allowed?: boolean; penalty_amount?: string | null; penalty_currency?: string | null } | null;
    refund_before_departure?: { allowed?: boolean; penalty_amount?: string | null; penalty_currency?: string | null } | null;
  };
}
interface OfferRequestResponse {
  data: { offers?: RawOffer[]; id: string };
}

function mapOffer(raw: RawOffer): FlightOffer {
  const segments: FlightSegment[] = raw.slices.flatMap((sl) =>
    sl.segments.map((s) => {
      const carrier = s.marketing_carrier?.iata_code || s.operating_carrier?.iata_code || '';
      return {
        from: s.origin.iata_code,
        to: s.destination.iata_code,
        departureAt: s.departing_at,
        arrivalAt: s.arriving_at,
        carrierCode: carrier,
        flightNumber: `${carrier}${s.marketing_carrier_flight_number || ''}`,
        durationIso: s.duration || '',
      };
    }),
  );
  // stops across all slices = total segments minus number of slices
  const stops = Math.max(0, segments.length - raw.slices.length);
  const chg = raw.conditions?.change_before_departure;
  const rfd = raw.conditions?.refund_before_departure;
  const conditions = (chg || rfd) ? {
    changeable: Boolean(chg?.allowed), changePenalty: chg?.penalty_amount ? Number(chg.penalty_amount) : 0,
    refundable: Boolean(rfd?.allowed), refundPenalty: rfd?.penalty_amount ? Number(rfd.penalty_amount) : 0,
    currency: chg?.penalty_currency || rfd?.penalty_currency || raw.total_currency,
  } : undefined;
  return {
    id: raw.id,
    oneWay: raw.slices.length <= 1,
    price: { amount: Number(raw.total_amount), currency: raw.total_currency },
    stops,
    durationIso: raw.slices[0]?.duration || '',
    segments,
    ...(conditions ? { conditions } : {}),
  };
}

export const duffelService = {
  async searchFlights(q: FlightSearchQuery): Promise<FlightOffer[]> {
    assertConfigured();

    // Build passengers: adults + children (+ infants). Duffel uses age for kids.
    const passengers: Array<{ type?: string; age?: number }> = [];
    for (let i = 0; i < q.adults; i++) passengers.push({ type: 'adult' });
    for (let i = 0; i < (q.children ?? 0); i++) passengers.push({ age: 8 });
    for (let i = 0; i < (q.infants ?? 0); i++) passengers.push({ age: 1 });

    // Slices: outbound (+ return if provided).
    const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
      { origin: q.origin, destination: q.destination, departure_date: q.departureDate },
    ];
    if (q.returnDate) {
      slices.push({ origin: q.destination, destination: q.origin, departure_date: q.returnDate });
    }

    const body = {
      data: {
        cabin_class: (q.travelClass || 'economy').toLowerCase(),
        passengers,
        slices,
      },
    };

    // return_offers=true gives us offers inline (simpler for a single call).
    const res = await httpRequest<OfferRequestResponse>(
      `${BASE}/air/offer_requests?return_offers=true&supplier_timeout=15000`,
      {
        method: 'POST',
        provider: 'duffel',
        timeoutMs: 30_000,
        headers: headers(),
        body,
      },
    );

    const offers = res.data.offers ?? [];
    // Cheapest first, capped to the requested max.
    const mapped = offers.map(mapOffer).sort((a, b) => a.price.amount - b.price.amount);
    return mapped.slice(0, q.maxResults ?? 20);
  },

  /** Fetch a single live offer (to get current price + passenger ids before ordering). */
  async getOffer(offerId: string): Promise<{ id: string; amount: string; currency: string; passengerIds: string[]; expiresAt?: string }> {
    assertConfigured();
    const res = await httpRequest<{ data: { id: string; total_amount: string; total_currency: string; expires_at?: string; passengers: Array<{ id: string }> } }>(
      `${BASE}/air/offers/${offerId}?return_available_services=false`,
      { method: 'GET', provider: 'duffel', timeoutMs: 20_000, headers: headers() },
    );
    const d = res.data;
    return {
      id: d.id, amount: d.total_amount, currency: d.total_currency,
      passengerIds: (d.passengers || []).map((p) => p.id),
      ...(d.expires_at ? { expiresAt: d.expires_at } : {}),
    };
  },

  /**
   * Issue a real flight order for a selected offer.
   * In Duffel TEST mode the payment uses the test balance (no real money).
   * passengers must be provided in the same order as the offer's passengers.
   */
  async createOrder(input: {
    offerId: string;
    passengers: Array<{ title?: string; givenName: string; familyName: string; bornOn?: string; gender?: string; email?: string; phoneNumber?: string }>;
  }): Promise<{ id: string; bookingReference: string; status: string; amount: string; currency: string }> {
    assertConfigured();
    const offer = await this.getOffer(input.offerId);
    const passengers = offer.passengerIds.map((id, i) => {
      const p = input.passengers[i] || input.passengers[0];
      return {
        id,
        title: (p?.title || 'mr').toLowerCase(),
        gender: (p?.gender || 'm').toLowerCase(),
        given_name: p?.givenName || 'Voyageur',
        family_name: p?.familyName || 'TravelFamily',
        born_on: p?.bornOn || '1990-01-01',
        email: p?.email || 'contact@travelfamily.ai',
        phone_number: p?.phoneNumber || '+33600000000',
      };
    });
    const body = {
      data: {
        type: 'instant',
        selected_offers: [input.offerId],
        passengers,
        payments: [{ type: 'balance', amount: offer.amount, currency: offer.currency }],
      },
    };
    const res = await httpRequest<{ data: { id: string; booking_reference: string; live_mode: boolean; total_amount: string; total_currency: string } }>(
      `${BASE}/air/orders`,
      { method: 'POST', provider: 'duffel', timeoutMs: 30_000, headers: headers(), body },
    );
    const d = res.data;
    return {
      id: d.id, bookingReference: d.booking_reference,
      status: d.live_mode ? 'confirmed' : 'confirmed_test',
      amount: d.total_amount, currency: d.total_currency,
    };
  },

  /** Read an existing order (status, slices, total). */
  async getOrder(orderId: string): Promise<{ id: string; bookingReference: string; amount: string; currency: string; cancelledAt?: string; slices: Array<{ id: string; origin: string; destination: string; departureDate: string }> }> {
    assertConfigured();
    const res = await httpRequest<{ data: { id: string; booking_reference: string; total_amount: string; total_currency: string; cancelled_at?: string | null; slices?: Array<{ id: string; segments?: Array<{ origin?: { iata_code?: string }; destination?: { iata_code?: string }; departing_at?: string }> }> } }>(
      `${BASE}/air/orders/${orderId}`,
      { method: 'GET', provider: 'duffel', timeoutMs: 20_000, headers: headers() },
    );
    const d = res.data;
    const slices = (d.slices || []).map((sl) => {
      const seg = sl.segments && sl.segments[0];
      return {
        id: sl.id,
        origin: seg?.origin?.iata_code || '',
        destination: (sl.segments && sl.segments[sl.segments.length - 1]?.destination?.iata_code) || seg?.destination?.iata_code || '',
        departureDate: (seg?.departing_at || '').slice(0, 10),
      };
    });
    return { id: d.id, bookingReference: d.booking_reference, amount: d.total_amount, currency: d.total_currency, slices, ...(d.cancelled_at ? { cancelledAt: d.cancelled_at } : {}) };
  },

  /** Step 1 of cancellation — create a pending cancellation that quotes the refund. */
  async cancelQuote(orderId: string): Promise<{ id: string; refundAmount: string; currency: string }> {
    assertConfigured();
    const res = await httpRequest<{ data: { id: string; refund_amount: string; refund_currency: string } }>(
      `${BASE}/air/order_cancellations`,
      { method: 'POST', provider: 'duffel', timeoutMs: 25_000, headers: headers(), body: { data: { order_id: orderId } } },
    );
    const d = res.data;
    return { id: d.id, refundAmount: d.refund_amount, currency: d.refund_currency };
  },

  /** Step 2 — confirm the cancellation (refund is then processed by the carrier). */
  async cancelConfirm(cancellationId: string): Promise<{ id: string; status: string; refundAmount: string; currency: string }> {
    assertConfigured();
    const res = await httpRequest<{ data: { id: string; refund_amount: string; refund_currency: string; confirmed_at?: string } }>(
      `${BASE}/air/order_cancellations/${cancellationId}/actions/confirm`,
      { method: 'POST', provider: 'duffel', timeoutMs: 25_000, headers: headers(), body: {} },
    );
    const d = res.data;
    return { id: d.id, status: 'cancelled', refundAmount: d.refund_amount, currency: d.refund_currency };
  },

  /** Step 1 of a change — quote a new departure date (cheapest change offer). */
  async changeQuote(orderId: string, newDepartureDate: string, cabin = 'economy'): Promise<{ changeOfferId: string; changeAmount: string; newTotal: string; currency: string; expiresAt?: string } | null> {
    assertConfigured();
    const order = await this.getOrder(orderId);
    const slice = order.slices[0];
    if (!slice) return null;
    const reqRes = await httpRequest<{ data: { id: string; order_change_offers?: Array<{ id: string; change_total_amount: string; new_total_amount: string; new_total_currency: string; expires_at?: string }> } }>(
      `${BASE}/air/order_change_requests`,
      {
        method: 'POST', provider: 'duffel', timeoutMs: 30_000, headers: headers(),
        body: { data: { order_id: orderId, slices: { remove: [{ slice_id: slice.id }], add: [{ origin: slice.origin, destination: slice.destination, departure_date: newDepartureDate, cabin_class: cabin }] } } },
      },
    );
    const offers = reqRes.data.order_change_offers || [];
    if (!offers.length) return null;
    const best = offers.slice().sort((a, b) => Number(a.change_total_amount) - Number(b.change_total_amount))[0]!;
    return { changeOfferId: best.id, changeAmount: best.change_total_amount, newTotal: best.new_total_amount, currency: best.new_total_currency, ...(best.expires_at ? { expiresAt: best.expires_at } : {}) };
  },

  /** Step 2 — create + confirm the change (pays the difference on the test/live balance). */
  async changeConfirm(changeOfferId: string): Promise<{ id: string; status: string; changeAmount: string; currency: string }> {
    assertConfigured();
    const createRes = await httpRequest<{ data: { id: string; change_total_amount: string; change_total_currency: string } }>(
      `${BASE}/air/order_changes`,
      { method: 'POST', provider: 'duffel', timeoutMs: 30_000, headers: headers(), body: { data: { selected_order_change_offer: changeOfferId } } },
    );
    const ch = createRes.data;
    await httpRequest<{ data: unknown }>(
      `${BASE}/air/order_changes/${ch.id}/actions/confirm`,
      { method: 'POST', provider: 'duffel', timeoutMs: 30_000, headers: headers(), body: { data: { payment: { type: 'balance', amount: ch.change_total_amount, currency: ch.change_total_currency } } } },
    );
    return { id: ch.id, status: 'changed', changeAmount: ch.change_total_amount, currency: ch.change_total_currency };
  },
};
