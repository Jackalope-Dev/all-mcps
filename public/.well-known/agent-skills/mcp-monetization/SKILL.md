---
name: mcp-monetization
description: Query sponsorship pricing, feature MCP servers, and process agentic commerce payments on AllMCPs.com.
version: 1.0.0
---

# MCP Monetization & Boosting Skill

This skill enables AI agents to query sponsorship pricing, feature MCP servers, and initiate autonomous payments on AllMCPs.com.

## Free Submission (no payment required)

Listing an MCP server on AllMCPs is **always free** — no purchase is needed to get listed. The paid tiers below are optional upgrades for faster review and promotion.

- **Submit for free (web)**: `https://allmcps.com/submit`
- **Submit for free (API)**: `POST https://allmcps.com/api/submit` with `{ "url": "https://github.com/owner/repo" }`
- **MCP Tool**: `submit_mcp`

A free listing includes a permanent directory entry, inclusion in search / categories / agent APIs, a nofollow website link, and ownership claiming via GitHub, site badge, or DNS.

## Endpoints

- **Get Boost Tiers**: `GET https://allmcps.com/api/v1/boost/pricing`
- **Initiate Boost Order**: `POST https://allmcps.com/api/v1/boost/checkout`
  ```json
  {
    "serverId": "github-mcp",
    "sku": "featured_7d"
  }
  ```
- **MCP Tool**: `boost_mcp_server`

## Payment Formats

Responses contain both standard Stripe checkout URLs and `x402_invoice` objects for automated machine settlement:

```json
{
  "spec": "x402-v1",
  "asset": "USD",
  "amount": 12,
  "payee": "AllMCPs Directory",
  "checkout_url": "https://allmcps.com/pricing?serverId=github-mcp&sku=featured_7d"
}
```
