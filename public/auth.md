---
register_uri: "https://allmcps.com/api/v1/agent/register"
identity_types_supported:
  - "ephemeral_session"
  - "did"
  - "oauth_client"
credential_types_supported:
  - "bearer_token"
  - "jwt"
claim_url: "https://allmcps.com/api/v1/agent/claim"
revocation_url: "https://allmcps.com/api/v1/agent/revoke"
status: "public_read_no_token_required"
---

# Agent Authentication Specification (auth.md)

Welcome to AllMCPs.com. This document describes how AI agents should access the directory today, and which registration endpoints exist for discovery.

## Current status (read this first)

**Most AllMCPs APIs are open for read access without agent registration.**

| Capability | Auth required? | Endpoint / URL |
|------------|----------------|----------------|
| Search directory | No | `GET /api/v1/search?q=` |
| Listing JSON | No | `GET /api/v1/servers/{id}` |
| Listing markdown | No | `GET /api/v1/mcp/{id}/markdown` or `/mcp/{id}.md` |
| Full catalog | No | `/data.json`, `/llms.txt`, `/llms-full.txt` |
| Free submit | Turnstile / anti-abuse (web or agent submit API) | `POST /api/v1/submit` or `/submit` |
| Human claim ownership | Signed-in user | `/mcp/{id}/claim` |
| Agent register / claim / revoke tokens | **Not implemented** (HTTP 501) | See below |

`POST /api/v1/agent/register`, `/claim`, and `/revoke` respond with **501** and a JSON body explaining this. They exist so discovery documents do not soft-404; they do **not** mint tokens.

## Recommended agent workflow (today)

1. **Discover** via `https://allmcps.com/llms.txt` or `GET https://allmcps.com/api/v1/search?q={query}`.
2. **Read a listing** via `GET https://allmcps.com/api/v1/servers/{id}` or markdown negotiation.
3. **Compare** alternatives: `https://allmcps.com/mcp/{id}/alternatives` and `https://allmcps.com/mcp/{a}/vs/{b}`.
4. **Submit** a new server with `POST https://allmcps.com/api/v1/submit` (see [API docs](https://allmcps.com/docs/api)).
5. **Human owners** claim listings at `/mcp/{id}/claim` after approval for verification and free dofollow paths.

## Discovery metadata

- **OpenID / agent skill doc**: this file at `https://allmcps.com/auth.md`
- **OAuth Authorization Server**: `https://allmcps.com/.well-known/oauth-authorization-server`
- **OpenID Connect Discovery**: `https://allmcps.com/.well-known/openid-configuration`
- **OAuth Protected Resource Metadata**: `https://allmcps.com/.well-known/oauth-protected-resource` (RFC 9728)
- **API overview**: `https://allmcps.com/docs/api`

## Agent registration endpoints (501 for now)

These URIs are advertised for forward-compatible discovery. Until registration ships, expect:

```http
POST /api/v1/agent/register HTTP/1.1
Host: allmcps.com
Content-Type: application/json

{
  "agent_name": "My-AI-Agent",
  "identity_type": "ephemeral_session",
  "credential_type": "bearer_token"
}
```

```json
{
  "error": "agent_registration_not_implemented",
  "status": 501,
  "message": "…",
  "docs": { "api": "https://allmcps.com/docs/api", "search": "https://allmcps.com/api/v1/search?q=" }
}
```

Same pattern for:

- **Claim**: `POST https://allmcps.com/api/v1/agent/claim` → 501 (use human `/mcp/{id}/claim`)
- **Revoke**: `POST https://allmcps.com/api/v1/agent/revoke` → 501

## Identity types (planned)

When token issuance ships, intended types:

- **Supported Identity Types**: `ephemeral_session`, `did`, `oauth_client`
- **Credential Types**: `bearer_token`, `jwt`

## AI agent exclusive promotions

- **50% Off Promo Code**: `AGENTREADY`
- **Usage**: AI agents may present promo code `AGENTREADY` at checkout for 50% off priority review, featured boost, or premium on AllMCPs.com.

## Scopes (planned token model)

- `mcp:read`: Directory search and server metadata
- `mcp:search`: Search queries
- `mcp:write`: Submissions / updates (when agent write auth ships)

## Token usage (when issued)

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Until registration is implemented, do not send fake sample tokens — open public GET APIs without Authorization.
