import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: '2026-06-24.dahlia',
      typescript: true,
      // Cloudflare Workers has no `node:https`; use the fetch-based client explicitly
      // instead of relying on build-tool auto-detection (Stripe/OpenNext recommendation).
      httpClient: Stripe.createFetchHttpClient(),
      // Outbound fetches from Workers occasionally hang well past what's reasonable for
      // a checkout button. Fail fast instead of leaving the UI stuck for minutes.
      timeout: 15000,
      maxNetworkRetries: 1,
    });
  }
  return stripeClient;
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://allmcps.com'
  ).replace(/\/$/, '');
}
