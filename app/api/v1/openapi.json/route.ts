import { NextResponse } from 'next/server';

// Shared 4xx/5xx error shape returned by every AllMCPs API route — see the
// `{ error, message }` convention used throughout app/api/**/route.ts. Kept
// as one component and referenced by every operation below so agents get a
// single, typed error model to parse instead of guessing per-endpoint.
const ErrorSchema = {
  type: 'object',
  required: ['error', 'message'],
  properties: {
    error: {
      type: 'string',
      description: 'Machine-readable error code, e.g. "not_found", "unauthorized", "insufficient_scope", "invalid_scope".',
    },
    message: { type: 'string', description: 'Human-readable explanation suitable for surfacing to a user or logging.' },
    details: {
      type: 'array',
      items: {},
      description: 'Optional field-level validation issues (present on 400 responses to malformed request bodies).',
    },
    status: { type: 'integer', description: 'Optional echo of the HTTP status code.' },
    docs: { type: 'string', format: 'uri', description: 'Optional link to the relevant documentation for resolving this error.' },
  },
} as const;

function errorResponse(description: string) {
  return {
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  };
}

export async function GET() {
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'AllMCPs Directory API',
      description:
        'Public API for querying and managing Model Context Protocol (MCP) servers listed on AllMCPs. Designed for AI agents, LLM tool callers, and developer integrations.\n\n' +
        '**Versioning & deprecation policy**: this spec is URL-versioned (`/api/v1/...`). Endpoints are additive within v1 — existing fields are not removed or repurposed without a version bump. If an endpoint is ever deprecated, responses will carry a `Deprecation: true` header (and, once a removal date is set, a `Sunset: <RFC 7231 date>` header) for at least 90 days before removal, and the change will be announced at https://allmcps.com/blog. There is currently no deprecated surface in v1.\n\n' +
        '**Auth**: most endpoints are public/unauthenticated (see each operation). Listing-mutating agent actions require a scoped Bearer token — see `components.securitySchemes.agentBearerAuth` and https://allmcps.com/auth.md.',
      version: '1.0.0',
      contact: {
        name: 'AllMCPs Team',
        url: 'https://allmcps.com/contact',
        email: 'contact@allmcps.com',
      },
    },
    servers: [
      {
        url: 'https://allmcps.com',
        description: 'Production Edge Server',
      },
    ],
    components: {
      securitySchemes: {
        // Agent bearer tokens are opaque `amcp_...` strings minted by
        // POST /api/v1/agent/register/confirm — not literal OAuth2, but
        // modeled with scopes here (rather than a bare `http`/`bearer`
        // scheme with no scope concept) because each token carries a real,
        // enforced OAuth-style scope grant. See lib/agentAuth.ts.
        agentBearerAuth: {
          type: 'oauth2',
          description:
            'Bearer token minted via POST /api/v1/agent/register + /api/v1/agent/register/confirm (email-verified, no OAuth redirect flow). Send as `Authorization: Bearer amcp_...`. Also documented at /.well-known/oauth-protected-resource and /auth.md.',
          flows: {
            clientCredentials: {
              tokenUrl: 'https://allmcps.com/api/v1/agent/register/confirm',
              scopes: {
                'listings:claim': 'Claim ownership of an existing MCP server listing via DNS TXT, site badge, or GitHub README proof.',
              },
            },
          },
        },
      },
      schemas: {
        Error: ErrorSchema,
      },
    },
    paths: {
      '/api/v1/search': {
        get: {
          summary: 'Search and filter MCP servers',
          description: 'Query active MCP servers by keyword or category with optional limit parameters. Public, unauthenticated.',
          operationId: 'searchServers',
          parameters: [
            {
              name: 'q',
              in: 'query',
              description: 'Keyword search query',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'category',
              in: 'query',
              description: 'Filter by category name (e.g. Developer Tools, Databases)',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Maximum results to return (1-100)',
              required: false,
              schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
            },
          ],
          responses: {
            '200': {
              description: 'Successful search results',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      query: { type: 'string', nullable: true },
                      category: { type: 'string', nullable: true },
                      servers: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            description: { type: 'string' },
                            category: { type: 'string' },
                            url: { type: 'string' },
                            isOfficial: { type: 'boolean' },
                            isVerifiedActive: { type: 'boolean' },
                            upvotes: { type: 'integer' },
                            installName: { type: 'string' },
                            detailUrl: { type: 'string' },
                            markdownUrl: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '500': errorResponse('Server error while querying the catalog.'),
          },
        },
      },
      '/api/v1/servers/{id}': {
        get: {
          summary: 'Get a single MCP server by ID',
          description: 'Full public listing detail: quality score, popularity signals, install config. Public, unauthenticated.',
          operationId: 'getServerById',
          parameters: [
            { name: 'id', in: 'path', description: 'Unique server ID', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Listing detail',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            '404': errorResponse('No listing exists with this ID.'),
          },
        },
      },
      '/api/v1/categories': {
        get: {
          summary: 'List directory categories',
          description: 'Every category AllMCPs accepts, with label, emoji, slug, and group — use to pick a valid "category" value before submitting. Public, unauthenticated.',
          operationId: 'listCategories',
          responses: {
            '200': {
              description: 'Category list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      categories: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            label: { type: 'string' },
                            slug: { type: 'string' },
                            emoji: { type: 'string' },
                            group: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/health': {
        get: {
          summary: 'Service health check',
          description: 'Lightweight health probe for monitors and agents. Public, unauthenticated.',
          operationId: 'getHealth',
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { status: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } } },
                },
              },
            },
            '500': errorResponse('Service is unhealthy (e.g. database unreachable).'),
          },
        },
      },
      '/api/v1/mcp/{id}/markdown': {
        get: {
          summary: 'Get MCP server details as Markdown',
          description: 'Returns structured LLM-friendly Markdown documentation for an MCP server. Also reachable via `Accept: text/markdown` on `/mcp/{id}`. Public, unauthenticated.',
          operationId: 'getServerMarkdown',
          parameters: [
            {
              name: 'id',
              in: 'path',
              description: 'Unique server ID (e.g. sqlite-mcp-server)',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Markdown document content',
              content: {
                'text/markdown': {
                  schema: { type: 'string' },
                },
              },
            },
            '404': errorResponse('MCP server not found'),
          },
        },
      },
      '/api/v1/submit': {
        post: {
          summary: 'Submit a new MCP server listing',
          description: 'Programmatic submission — no CAPTCHA (unlike the human /submit form). Public, unauthenticated; requires a contact email in the body.',
          operationId: 'submitServer',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'url', 'description', 'category', 'email'],
                  properties: {
                    name: { type: 'string' },
                    url: { type: 'string', format: 'uri' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    tags: { type: 'array', items: { type: 'string' } },
                    license: { type: 'string' },
                    authType: { type: 'string', enum: ['none', 'api_key', 'oauth', 'other'] },
                    pricingModel: { type: 'string', enum: ['free', 'freemium', 'paid', 'byok'] },
                    maintenanceStatus: { type: 'string', enum: ['active', 'stable', 'experimental', 'archived'] },
                    compatibleClients: { type: 'array', items: { type: 'string' } },
                    supportUrl: { type: 'string', format: 'uri' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Listing accepted / queued for review' },
            '400': errorResponse('Missing or invalid required fields.'),
          },
        },
      },
      '/api/v1/agent/register': {
        post: {
          summary: 'Request an agent registration code',
          description: 'Step 1 of agent auth: sends a 6-digit email confirmation code. Optionally request a scoped subset of `listings:claim`-family permissions via `scopes`. Public, unauthenticated.',
          operationId: 'registerAgent',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    agentName: { type: 'string' },
                    scopes: {
                      type: 'array',
                      items: { type: 'string', enum: ['listings:claim'] },
                      description: 'Requested scopes. Omit to receive the full default set.',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Confirmation code sent to email.' },
            '400': errorResponse('Invalid email/payload, or an unsupported scope was requested.'),
          },
        },
      },
      '/api/v1/agent/register/confirm': {
        post: {
          summary: 'Confirm registration & mint a scoped Bearer token',
          description: 'Step 2 of agent auth: exchanges the 6-digit code for an `amcp_...` Bearer token carrying the scopes requested in Step 1. Public, unauthenticated.',
          operationId: 'confirmAgentRegistration',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'code'],
                  properties: { email: { type: 'string', format: 'email' }, code: { type: 'string' } },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Bearer token minted.' },
            '400': errorResponse('Missing/expired/incorrect code, or too many attempts.'),
          },
        },
      },
      '/api/v1/agent/claim': {
        post: {
          summary: 'Claim a listing via agent Bearer token',
          description: 'Claim an existing MCP server listing using DNS TXT, site badge, or GitHub README ownership proof. Requires the `listings:claim` scope.',
          operationId: 'claimListing',
          security: [{ agentBearerAuth: ['listings:claim'] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['id'],
                  properties: {
                    id: { type: 'string' },
                    method: { type: 'string', enum: ['dns', 'website_badge', 'github'], default: 'dns' },
                    websiteUrl: { type: 'string', format: 'uri' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Ownership proof verified; claim approved.' },
            '400': errorResponse('Invalid payload or failed ownership verification.'),
            '401': errorResponse('Missing or invalid Bearer token.'),
            '403': errorResponse('Token is valid but lacks the required `listings:claim` scope.'),
            '404': errorResponse('Listing not found.'),
          },
        },
      },
      '/api/v1/agent/revoke': {
        post: {
          summary: 'Revoke the calling agent Bearer token',
          description: 'Revokes the token used to authenticate this request. Requires a valid (not-yet-revoked) Bearer token — no additional scope needed to revoke your own token.',
          operationId: 'revokeAgentToken',
          security: [{ agentBearerAuth: [] }],
          responses: {
            '200': { description: 'Token revoked.' },
            '401': errorResponse('Missing or invalid Bearer token.'),
          },
        },
      },
      '/api/badge/{id}': {
        get: {
          summary: 'Generate dynamic SVG badge',
          description: 'Returns dynamic SVG badge for README embeds with dark/light themes and directory/featured styles. Public, unauthenticated.',
          operationId: 'getBadgeSvg',
          parameters: [
            {
              name: 'id',
              in: 'path',
              description: 'Server ID',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'style',
              in: 'query',
              description: 'Badge style layout',
              required: false,
              schema: { type: 'string', enum: ['shield', 'flat-square', 'featured', 'directory'], default: 'shield' },
            },
            {
              name: 'metric',
              in: 'query',
              description: 'Displayed data metric',
              required: false,
              schema: { type: 'string', enum: ['status', 'upvotes', 'views', 'installs'], default: 'status' },
            },
            {
              name: 'theme',
              in: 'query',
              description: 'Color theme',
              required: false,
              schema: { type: 'string', enum: ['dark', 'light'], default: 'dark' },
            },
          ],
          responses: {
            '200': {
              description: 'SVG image content',
              content: {
                'image/svg+xml': {
                  schema: { type: 'string' },
                },
              },
            },
            '404': errorResponse('Server ID not found.'),
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
