---
title: "MCP OAuth Authorization: Step-by-Step PKCE and Tokens"
excerpt: "Learn the MCP OAuth authorization flow step by step, including protected resource metadata, dynamic client registration, PKCE, and token audience validation."
tags: ["MCP", "Security", "Guides", "Developer Tools"]
faq:
  - q: "Does every MCP server need OAuth?"
    a: "No. OAuth is primarily needed for remote MCP servers that protect user or organizational resources. A local server using stdio may rely on operating-system permissions, local process identity, or an existing application session. If a remote server exposes protected tools or data, MCP authorization provides a standardized discovery and token flow."
  - q: "What is the resource parameter in MCP OAuth?"
    a: "The resource parameter identifies the MCP server that should accept the resulting access token. The client should use the protected resource identifier from MCP resource metadata in both the authorization request and token request, following the MCP authorization flow. Some authorization servers may have compatibility requirements, but omitting the parameter can produce a token with the wrong audience."
  - q: "Is dynamic client registration mandatory for MCP clients?"
    a: "MCP clients are expected to work with authorization servers that use OAuth metadata and dynamic client registration, but deployments can vary. Some providers pre-register clients or use a client-management process outside the MCP flow. Check the MCP specification and the selected client and server versions before assuming that registration is available or required."
  - q: "Which PKCE method should an MCP client use?"
    a: "An MCP client should use PKCE with the S256 code challenge method. It creates a high-entropy code verifier, sends its SHA-256-derived challenge in the authorization request, and sends the original verifier to the token endpoint. The authorization server rejects the code exchange when the verifier does not match."
---

MCP OAuth authorization is an OAuth 2.1-style flow for connecting an MCP client to a protected remote server. The client discovers protected resource metadata, identifies the authorization server, registers or identifies itself, starts an authorization-code flow with PKCE, and exchanges the code for a token intended for the MCP server. The server then validates a JWT’s signature and claims, or validates an opaque token through token-status or introspection checks, before handling an MCP request.

This guide focuses on the wire-level sequence: protected resource metadata, authorization server discovery, dynamic client registration, PKCE, the resource parameter, and token audience checks. OAuth details vary between MCP clients and identity providers, so test the exact behavior of the versions you deploy. For broader deployment concerns, see the [production guide to securing remote MCP servers](/blog/securing-remote-mcp-servers-authentication-guide) and [MCP security best practices](/mcp-security).

## The actors and endpoints

An MCP OAuth deployment usually has three logical actors:

1. **MCP client**: the host application or agent that connects to the MCP server.
2. **MCP server**: the protected resource server exposing tools, resources, or prompts.
3. **Authorization server**: the OAuth server that authenticates the user and issues access tokens.

The authorization server and MCP server may be operated by the same product, but they are separate roles. An identity provider can issue tokens for several APIs, while the MCP server remains responsible for deciding whether a token is valid for its own resource.

The relevant endpoints are:

- The MCP endpoint, commonly an HTTPS URL used for Streamable HTTP.
- A protected resource metadata endpoint describing how to authorize access to that MCP resource.
- An authorization endpoint where the user authenticates and grants consent.
- A token endpoint where the client exchanges an authorization code.
- Optionally, a dynamic client registration endpoint.

MCP authorization applies to remote HTTP-based connections. Local stdio servers generally do not need this network OAuth discovery sequence, although the application can still use credentials internally.

## 1. Start with the protected MCP request

The client first connects to the MCP server and makes its normal protocol request. If the request lacks a usable bearer token, the server should return HTTP `401 Unauthorized` rather than attempting to infer the user’s identity from an arbitrary header.

A response can include a `WWW-Authenticate` challenge that points to protected resource metadata:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"
```

The exact metadata URL can differ from this example. The important parts are the Bearer challenge and the metadata location. A client should not blindly follow an untrusted URL without applying its own SSRF and redirect controls.

The protected resource metadata document is based on the OAuth protected resource metadata specification. It tells the client which authorization server protects the MCP resource and, where applicable, which scopes and bearer-token methods are supported.

Example:

```json
{
  "resource": "https://mcp.example.com/mcp",
  "authorization_servers": [
    "https://auth.example.com"
  ],
  "scopes_supported": [
    "mcp:read",
    "mcp:write"
  ],
  "bearer_methods_supported": [
    "header"
  ]
}
```

Treat the `resource` value as an identifier, not merely as a display URL. The client should carry this protected resource identifier through the authorization flow: use it in the authorization request and token request as specified by MCP. The value used by the client, authorization server, and resource server must be consistent. A mismatch is a common cause of an apparently valid token being rejected because its audience is wrong.

Some authorization servers have provider-specific compatibility rules around resource indicators or may use a different parameter name in older integrations. Those cases should be handled explicitly by the provider integration. They do not change the MCP flow’s requirement to identify the protected MCP resource consistently.

## 2. Discover authorization server metadata

After reading protected resource metadata, the client selects an authorization server from `authorization_servers`. It then retrieves authorization server metadata using the issuer’s well-known metadata endpoint.

For an issuer such as `https://auth.example.com`, a typical endpoint is:

```text
https://auth.example.com/.well-known/oauth-authorization-server
```

Some identity providers publish OpenID Connect discovery metadata instead, commonly at `/.well-known/openid-configuration`. Whether that endpoint is usable depends on the provider and the MCP client’s discovery support. The returned document should identify endpoints such as:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/oauth2/authorize",
  "token_endpoint": "https://auth.example.com/oauth2/token",
  "registration_endpoint": "https://auth.example.com/oauth2/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code"],
  "code_challenge_methods_supported": ["S256"]
}
```

The client should verify that the metadata’s `issuer` matches the authorization server it selected. It should also require an authorization-code flow with PKCE rather than falling back to an implicit flow or a password grant. OAuth 2.1 removes those older patterns from the recommended authorization model.

The client should persist discovery results for an appropriate period, but it should be able to refresh them when an endpoint changes or a request fails with an authorization-server configuration error. Cache poisoning and redirect handling matter here: discovery should use HTTPS and a narrowly controlled set of network policies.

## 3. Register or identify the OAuth client

The authorization server must know which application is requesting authorization. MCP clients may use dynamic client registration, an existing client registration, or another provider-specific client-identification mechanism.

With dynamic client registration, the client sends metadata to the advertised `registration_endpoint`. A minimal example is:

```http
POST /oauth2/register HTTP/1.1
Host: auth.example.com
Content-Type: application/json

{
  "client_name": "Example MCP Desktop Client",
  "redirect_uris": [
    "http://127.0.0.1:49152/callback"
  ],
  "grant_types": [
    "authorization_code"
  ],
  "response_types": [
    "code"
  ],
  "token_endpoint_auth_method": "none"
}
```

A public native application cannot safely keep a client secret. It commonly uses `token_endpoint_auth_method: "none"` and relies on PKCE. The redirect URI must be exact enough for the provider’s policy. Loopback redirects can use a dynamically selected local port when supported; custom URI schemes and app-claimed HTTPS links are other platform-specific choices.

The registration response normally supplies a `client_id`, and may supply additional information such as a client secret, registration management URL, or expiration. The client must store registration data securely and must not log client credentials.

Do not assume that dynamic registration is open to every caller. An authorization server can require registration authorization, restrict redirect URI patterns, or issue a client ID through an administrative workflow. If the provider pre-registers the client, the client ID and redirect URI still need to match the authorization request exactly.

## 4. Create state and PKCE values

Before redirecting the user, the client creates two independent values:

- `state`: an unpredictable value that binds the callback to the request that started it.
- `code_verifier`: a high-entropy PKCE secret kept by the client until the code exchange.

For S256 PKCE, the client computes:

```text
code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
```

The authorization request contains the challenge, not the verifier. The verifier is sent only to the token endpoint after the user returns with an authorization code.

Example pseudocode:

```text
state = random_bytes(32)
code_verifier = random_urlsafe_string()
code_challenge = base64url(sha256(code_verifier))
```

Store `state`, `code_verifier`, the client ID, redirect URI, authorization server, and protected resource identifier in a short-lived transaction record. Bind the record to the browser or application session where possible. A callback with an unknown, expired, or already-used state must be rejected.

## 5. Build the authorization request

The client sends the user to the authorization endpoint with an authorization-code request. A representative request is:

```text
GET https://auth.example.com/oauth2/authorize?
  response_type=code&
  client_id=client_abc123&
  redirect_uri=http%3A%2F%2F127.0.0.1%3A49152%2Fcallback&
  scope=mcp%3Aread%20mcp%3Awrite&
  state=RANDOM_STATE&
  code_challenge=BASE64URL_CHALLENGE&
  code_challenge_method=S256&
  resource=https%3A%2F%2Fmcp.example.com%2Fmcp
```

The `resource` parameter should contain the protected resource identifier obtained from MCP metadata. It is not an optional decoration in this flow: the client should include it in the authorization request so the authorization server can issue a token for the intended MCP resource. A provider that does not support the parameter may require a documented compatibility adapter, but silently dropping it can result in a token with no usable MCP audience.

Use the scopes advertised by protected resource metadata or the provider’s documented policy. Avoid requesting broad scopes merely because they are available. Providers implementing RFC 8707 resource indicators may use the resource value to set the token audience.

The authorization server authenticates the user, obtains consent where required, validates the client and redirect URI, and redirects back to the registered callback:

```http
HTTP/1.1 302 Found
Location: http://127.0.0.1:49152/callback?code=AUTHORIZATION_CODE&state=RANDOM_STATE
```

The client must compare the returned `state` with the stored value before using the code. If the response contains `error`, `error_description`, or `error_uri`, handle it as an authorization failure and do not attempt a token exchange.

## 6. Exchange the code with PKCE

The client sends the authorization code to the token endpoint over TLS. It includes the original verifier and the protected resource identifier used for the flow.

```http
POST /oauth2/token HTTP/1.1
Host: auth.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTHORIZATION_CODE&
redirect_uri=http%3A%2F%2F127.0.0.1%3A49152%2Fcallback&
client_id=client_abc123&
code_verifier=ORIGINAL_CODE_VERIFIER&
resource=https%3A%2F%2Fmcp.example.com%2Fmcp
```

The resource value in the token request should match the protected resource identifier used in the authorization request and MCP metadata. This consistency allows the authorization server to bind the issued access token to the intended MCP endpoint. If a provider documents a different compatibility behavior, implement and test that behavior rather than guessing.

The authorization server checks that the code is valid, unused, unexpired, bound to the client and redirect URI, and associated with the supplied PKCE verifier. A successful response might look like:

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "mcp:read mcp:write"
}
```

The response can also include a refresh token, depending on the provider and client policy. Store access and refresh tokens using the host platform’s secure storage. Never put them in MCP tool arguments, URLs, source control, ordinary logs, or telemetry payloads.

The client then retries the MCP request with the access token:

```http
POST /mcp HTTP/1.1
Host: mcp.example.com
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

A client must not send the token to a different host merely because that host was returned in a redirect or appears in a tool result. Keep the token bound to the intended protected resource.

## 7. Validate the token at the MCP server

Authentication is not complete when the server can decode a JWT. The MCP server must validate the token as a protected resource server. JWT access tokens require local signature verification with trusted keys, or another documented JWT validation method. Opaque access tokens have no signature to verify; they are commonly validated through authorization-server introspection or another token-status mechanism.

At minimum, check:

1. **Signature or token status**: for JWTs, verify the signature with a trusted key and an allowed algorithm; for opaque tokens, verify that introspection or token-status validation reports the token as active and valid.
2. **Issuer**: require the expected authorization-server issuer.
3. **Audience**: require the MCP protected resource identifier to be present in the token’s audience claim.
4. **Expiry and time claims**: reject expired tokens and apply carefully bounded clock skew.
5. **Token status**: use introspection or revocation checks where the deployment requires them, including when JWT revocation cannot otherwise be detected.
6. **Scopes or permissions**: authorize the requested MCP operation against the token’s granted permissions.
7. **Client or subject context**: apply tenant, user, or client restrictions required by the application.

The audience check is the central protection against token confusion. A token issued for `https://api.example.com` should not be accepted by `https://mcp.example.com/mcp` merely because both services trust the same issuer. The MCP server must require that its protected resource identifier appears in `aud`. It must reject a token when the audience does not include that identifier, whether `aud` is encoded as a scalar string or as an array of strings. Do not require one particular scalar representation; require the MCP resource identifier to be present.

For opaque tokens, introspection commonly returns fields such as `active`, `iss`, `sub`, `aud`, `exp`, and `scope`. For JWT access tokens, claim names and audience shapes vary: `aud` may be a string or an array, and scopes may be represented in `scope`, `scp`, or provider-specific claims. Normalize these differences in one tested validation layer rather than scattering provider assumptions through tool handlers.

A failed token check should return `401 Unauthorized`. A valid token without permission for a particular tool or resource should normally produce an authorization failure, commonly `403 Forbidden`, according to the HTTP and application behavior of the deployment. Do not reveal whether another user, document, or privileged tool exists.

## Common implementation failures

### Accepting any valid issuer token

Issuer validation alone is insufficient. Require the MCP resource identifier in the audience and reject tokens minted for unrelated APIs.

### Omitting or changing the resource identifier

Without a consistent resource value, the provider may mint a token with the wrong audience or reject the request. Record the resource identifier from protected resource metadata and use it in both authorization and token requests according to MCP. Apply any provider-specific compatibility rule explicitly.

### Treating PKCE as optional

For public clients, a client ID is not a secret. PKCE binds the authorization code to the application instance that began the flow. Require S256 and reject authorization-code exchanges that lack a valid verifier.

### Skipping state validation

PKCE protects the code exchange, but state still protects the browser callback transaction and helps prevent login or authorization response mix-up attacks. Validate it before processing the code.

### Logging bearer credentials

Reverse proxies, HTTP access logs, exception traces, and debugging middleware can capture `Authorization` headers. Redact them at every layer and avoid logging complete token responses.

### Assuming all MCP clients behave identically

Discovery paths, refresh behavior, redirect handling, and support for registration vary by client and version. Test with the actual client matrix, and track protocol changes using the [MCP protocol versioning guide](/mcp-protocol-versioning).

## A practical test checklist

Before production, test the complete flow rather than only a successful login:

- An unauthenticated MCP request returns `401` and usable protected resource metadata.
- Metadata points to the expected authorization server and protected resource identifier.
- Authorization server discovery validates the issuer and exposes the required endpoints.
- Registration rejects unapproved redirect URIs.
- Authorization requests include `state`, `code_challenge`, `code_challenge_method=S256`, and the protected resource identifier.
- The token request repeats the same protected resource identifier.
- A mismatched state is rejected.
- A mismatched PKCE verifier fails the token exchange.
- An expired or revoked token is rejected.
- A token from the correct issuer but for a different audience is rejected.
- A token whose audience array does not contain the MCP resource is rejected.
- A token with insufficient scope cannot call a protected tool.
- Refresh and reauthorization behavior does not expose tokens in logs.
- Redirects, DNS resolution, and metadata fetching are constrained to prevent SSRF.

OAuth is one part of an MCP threat model. Review tool authorization, tenant isolation, output handling, rate limits, audit events, and transport choices alongside the token flow. The [production MCP architecture guide](/blog/architecting-production-mcp-servers) covers those surrounding design decisions.

## Next steps

Implement the flow against the MCP specification and your identity provider’s OAuth metadata, then verify resource, audience, scope, PKCE, and opaque-token introspection behavior with automated tests. For examples of OAuth-protected or authentication-oriented directory entries, review the [Box remote MCP server](/mcp/box-mcp-server-box-remote), [Strava MCP server](/mcp/kw510-strava-mcp), and [Keycloak administration MCP server](/mcp/mrz1880-mcp-keycloak-admin). If you are building the server itself, continue with the [MCP server development guide](/build-mcp-server).
