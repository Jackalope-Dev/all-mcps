---
name: mcp-monetization
description: Query sponsorship pricing, boost MCP server listings, and buy sponsor ads on AllMCPs.com, paying by Stripe checkout, the Agentic Commerce Protocol (ACP), or autonomously over x402.
version: 2.1.0
---

# MCP Monetization & Boosting Skill

This skill lets AI agents check sponsorship pricing, boost an MCP server listing, and buy sponsor ad campaigns on AllMCPs.com.

## Free Submission (no payment required)

Listing an MCP server on AllMCPs is **always free**. The paid tiers below are optional upgrades for faster review and promotion.

- **Submit for free (web)**: `https://allmcps.com/submit`
- **Submit for free (API)**: `POST https://allmcps.com/api/submit` with `{ "url": "https://github.com/owner/repo" }`
- **MCP Tool**: `submit_mcp_server`

A free listing includes a permanent directory entry, inclusion in search, categories and agent APIs, a nofollow website link, and ownership claiming via GitHub, site badge, or DNS.

## Check what's available

`GET https://allmcps.com/api/v1/boost/pricing` returns every tier, its list and agent price, weekly volume tiers, and which payment methods each tier accepts. Check `agent_commerce_support.x402.enabled` before attempting an x402 payment.

## Three ways to pay

### 1. Stripe checkout (a human pays by card)

`POST https://allmcps.com/api/v1/boost/checkout`

```json
{ "serverId": "github-mcp", "sku": "featured_7d", "weeks": 2 }
```

Returns `checkout_url` for a person to complete, and `amount_due` read back from the Stripe session. The agent promo code `AGENTREADY` (50% off) is applied by default.

### 2. x402 (the agent pays autonomously in USDC)

When enabled, boosts and ads can be paid with [x402](https://x402.org) v2 (USDC on Base, `exact` scheme). Payments settle to AllMCPs' Stripe account.

**Boost a listing** — `POST https://allmcps.com/api/v1/boost/x402`

```json
{ "serverId": "github-mcp", "sku": "featured_7d", "weeks": 2, "email": "optional@example.com" }
```

SKUs: `priority_review` (pending listings only), `featured_7d`, `category_sponsor_7d`. Premium is a monthly subscription and is Stripe-only. The x402 price already includes the 50% agent discount.

**Buy a sponsor ad** — `POST https://allmcps.com/api/v1/ads/x402`

```json
{
  "title": "Acme MCP",
  "description": "Ship MCP servers faster.",
  "targetUrl": "https://acme.example",
  "logoUrl": "https://acme.example/logo.png",
  "placement": "all",
  "bidCpm": 500,
  "impressions": 1000,
  "advertiserEmail": "ads@acme.example"
}
```

The campaign is created only after payment settles, then reviewed before it serves.

**Flow (both x402 endpoints):**

1. Send the request with no payment header. You get `402 Payment Required` with a base64 `PAYMENT-REQUIRED` header (the same JSON is in the body) listing the price, network, asset and `payTo` address.
2. Sign the payment with an x402 client and resend the same request with a `PAYMENT-SIGNATURE` header.
3. On success you get `200` with a `PAYMENT-RESPONSE` header (settlement receipt, including the transaction hash) and the activated boost or new campaign in the body.

If the price, network or signature doesn't match, you get another 402 with an `error` explaining why. Nothing is activated unless settlement succeeds.

### 3. Agentic Commerce Protocol (the agent pays with a delegated card)

When `https://allmcps.com/.well-known/acp.json` answers (it is a 404 until ACP is enabled), boosts can be bought through the standard [ACP](https://agenticcommerce.dev) checkout API, version `2026-04-17`, at `https://allmcps.com/api/acp`.

- **Auth**: `Authorization: Bearer <AllMCPs agent token>` with the `checkout:write` scope. Get one with `POST /api/v1/agent/register` (`"scopes": ["checkout:write"]`) and `POST /api/v1/agent/register/confirm`.
- **Headers**: `API-Version: 2026-04-17` on every call; `Idempotency-Key` on every POST.
- **Items**: `<sku>:<listing id>`, e.g. `featured_7d:github-mcp`. For `featured_7d` and `category_sponsor_7d` the quantity is the number of weeks (1 to 8); `priority_review` is quantity 1. Prices include the 50% agent discount.
- **Payment**: the session's `capabilities.payment.handlers` lists `card_tokenized` (Stripe). Ask Stripe for a shared payment token scoped to the handler's `config.merchant_id` and the session total, then complete with `payment_data: { "handler_id": "card_tokenized", "instrument": { "type": "card", "credential": { "type": "spt", "token": "spt_..." } } }`.

```
POST /api/acp/checkout_sessions                 { "currency": "usd", "line_items": [{ "id": "featured_7d:github-mcp", "quantity": 2 }], "capabilities": {} }
GET  /api/acp/checkout_sessions/{id}
POST /api/acp/checkout_sessions/{id}            update line_items or buyer
POST /api/acp/checkout_sessions/{id}/complete   { "payment_data": { ... } }
POST /api/acp/checkout_sessions/{id}/cancel
```

A session is `ready_for_payment` only when every line can be bought; otherwise `messages` says which line is wrong and why. The boost activates the moment `complete` returns `status: "completed"`.

## A2A

AllMCPs is also an [A2A](https://a2a-protocol.org) agent: card at `https://allmcps.com/.well-known/agent-card.json`, JSON-RPC at `https://allmcps.com/api/a2a` (A2A 1.0 and 0.3). Each MCP tool below is an A2A skill; call one with a data part `{ "skill": "get_boost_pricing", "arguments": {} }`.

## MCP tools

On the AllMCPs MCP server (`https://allmcps.com/api/mcp`):

- `get_boost_pricing` — tiers and prices
- `boost_mcp_server` — a Stripe checkout link, plus the exact x402 request when x402 is enabled
- `quote_sponsor_ad` — validates an ad, returns its cost and the exact x402 request
- `get_boost_status` — what's currently active on a listing
