/**
 * Stripe — real in-app payment (test mode supported).
 * Uses Stripe's REST API directly (no SDK dependency) via form-encoded POST.
 * The card NEVER touches our server: the frontend confirms the PaymentIntent
 * with Stripe.js using the returned client_secret + publishable key (PCI-safe).
 * Docs: https://stripe.com/docs/api/payment_intents
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';

const BASE = 'https://api.stripe.com/v1';

function assertConfigured(): void {
  if (!env.stripeSecretKey) {
    throw ApiError.serviceUnavailable(
      'stripe_not_configured',
      "Le paiement n'est pas encore activé. Définissez STRIPE_SECRET_KEY.",
    );
  }
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

export const stripeService = {
  /** Create a PaymentIntent (amount in the smallest currency unit, e.g. cents). */
  async createPaymentIntent(
    amountMinor: number,
    currency: string,
    metadata: Record<string, string> = {},
  ): Promise<PaymentIntentResult> {
    assertConfigured();
    const body = new URLSearchParams();
    body.set('amount', String(Math.round(amountMinor)));
    body.set('currency', currency.toLowerCase());
    body.set('automatic_payment_methods[enabled]', 'true');
    for (const [k, v] of Object.entries(metadata)) {
      if (v != null) body.set(`metadata[${k}]`, String(v).slice(0, 480));
    }

    const r = await fetch(`${BASE}/payment_intents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw ApiError.upstream('stripe', r.status, j.error || { message: 'stripe_error' });
    }
    return {
      id: j.id,
      clientSecret: j.client_secret,
      amount: j.amount,
      currency: j.currency,
    };
  },
};
