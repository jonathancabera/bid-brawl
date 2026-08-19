import Stripe from 'stripe';

let client: Stripe | null = null;

export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// Mirrors lock.ts / io.ts: absent config is a supported state, not a crash. The
// test harness runs without Stripe keys, and the bid gate is a plain column
// check, so nothing on the bid path needs a live Stripe client.
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  if (!client) {
    client = new Stripe(key);
  }
  return client;
}
