# Stripe setup (AllMCPs premium products)

## Products (Dashboard)

Create **three separate Products** (one plan each), with one Price each:

| Product | Price | Mode | Env var for Price ID |
|---------|-------|------|----------------------|
| Priority review | $5.00 USD one-time | Payment | `STRIPE_PRICE_PRIORITY_REVIEW` |
| Featured boost (7 days) | $12.00 USD one-time | Payment | `STRIPE_PRICE_FEATURED_7D` |
| Premium | $19.00 USD / month | Recurring | `STRIPE_PRICE_PREMIUM_MONTHLY` |

## Secrets (Workers / local)

```bash
STRIPE_SECRET_KEY=sk_test_…          # or sk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_PRIORITY_REVIEW=price_…
STRIPE_PRICE_FEATURED_7D=price_…
STRIPE_PRICE_PREMIUM_MONTHLY=price_…
NEXT_PUBLIC_APP_URL=https://allmcps.com
```

Do **not** commit secret keys. Prefer a [restricted API key](https://docs.stripe.com/keys/restricted-api-keys) with Checkout + Billing + Customers permissions.

## Webhook

Endpoint: `https://allmcps.com/api/stripe/webhook`

Events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Local:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Customer Portal

Enable Customer Portal in Stripe Dashboard (cancel / update payment method) so **Manage billing** works after Premium checkout.

## Migration

Apply D1 migration `0007_stripe_premium.sql` (featuredUntil, Stripe ids, reviewPriority, etc.):

```bash
npx wrangler d1 migrations apply all-mcps --remote
```

## App routes

- `POST /api/stripe/checkout` — start Checkout (`serverId` + `sku`)
- `POST /api/stripe/webhook` — fulfill entitlements
- `POST /api/stripe/portal` — billing portal
- `/pricing` — public pricing + checkout by listing id
- Detail page sidebar — upgrade CTAs for active listings
