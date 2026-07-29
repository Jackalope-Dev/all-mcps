import Stripe from 'stripe';

export function getStripe(secretKey?: string): Stripe {
  const key = secretKey || process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY environment secret is missing or empty.');
  }

  let cleanKey = key.trim();
  // Remove wrapping quotes or escaped JSON quotes if accidentally stored with quotes
  while (
    (cleanKey.startsWith('"') && cleanKey.endsWith('"')) ||
    (cleanKey.startsWith("'") && cleanKey.endsWith("'"))
  ) {
    cleanKey = cleanKey.slice(1, -1).trim();
  }
  cleanKey = cleanKey.replace(/^\\"/g, '').replace(/\\"/g, '').trim();

  if (!cleanKey.startsWith('sk_') && !cleanKey.startsWith('rk_')) {
    throw new Error(
      `STRIPE_SECRET_KEY must be a secret key starting with "sk_live_", "sk_test_", "rk_live_", or "rk_test_". Found prefix: "${cleanKey.slice(0, 7)}..."`
    );
  }

  return new Stripe(cleanKey, {
    httpClient: Stripe.createFetchHttpClient(),
    timeout: 15000,
    maxNetworkRetries: 1,
  });
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://allmcps.com'
  ).replace(/\/$/, '');
}
