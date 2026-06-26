/**
 * Price-watch service — the Premium "alerte baisse de prix".
 * A user follows a route (+ optional date) at a reference price. When they
 * reload, we fetch the current cheapest fare (Travelpayouts) and flag drops.
 * In-app alert (no email needed); a cron can later push notifications.
 */
import { supabase } from './supabase.service.js';
import { travelpayoutsService } from './travelpayouts.service.js';

interface WatchRow {
  id: string; user_id: string; origin: string; destination: string;
  depart_date: string | null; ref_price: number; last_price: number | null;
  currency: string; last_checked: string | null; created_at: string;
}

async function currentPrice(origin: string, destination: string, departDate?: string | null): Promise<number | null> {
  if (!travelpayoutsService.configured()) return null;
  try {
    const fares = await travelpayoutsService.cheapestForRoute({
      origin, destination,
      ...(departDate ? { departureDate: departDate } : {}),
      oneWay: true, limit: 5,
    });
    return fares.length ? fares[0]!.price : null;
  } catch { return null; }
}

export const priceWatchService = {
  async add(userId: string, w: { origin: string; destination: string; departDate?: string; currency?: string }): Promise<WatchRow> {
    const ref = await currentPrice(w.origin, w.destination, w.departDate);
    const [row] = await supabase.upsert<WatchRow>('price_watches', {
      user_id: userId, origin: w.origin.toUpperCase(), destination: w.destination.toUpperCase(),
      depart_date: w.departDate ?? null, ref_price: ref ?? 0, last_price: ref ?? null,
      currency: (w.currency || 'EUR').toUpperCase(), last_checked: new Date().toISOString(),
    });
    return row;
  },

  /** List watches and refresh current prices (flags drops). */
  async listWithPrices(userId: string): Promise<Array<Record<string, unknown>>> {
    const rows = await supabase.select<WatchRow>('price_watches', { match: { user_id: userId }, order: 'created_at.desc', limit: 50 });
    const out = await Promise.all(rows.map(async (r) => {
      const now = await currentPrice(r.origin, r.destination, r.depart_date);
      if (now != null && now !== r.last_price) {
        try { await supabase.update('price_watches', { id: r.id }, { last_price: now, last_checked: new Date().toISOString() }); } catch { /* ignore */ }
      }
      const ref = Number(r.ref_price) || 0;
      const cur = now ?? (r.last_price != null ? Number(r.last_price) : ref);
      const drop = ref > 0 && cur < ref;
      return {
        id: r.id, origin: r.origin, destination: r.destination, departDate: r.depart_date,
        currency: r.currency, refPrice: ref, currentPrice: cur,
        dropped: drop, dropAmount: drop ? Math.round(ref - cur) : 0,
        dropPct: drop ? Math.round(((ref - cur) / ref) * 100) : 0,
      };
    }));
    return out;
  },

  async remove(userId: string, id: string): Promise<void> {
    try { await supabase.remove('price_watches', { id, user_id: userId }); } catch { /* ignore */ }
  },
};
