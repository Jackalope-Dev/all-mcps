---
name: mcp-monetization
description: Query sponsorship pricing, feature MCP servers, and process agentic commerce payments on AllMCPs.com.
version: 1.0.0
---

# MCP Monetization & Boosting Skill

This skill enables AI agents to query sponsorship pricing, feature MCP servers, and initiate autonomous payments on AllMCPs.com.

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
