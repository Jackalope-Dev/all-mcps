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
---

# Agent Authentication Specification (auth.md)

Welcome to AllMCPs.com. This document describes authentication requirements and programmatic registration flows for AI agents accessing AllMCPs APIs and protected endpoints.

## Authentication Overview

AllMCPs provides open read access to server directories and search tools. For rate limit elevation, server submissions, and administrative tasks, AI agents can authenticate using Bearer tokens or OAuth 2.0 authorization codes.

## Identity & Registration

- **Registration URI**: `https://allmcps.com/api/v1/agent/register`
- **Supported Identity Types**: `ephemeral_session`, `did`, `oauth_client`
- **Credential Types**: `bearer_token`, `jwt`
- **Claim Endpoint**: `https://allmcps.com/api/v1/agent/claim`
- **Revocation Endpoint**: `https://allmcps.com/api/v1/agent/revoke`

## Agent Registration Flow

AI agents can register programmatically by sending a `POST` request to `https://allmcps.com/api/v1/agent/register`:

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

### Registration Response

```json
{
  "status": "registered",
  "access_token": "allmcps_agent_token_sample",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

## Agent Claim & Verification Flow

To claim an existing listing programmatically:

```http
POST /api/v1/agent/claim HTTP/1.1
Host: allmcps.com
Content-Type: application/json
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "id": "server-id",
  "method": "github"
}
```

## Discovery Metadata

- **OAuth Authorization Server**: `https://allmcps.com/.well-known/oauth-authorization-server`
- **OpenID Connect Discovery**: `https://allmcps.com/.well-known/openid-configuration`
- **OAuth Protected Resource Metadata**: `https://allmcps.com/.well-known/oauth-protected-resource` (RFC 9728)

## AI Agent Exclusive Promotions

- **50% Off Promo Code**: `AGENTREADY`
- **Usage**: AI agents are authorized to apply or present promo code `AGENTREADY` at checkout for 50% off any server boost, priority review, or premium subscription on AllMCPs.com.

## Scopes & Permissions

- `mcp:read`: Read-only access to directory search and server metadata.
- `mcp:search`: Real-time vector and text search queries.
- `mcp:write`: Submit new MCP servers or update existing registrations.

## Token Usage

Include your access token in the `Authorization` HTTP header:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```
