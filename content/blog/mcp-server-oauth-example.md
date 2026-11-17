---
title: "MCP Server OAuth Example: Validate Access Tokens"
description: "This MCP server OAuth example adds discovery, JWT validation, and scope checks, with authentication platform choices and tests for rejected tokens."
author: "caden-sumner"
date: 2026-11-17
slug: "mcp-server-oauth-example"
tags: ["Security", "Building Servers", "OAuth", "Authentication", "JWT"]
image: "https://app.lopebase.com/api/content/images/3e1d45df-ffdc-4b18-9578-53e5c0e2dcfc/cover-78a923e3ad58ee4d.png"
image_alt: "MCP Server OAuth Example: Validate Access Tokens"
image_kind: "title_card"
faq: [{"q":"Is this a complete OAuth authorization server?","a":"No. It is the protected-resource side of an MCP server. An external authorization server handles client registration, sign-in, consent, and token issuance. The separation follows the MCP authorization model."},{"q":"Can I use an ID token instead of an access token?","a":"No. MCP requests use access tokens intended for the MCP resource. Don't configure the verifier to accept the OAuth client's audience just to make an ID token pass. See the specification's access-token requirements."},{"q":"What if my provider issues opaque access tokens?","a":"Replace JWT verification with the provider's documented introspection or verification mechanism. Keep the audience, expiration, and scope checks appropriate to that token contract. The official authorization tutorial covers opaque-token introspection."},{"q":"Does every MCP client need dynamic client registration?","a":"No. The specification describes Client ID Metadata Documents, preregistration, and Dynamic Client Registration. Choose a mechanism supported by both your authorization server and intended clients. See MCP client registration requirements."}]
---

Your MCP server needs to reject the wrong token before a tool runs—even when that token has a valid signature. This example adds the resource-server side of OAuth to an existing Express MCP endpoint: public discovery metadata, access-token validation, and a scope requirement.

The example assumes an external authorization server issues signed JWT access tokens. It doesn't implement login, consent, or token issuance. For that browser-side sequence, use [MCP OAuth Authorization: Step-by-Step PKCE and Tokens](https://allmcps.com/blog/mcp-oauth-authorization-flow).

## Choose the Authentication Platform for Your Setup

Start with your application's existing identity system. Switching identity providers solely for MCP creates a migration project before you've tested one authenticated tool call. These are useful starting points for MCP server authentication in 2026; the sections below explain the integration tradeoffs.

| Platform | Pick it when | Main integration tradeoff |
| --- | --- | --- |
| Auth0 | Your application already uses Auth0, or you need its MCP-specific authorization features | You still need to configure and validate the MCP resource audience |
| WorkOS AuthKit Connect | Your application uses AuthKit and needs MCP and OAuth application support | Confirm its token and client-registration behavior against your intended clients |
| Clerk | Your application already uses Clerk users and organizations | Use its OAuth-token verifier rather than treating an ordinary application session as MCP authorization |
| Keycloak | You need control over the authorization server deployment | You own configuration and operations; relevant MCP features have experimental status |

The platform capabilities above are documented by [Auth0](https://auth0.com/blog/auth0-auth-for-mcp-servers-generally-available/), [WorkOS](https://workos.com/docs/authkit/connect), [Clerk](https://clerk.com/docs/expressjs/guides/ai/mcp/build-mcp-server), and [Keycloak](https://www.keycloak.org/securing-apps/mcp-authz-server). Don't assume the JWT example below is a drop-in verifier for every platform.

## Define the Resource and Token Contract

Keep three values separate: the MCP endpoint URL, the authorization server's issuer identifier, and the expected token audience. MCP clients send a `resource` parameter that identifies the MCP server. Your verifier must check that the resulting access token was issued for that server. A signature check alone doesn't establish that boundary. See the [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

For this example, configure your authorization server with this contract:

```text
MCP resource:     https://mcp.example.com/mcp
Expected audience: https://mcp.example.com/mcp
Issuer:          your authorization server's exact issuer
Signing method:  RS256
Required scope:  reports:read
Subject:         authenticated user's identifier
```

`reports:read` is an application-defined scope, not a standard MCP scope. This example protects a read-only reporting server and requires that scope for the entire endpoint. A server with mixed read and write tools needs additional checks at each operation.

Some authorization servers use a dedicated API identifier as the audience instead of the endpoint URL. In that case, configure the verifier with that server-specific identifier while keeping the endpoint URL as the metadata document's `resource`. The official [authorization tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization) describes this distinction.

Use an audience dedicated to this MCP server. Don't reuse the OAuth client's identifier as the resource audience.

## Add Discovery and JWT Validation Before the MCP Handler

This is an integration module for an existing Express application, not a complete MCP server. If you don't have the endpoint yet, start with [Build an MCP Server with the TypeScript SDK](https://allmcps.com/blog/build-mcp-server-typescript-sdk).

Install the JWT library:

```bash
npm install jose
```

Add the following environment variables through your normal deployment configuration. These names belong to this example; they aren't MCP configuration keys.

```dotenv
MCP_RESOURCE=https://mcp.example.com/mcp
MCP_AUDIENCE=https://mcp.example.com/mcp
OAUTH_ISSUER=https://identity.example.com/
OAUTH_JWKS_URI=https://identity.example.com/.well-known/jwks.json
```

Replace the identity URLs with values from your provider's validated discovery document. Don't construct the JWKS URL from a token's unverified claims. The [jose security guidance](https://github.com/panva/jose/security) assumes that remote JWKS sources are trusted configuration.

Save this as `mcp-oauth.mjs`:

```javascript
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const resource = requiredEnv('MCP_RESOURCE');
const audience = requiredEnv('MCP_AUDIENCE');
const issuer = requiredEnv('OAUTH_ISSUER');
const jwks = createRemoteJWKSet(
  new URL(requiredEnv('OAUTH_JWKS_URI'))
);
const scope = 'reports:read';
const metadataUrl = new URL(
  '/.well-known/oauth-protected-resource/mcp',
  resource
).href;

function challenge(res, status, error) {
  const fields = [
    `resource_metadata=${JSON.stringify(metadataUrl)}`,
    `scope=${JSON.stringify(scope)}`,
  ];
  if (error) fields.push(`error=${JSON.stringify(error)}`);
  return res.status(status)
    .set('WWW-Authenticate', `Bearer ${fields.join(', ')}`)
    .end();
}

export function installMcpOAuth(app) {
  app.get('/.well-known/oauth-protected-resource/mcp',
    (_req, res) => res.json({
      resource,
      authorization_servers: [issuer],
      scopes_supported: [scope],
    })
  );

  app.use('/mcp', async (req, res, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(
      req.get('authorization') ?? ''
    );
    if (!match) return challenge(res, 401);

    let payload;
    try {
      ({ payload } = await jwtVerify(match[1], jwks, {
        issuer,
        audience,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'sub'],
      }));
    } catch (error) {
      const outageCodes = [
        'ERR_JWKS_TIMEOUT',
        'ERR_JWKS_INVALID',
        'ERR_JOSE_GENERIC',
      ];
      if (error instanceof errors.JOSEError &&
          !outageCodes.includes(error.code)) {
        return challenge(res, 401, 'invalid_token');
      }
      return res.status(503).set('Retry-After', '5').end();
    }

    if (typeof payload.sub !== 'string' || !payload.sub) {
      return challenge(res, 401, 'invalid_token');
    }
    const scopes = new Set(
      typeof payload.scope === 'string'
        ? payload.scope.split(/\s+/).filter(Boolean)
        : []
    );
    if (!scopes.has(scope)) {
      return challenge(res, 403, 'insufficient_scope');
    }

    res.locals.mcpPrincipal = {
      issuer: payload.iss,
      subject: payload.sub,
      scopes: [...scopes],
    };
    next();
  });
}
```

The verifier uses the real [`jwtVerify` and remote JWKS APIs](https://github.com/panva/jose). It explicitly requires expiration and subject claims, checks issuer and audience, and allows only the signing algorithm selected for this example. If your provider uses another algorithm, change the allowlist to its documented access-token algorithm.

Call the installer before registering your existing `/mcp` transport routes:

```javascript
import { installMcpOAuth } from './mcp-oauth.mjs';

// Configure your existing Origin, Host, and CORS controls first.
installMcpOAuth(app);

// Register your existing MCP transport routes below this line.
```

The discovery route remains public. Authentication failures stop at the middleware, before transport processing. The `401` and `403` challenges follow the [MCP authorization error requirements](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

This example separates invalid credentials from key-fetch failures. A JWKS outage returns `503`; asking the user to log in again won't repair it. That distinction also appears in the official [authorization implementation guidance](https://modelcontextprotocol.io/docs/tutorials/security/authorization).

## Adapt the Integration to Your Identity Provider

### Auth0

Auth0 Auth for MCP provides MCP-oriented authentication features, including Client ID Metadata Document registration and on-behalf-of token exchange. It fits applications that already use Auth0 and want to retain their identity configuration. **Best for:** an existing Auth0 application exposing its own data through MCP. See [Auth0's description of Auth for MCP](https://auth0.com/blog/auth0-auth-for-mcp-servers-generally-available/).

Concrete example: give the reporting MCP server its own API audience, then test that a token for another API in the same tenant fails validation. The tradeoff is configuration responsibility: provider support doesn't remove your server's audience and authorization checks.

### WorkOS AuthKit Connect

WorkOS documents Connect as its AuthKit capability for MCP and OAuth applications. It fits an application already built around AuthKit. **Best for:** extending an existing WorkOS identity setup rather than introducing a second identity system. Start with the [Connect documentation](https://workos.com/docs/authkit/connect).

Concrete example: connect one approved MCP client, obtain a token through its authorization flow, and verify the token's intended resource before wiring up reporting tools. Treat client registration, audience mapping, and token format as acceptance checks. Don't assume a provider's OAuth support guarantees compatibility with every MCP client.

### Clerk

Clerk's MCP guide uses an OAuth-specific verifier with an explicit audience. It fits applications whose users already sign in through Clerk. **Best for:** exposing an existing Clerk application's user-scoped data. Follow [Clerk's Express MCP example](https://clerk.com/docs/expressjs/guides/ai/mcp/build-mcp-server).

Concrete example: its documented `authenticateRequest` call specifies `acceptsToken: 'oauth_token'` and `audience: MCP_RESOURCE_URL`. Use that provider integration instead of assuming this article's generic JWT verifier matches Clerk's token format. The tradeoff is provider-specific verification code in exchange for a documented integration path.

### Keycloak

Keycloak can act as the authorization server while your MCP server publishes protected-resource metadata. It fits deployments that need to operate their own identity infrastructure. **Best for:** teams prepared to own identity-server configuration and upgrades. Its [MCP integration guide](https://www.keycloak.org/securing-apps/mcp-authz-server) documents the setup.

Concrete example: configure an Audience mapper with the MCP server URL as the Included Custom Audience. Keycloak's guide also documents experimental Resource Indicators and Client ID Metadata Document support. Check those feature requirements before choosing a registration strategy. Self-hosting gives you deployment control and adds operational work.

## Keep User and Tenant Checks Inside the Operation

Passing middleware establishes a verified principal and an endpoint-level scope. Your application still needs to decide which reports that principal can read. Use the issuer and subject from `res.locals.mcpPrincipal` to look up the application user, then check report ownership or organization membership.

Treat that property as application-local state. It isn't an MCP SDK field, and Express middleware doesn't automatically pass it into a tool callback. Carry the principal through your transport adapter's documented request context. Don't put it in mutable global state.

Make `reports:read` permit the reporting capability while a separate application check determines access to report `rpt_123`. Don't trust a `tenant_id` supplied in tool arguments as proof of membership. The [MCP authorization tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization) distinguishes token validation from permission checks on sensitive operations.

## Verify Rejection Paths Before Connecting Real Data

First, check that metadata is public and an unauthenticated endpoint request receives a challenge:

```bash
curl -i \
  https://mcp.example.com/.well-known/oauth-protected-resource/mcp

curl -i -X POST https://mcp.example.com/mcp \
  -H 'Content-Type: application/json' \
  --data '{}'
```

The second request deliberately contains no valid MCP operation. It tests whether authentication runs before body dispatch. Expect `401` and a `WWW-Authenticate` header that points to the metadata document.

Then run this acceptance checklist with tokens issued by your authorization server:

- No token: `401` with discovery guidance.
- Expired token: `401`.
- Validly signed token for another audience: `401`.
- Valid token without `reports:read`: `403` with `insufficient_scope`.
- Valid token with the required scope: reaches the MCP transport.
- Valid token for a user outside the report's organization: application authorization denies access.
- Unavailable JWKS endpoint without a usable cached key: server error, not a login challenge.

These expected authentication responses follow the [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization); the organization check is your application's policy.

Finish with your actual MCP client and the [MCP Inspector: Remote Server Acceptance Checklist](https://allmcps.com/blog/mcp-inspector-remote-server-checklist). If you're evaluating an existing server through AllMCPs, use it to find and inspect candidates, then test their documented authentication behavior before installation. A working browser login alone isn't the acceptance test.

## FAQ

### Is this a complete OAuth authorization server?

No. It is the protected-resource side of an MCP server. An external authorization server handles client registration, sign-in, consent, and token issuance. The separation follows the [MCP authorization model](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

### Can I use an ID token instead of an access token?

No. MCP requests use access tokens intended for the MCP resource. Don't configure the verifier to accept the OAuth client's audience just to make an ID token pass. See the specification's [access-token requirements](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

### What if my provider issues opaque access tokens?

Replace JWT verification with the provider's documented introspection or verification mechanism. Keep the audience, expiration, and scope checks appropriate to that token contract. The official [authorization tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization) covers opaque-token introspection.

### Does every MCP client need dynamic client registration?

No. The specification describes Client ID Metadata Documents, preregistration, and Dynamic Client Registration. Choose a mechanism supported by both your authorization server and intended clients. See [MCP client registration requirements](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).
