# Agent Authentication Specification (auth.md)

Welcome to AllMCPs.com. This document describes authentication requirements and programmatic flows for AI agents accessing AllMCPs APIs and protected endpoints.

## Authentication Overview

AllMCPs provides open read access to server directories and search tools. For rate limit elevation, server submissions, and administrative tasks, AI agents must authenticate using Bearer tokens or OAuth 2.0 authorization codes.

## Identity & Registration

- **Registration URI**: `https://allmcps.com/api/v1/agent/register`
- **Supported Identity Types**: `ephemeral_session`, `did`, `oauth_client`
- **Credential Types**: `bearer_token`, `jwt`

## Discovery Metadata

- **OAuth Authorization Server**: `https://allmcps.com/.well-known/oauth-authorization-server`
- **OpenID Connect Discovery**: `https://allmcps.com/.well-known/openid-configuration`
- **OAuth Protected Resource Metadata**: `https://allmcps.com/.well-known/oauth-protected-resource` (RFC 9728)

## Scopes & Permissions

- `mcp:read`: Read-only access to directory search and server metadata.
- `mcp:search`: Real-time vector and text search queries.
- `mcp:write`: Submit new MCP servers or update existing registrations.

## Token Usage

Include your access token in the `Authorization` HTTP header:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```
