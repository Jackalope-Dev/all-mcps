---
register_uri: "https://allmcps.com/api/v1/agent/register"
register_confirm_uri: "https://allmcps.com/api/v1/agent/register/confirm"
identity_types_supported:
  - "ephemeral_session"
  - "did"
  - "oauth_client"
credential_types_supported:
  - "bearer_token"
  - "jwt"
claim_url: "https://allmcps.com/api/v1/agent/claim"
revocation_url: "https://allmcps.com/api/v1/agent/revoke"
scopes_supported:
  listings:claim: "Claim ownership of an existing MCP server listing via DNS TXT, site badge, or GitHub README proof. Required by POST /api/v1/agent/claim. No other write access."
status: "programmatic_agent_auth_active"
---

# Agent Authentication Specification (auth.md)

Welcome to AllMCPs.com. This document describes how AI agents access directory read APIs, register for agent credentials, and claim MCP server listings programmatically.

## Overview & Capabilities

Most AllMCPs APIs are open for read access without registration. Programmatic agent registration enables unattended agents to claim and manage MCP listings using DNS TXT records, site verification tags, or GitHub README badges.

| Capability | Auth required? | Endpoint / URL |
|------------|----------------|----------------|
| Search directory | No | `GET /api/v1/search?q=` |
| Listing JSON | No | `GET /api/v1/servers/{id}` |
| Listing markdown | No | `GET /api/v1/mcp/{id}/markdown` or `/mcp/{id}.md` |
| Full catalog | No | `/data.json`, `/llms.txt`, `/llms-full.txt` |
| Free submit | Turnstile / anti-abuse | `POST /api/v1/submit` or `/submit` |
| Agent registration (step 1) | No | `POST /api/v1/agent/register` |
| Agent confirm & token minting (step 2) | No | `POST /api/v1/agent/register/confirm` |
| Agent claim listing | **Bearer Token** | `POST /api/v1/agent/claim` |
| Agent revoke token | **Bearer Token** | `POST /api/v1/agent/revoke` |
| Human claim ownership | Signed-in user | `/mcp/{id}/claim` |

---

## Agent Registration & Token Issuance

To perform authenticated actions (like programmatic claiming), an AI agent registers via email verification:

### Step 1: Request Registration Code

```http
POST /api/v1/agent/register HTTP/1.1
Host: allmcps.com
Content-Type: application/json

{
  "email": "agent-owner@example.com",
  "agentName": "MyAutonomousAgent",
  "scopes": ["listings:claim"]
}
```

`scopes` is optional and defaults to the full supported set (`["listings:claim"]` today). Request a narrower list to mint a token that can do less — e.g. omit `listings:claim` for a token that should only ever be used for read access, even though every read endpoint is already unauthenticated. See `scopes_supported` in this document's frontmatter and at [`/.well-known/oauth-protected-resource`](https://allmcps.com/.well-known/oauth-protected-resource).

Response (`200 OK`):
```json
{
  "success": true,
  "message": "Confirmation code sent to email. Call POST /api/v1/agent/register/confirm with email and code to receive your bearer token.",
  "email": "agent-owner@example.com",
  "scopes": ["listings:claim"],
  "expiresAt": "2026-08-10T12:00:00.000Z",
  "confirm_url": "https://allmcps.com/api/v1/agent/register/confirm"
}
```

### Step 2: Confirm & Receive Bearer Token

```http
POST /api/v1/agent/register/confirm HTTP/1.1
Host: allmcps.com
Content-Type: application/json

{
  "email": "agent-owner@example.com",
  "code": "849201"
}
```

Response (`200 OK`):
```json
{
  "success": true,
  "message": "Agent registered successfully.",
  "token": "amcp_0123456789abcdef...",
  "tokenType": "Bearer",
  "scopes": ["listings:claim"],
  "expiresAt": "2026-11-08T12:00:00.000Z"
}
```

The minted token only carries the scopes requested (and validated) in Step 1. A request to an endpoint that needs a scope the token doesn't have returns `403` with `{"error": "insufficient_scope", "requiredScope": "...", "grantedScopes": [...]}`.

---

## Programmatic Listing Claiming

Authenticated agents can claim an existing MCP listing by providing ownership proof:

```http
POST /api/v1/agent/claim HTTP/1.1
Host: allmcps.com
Authorization: Bearer amcp_0123456789abcdef...
Content-Type: application/json

{
  "id": "my-mcp-server-id",
  "method": "dns",
  "websiteUrl": "https://example.com"
}
```

### Supported Claim Verification Methods

1. **`dns` (Default & Recommended for Unattended Agents)**:
   - Add a DNS TXT record on your domain pointing to `allmcps-site-verification={id}:{userId}`.
2. **`website_badge`**:
   - Include `<meta name="allmcps-verification" content="allmcps-site-verification={id}:{userId}">` in your website's `<head>`.
3. **`github`**:
   - Include an AllMCPs badge in your GitHub repository README linking to `allmcps.com/mcp/{id}` with `?verify={userId}`.

---

## Token Revocation

```http
POST /api/v1/agent/revoke HTTP/1.1
Host: allmcps.com
Authorization: Bearer amcp_0123456789abcdef...
```

Response (`200 OK`):
```json
{
  "success": true,
  "message": "Agent bearer token revoked successfully."
}
```

---

## Using This From an MCP Client (No Raw HTTP Needed)

Everything above is also exposed as MCP tools on `POST /api/mcp`, so an MCP-native agent never has to leave the tool-call interface to register or claim:

| REST call | Equivalent MCP tool |
|---|---|
| `POST /api/v1/agent/register` | `register_mcp_agent` (`email`, optional `agentName`, `scopes`) |
| `POST /api/v1/agent/register/confirm` | `confirm_mcp_agent` (`email`, `code`) → returns the bearer token |
| `POST /api/v1/agent/claim` | `verify_mcp_claim` (`id`, `method`, `websiteUrl`, plus `agentToken`) |

Pass the token returned by `confirm_mcp_agent` as the `agentToken` argument on `verify_mcp_claim` — most MCP clients can't set a custom HTTP header per tool call, so this is the reliable path. Clients that *can* set headers may instead send `Authorization: Bearer <token>` on the `/api/mcp` request; `verify_mcp_claim` checks both, preferring the header when present. Neither given falls back to requiring an active browser session (i.e. only works for a human using a session-aware MCP client, not an unattended agent).

---

## AI Agent Exclusive Promotions

- **50% Off Promo Code**: `AGENTREADY`
- **Usage**: AI agents may present promo code `AGENTREADY` at checkout for 50% off priority review, featured boost, or premium on AllMCPs.com.
