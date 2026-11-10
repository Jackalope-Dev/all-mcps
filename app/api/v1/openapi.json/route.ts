import { NextResponse } from 'next/server';
import { AGENT_SCOPE_DETAILS } from '@/lib/agentAuth';

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
      description:
        'Machine-readable error code, e.g. "not_found", "unauthorized", "insufficient_scope", "invalid_scope".',
    },
    message: {
      type: 'string',
      description:
        'Human-readable explanation suitable for surfacing to a user or logging.',
    },
    details: {
      type: 'array',
      items: {},
      description:
        'Optional field-level validation issues (present on 400 responses to malformed request bodies).',
    },
    status: {
      type: 'integer',
      description: 'Optional echo of the HTTP status code.',
    },
    docs: {
      type: 'string',
      format: 'uri',
      description:
        'Optional link to the relevant documentation for resolving this error.',
    },
  },
} as const;

function errorResponse(description: string) {
  return {
    description,
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/Error' } },
    },
  };
}

// Reusable, machine-declared versioning/deprecation signal (see info.description
// for the written policy). Attached as an optional response header below rather
// than only described in prose, since nothing in v1 is deprecated yet — these
// document the *shape* a deprecated response will carry, not a claim that
// every response carries them today.
const DEPRECATION_HEADERS = {
  Deprecation: {
    description:
      'RFC 8594 style. Present (value "true") only once this specific operation is deprecated; absent otherwise. Not present on any current v1 operation.',
    schema: { type: 'string', enum: ['true'] },
  },
  Sunset: {
    description:
      'RFC 8594 style. Present only once a removal date has been set for a deprecated operation, at least 90 days out. Absent otherwise.',
    schema: { type: 'string', format: 'date-time' },
  },
} as const;

function jsonResponse(
  description: string,
  schema: Record<string, unknown>,
  includeDeprecationHeaders = true,
) {
  return {
    description,
    ...(includeDeprecationHeaders
      ? {
          headers: {
            Deprecation: { $ref: '#/components/headers/Deprecation' },
            Sunset: { $ref: '#/components/headers/Sunset' },
          },
        }
      : {}),
    content: { 'application/json': { schema } },
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
              scopes: Object.fromEntries(
                Object.entries(AGENT_SCOPE_DETAILS).map(([scope, detail]) => [
                  scope,
                  `${detail.description} Required by: ${detail.requiredBy.join(', ')}.`,
                ]),
              ),
            },
          },
        },
      },
      schemas: {
        Error: ErrorSchema,
      },
      headers: DEPRECATION_HEADERS,
    },
    paths: {
      '/api/v1/search': {
        get: {
          summary: 'Search and filter MCP servers',
          description:
            'Query active MCP servers by keyword or category with optional limit parameters. Public, unauthenticated.',
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
              description:
                'Filter by category. Accepts the full stored name, the plain label, or the slug from /api/v1/categories — matching is case-insensitive and ignores surrounding whitespace, so "🗄️ Databases", "Databases", and "databases" are equivalent. An unrecognized value returns 400 unknown_category rather than an empty result set.',
              required: false,
              schema: { type: 'string' },
              examples: {
                slug: { value: 'databases', summary: 'Category slug' },
                label: { value: 'Databases', summary: 'Plain label' },
                name: { value: '🗄️ Databases', summary: 'Full stored name' },
              },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Maximum results to return (1-100)',
              required: false,
              schema: {
                type: 'integer',
                default: 20,
                minimum: 1,
                maximum: 100,
              },
            },
            {
              name: 'transport',
              in: 'query',
              description:
                'Only servers installed over this transport: `stdio` (local process) or `remote` (hosted HTTP endpoint)',
              required: false,
              schema: { type: 'string', enum: ['stdio', 'remote'] },
            },
            {
              name: 'verified',
              in: 'query',
              description:
                '`1` = only servers AllMCPs has seen run: a live tools/list, a sandbox start that asked for keys, or a healthy remote endpoint',
              required: false,
              schema: { type: 'string', enum: ['1'] },
            },
          ],
          responses: {
            '200': {
              description: 'Successful search results',
              headers: {
                Deprecation: { $ref: '#/components/headers/Deprecation' },
                Sunset: { $ref: '#/components/headers/Sunset' },
                'RateLimit-Limit': {
                  schema: { type: 'integer' },
                  description:
                    'Requests allowed per window (see rate-limit docs at /docs/api).',
                },
                'RateLimit-Remaining': {
                  schema: { type: 'integer' },
                  description: 'Requests remaining in the current window.',
                },
                'RateLimit-Reset': {
                  schema: { type: 'integer' },
                  description: 'Seconds until the window resets.',
                },
              },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      query: { type: 'string', nullable: true },
                      category: {
                        type: 'string',
                        nullable: true,
                        description:
                          'The canonical category the request resolved to (the exact stored name), or null when no category filter was applied.',
                      },
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
                            isOfficial: {
                              type: 'boolean',
                              description:
                                'Published by the company behind the product (or a modelcontextprotocol reference server when officialSource is "reference"). Set by AllMCPs admins with evidence, never by payment.',
                            },
                            officialSource: {
                              type: 'string',
                              nullable: true,
                              enum: [
                                'github-org',
                                'vendor-endpoint',
                                'registry-namespace',
                                'vendor-docs',
                                'reference',
                              ],
                            },
                            ownerVerified: {
                              type: 'boolean',
                              description:
                                'The listing owner proved control of it (approved ownership claim).',
                            },
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
            '400': errorResponse(
              'Unknown category (error code "unknown_category"). Fetch /api/v1/categories for the accepted names, labels, and slugs.',
            ),
            '500': errorResponse('Server error while querying the catalog.'),
          },
        },
      },
      '/api/v1/servers/{id}': {
        get: {
          summary: 'Get a single MCP server by ID',
          description:
            'Full public listing detail: quality score, popularity signals, install config, and configs (one ready-to-paste setup per MCP client; null when the install is not confirmed). Pending, rejected and flagged listings return 404. Public, unauthenticated.',
          operationId: 'getServerById',
          parameters: [
            {
              name: 'id',
              in: 'path',
              description: 'Unique server ID',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Listing detail',
              headers: {
                Deprecation: { $ref: '#/components/headers/Deprecation' },
                Sunset: { $ref: '#/components/headers/Sunset' },
                'RateLimit-Limit': { schema: { type: 'integer' } },
                'RateLimit-Remaining': { schema: { type: 'integer' } },
                'RateLimit-Reset': { schema: { type: 'integer' } },
              },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      server: {
                        type: 'object',
                        properties: {
                          configs: {
                            type: 'array',
                            nullable: true,
                            description:
                              'Setup per MCP client, in display order. Null when the install was only guessed.',
                            items: {
                              type: 'object',
                              properties: {
                                client: {
                                  type: 'string',
                                  description:
                                    'Client slug, e.g. claude-desktop, cursor, vs-code, codex, or cli.',
                                },
                                label: { type: 'string' },
                                format: {
                                  type: 'string',
                                  enum: [
                                    'json',
                                    'toml',
                                    'yaml',
                                    'shell',
                                    'text',
                                  ],
                                },
                                locations: {
                                  type: 'array',
                                  items: {
                                    type: 'object',
                                    properties: {
                                      os: { type: 'string' },
                                      path: { type: 'string' },
                                    },
                                  },
                                },
                                snippet: { type: 'string' },
                                note: { type: 'string' },
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
            '404': errorResponse(
              'No listing exists with this ID, or it is pending, rejected or flagged.',
            ),
          },
        },
      },
      '/api/v1/categories': {
        get: {
          summary: 'List directory categories',
          description:
            'Every category AllMCPs accepts, with label, emoji, slug, and group — use to pick a valid "category" value before submitting. Public, unauthenticated.',
          operationId: 'listCategories',
          responses: {
            '200': {
              description: 'Category list',
              headers: {
                Deprecation: { $ref: '#/components/headers/Deprecation' },
                Sunset: { $ref: '#/components/headers/Sunset' },
                'RateLimit-Limit': { schema: { type: 'integer' } },
                'RateLimit-Remaining': { schema: { type: 'integer' } },
                'RateLimit-Reset': { schema: { type: 'integer' } },
              },
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
          description:
            'Lightweight health probe for monitors and agents. Public, unauthenticated.',
          operationId: 'getHealth',
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            '500': errorResponse(
              'Service is unhealthy (e.g. database unreachable).',
            ),
          },
        },
      },
      '/api/v1/mcp/{id}/markdown': {
        get: {
          summary: 'Get MCP server details as Markdown',
          description:
            'Returns structured LLM-friendly Markdown documentation for an MCP server. Also reachable via `Accept: text/markdown` on `/mcp/{id}`. Public, unauthenticated.',
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
          description:
            'Programmatic submission — no CAPTCHA (unlike the human /submit form). Public, unauthenticated; requires a contact email in the body.',
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
                    authType: {
                      type: 'string',
                      enum: ['none', 'api_key', 'oauth', 'other'],
                    },
                    pricingModel: {
                      type: 'string',
                      enum: ['free', 'freemium', 'paid', 'byok'],
                    },
                    maintenanceStatus: {
                      type: 'string',
                      enum: ['active', 'stable', 'experimental', 'archived'],
                    },
                    compatibleClients: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    supportUrl: { type: 'string', format: 'uri' },
                  },
                },
              },
            },
          },
          responses: {
            '200': jsonResponse(
              'Listing accepted; queued for review (status "pending" until claimed or manually approved).',
              {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  message: { type: 'string' },
                  id: { type: 'string', description: 'Assigned listing ID.' },
                  name: { type: 'string' },
                  url: { type: 'string', format: 'uri' },
                  category: { type: 'string' },
                  status: { type: 'string', enum: ['pending'] },
                  claim_url: {
                    type: 'string',
                    format: 'uri',
                    description:
                      'Human ownership-verification page — verifying auto-approves the listing.',
                  },
                  badge_markdown: {
                    type: 'string',
                    description:
                      'Ready-to-paste public README badge; earns a dofollow backlink once detected. It does not prove ownership — claiming uses the personalized badge from claim_url.',
                  },
                },
              },
            ),
            '400': errorResponse('Missing or invalid required fields.'),
          },
        },
      },
      '/api/v1/agent/register': {
        post: {
          summary: 'Request an agent registration code',
          description:
            'Step 1 of agent auth: sends a 6-digit email confirmation code. Optionally request a scoped subset of `listings:claim`-family permissions via `scopes`. Public, unauthenticated.',
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
                      description:
                        'Requested scopes. Omit to receive the full default set.',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': jsonResponse('Confirmation code sent to email.', {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
                email: { type: 'string', format: 'email' },
                scopes: {
                  type: 'array',
                  items: { type: 'string', enum: ['listings:claim'] },
                },
                expiresAt: { type: 'string', format: 'date-time' },
                confirm_url: { type: 'string', format: 'uri' },
              },
            }),
            '400': errorResponse(
              'Invalid email/payload, or an unsupported scope was requested.',
            ),
          },
        },
      },
      '/api/v1/agent/register/confirm': {
        post: {
          summary: 'Confirm registration & mint a scoped Bearer token',
          description:
            'Step 2 of agent auth: exchanges the 6-digit code for an `amcp_...` Bearer token carrying the scopes requested in Step 1. Public, unauthenticated.',
          operationId: 'confirmAgentRegistration',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'code'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    code: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': jsonResponse('Bearer token minted.', {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
                token: {
                  type: 'string',
                  description:
                    'Opaque `amcp_...` bearer token — shown once, store it securely.',
                },
                tokenType: { type: 'string', enum: ['Bearer'] },
                scopes: {
                  type: 'array',
                  items: { type: 'string', enum: ['listings:claim'] },
                },
                expiresAt: { type: 'string', format: 'date-time' },
                docs: {
                  type: 'object',
                  properties: {
                    claim: { type: 'string', format: 'uri' },
                    revoke: { type: 'string', format: 'uri' },
                    authSpec: { type: 'string', format: 'uri' },
                  },
                },
              },
            }),
            '400': errorResponse(
              'Missing/expired/incorrect code, or too many attempts.',
            ),
          },
        },
      },
      '/api/v1/agent/claim': {
        post: {
          summary: 'Claim a listing via agent Bearer token',
          description:
            'Claim an existing MCP server listing using DNS TXT, site badge, or GitHub README ownership proof. Requires the `listings:claim` scope.',
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
                    method: {
                      type: 'string',
                      enum: ['dns', 'website_badge', 'github'],
                      default: 'dns',
                    },
                    websiteUrl: { type: 'string', format: 'uri' },
                  },
                },
              },
            },
          },
          responses: {
            '200': jsonResponse('Ownership proof verified; claim approved.', {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                pending: { type: 'boolean', enum: [false] },
                ownerVerified: {
                  type: 'boolean',
                  enum: [true],
                  description:
                    'The claim sets "Verified owner". It never sets isOfficial, which admins grant only to vendor-published servers.',
                },
                reciprocalBadgeOk: {
                  type: 'boolean',
                  description:
                    'true if a reciprocal AllMCPs badge was detected on the repo README or the website. Website-link dofollow is granted specifically when the badge is on the website (verified separately from the README badge).',
                },
                message: { type: 'string' },
              },
            }),
            '400': errorResponse(
              'Invalid payload or failed ownership verification.',
            ),
            '401': errorResponse('Missing or invalid Bearer token.'),
            '403': errorResponse(
              'Token is valid but lacks the required `listings:claim` scope.',
            ),
            '404': errorResponse('Listing not found.'),
          },
        },
      },
      '/api/v1/agent/revoke': {
        post: {
          summary: 'Revoke the calling agent Bearer token',
          description:
            'Revokes the token used to authenticate this request. Requires a valid (not-yet-revoked) Bearer token — no additional scope needed to revoke your own token.',
          operationId: 'revokeAgentToken',
          security: [{ agentBearerAuth: [] }],
          responses: {
            '200': jsonResponse('Token revoked.', {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
              },
            }),
            '401': errorResponse('Missing or invalid Bearer token.'),
          },
        },
      },
      '/api/v1/boost/pricing': {
        get: {
          summary: 'Boost tiers, prices, and accepted payment methods',
          description:
            'Every paid tier with list and agent price, weekly volume tiers, and whether x402 is currently enabled (`agent_commerce_support.x402.enabled`).',
          operationId: 'getBoostPricing',
          responses: {
            '200': jsonResponse('Pricing.', { type: 'object' }),
          },
        },
      },
      '/api/v1/boost/checkout': {
        post: {
          summary: 'Create a Stripe checkout link for a boost',
          description:
            'Returns a Stripe checkout URL for a human to pay by card. `amount_due` is read back from the Stripe session. The AGENTREADY agent promo is applied by default.',
          operationId: 'createBoostCheckout',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['serverId'],
                  properties: {
                    serverId: { type: 'string' },
                    sku: {
                      type: 'string',
                      enum: [
                        'priority_review',
                        'featured_7d',
                        'category_sponsor_7d',
                        'premium_monthly',
                      ],
                      default: 'featured_7d',
                    },
                    weeks: { type: 'integer', minimum: 1, maximum: 8 },
                    email: { type: 'string', format: 'email' },
                    coupon: { type: 'string', default: 'AGENTREADY' },
                  },
                },
              },
            },
          },
          responses: {
            '200': jsonResponse('Checkout session created.', {
              type: 'object',
              properties: {
                checkout_url: { type: 'string', format: 'uri' },
                amount_due: { type: 'string', nullable: true },
                coupon_applied: { type: 'boolean' },
              },
            }),
            '400': errorResponse('Invalid sku or listing not eligible.'),
            '404': errorResponse('Listing not found.'),
            '409': errorResponse('Category already sponsored.'),
          },
        },
      },
      '/api/v1/boost/x402': {
        post: {
          summary: 'Buy a boost autonomously with x402 (USDC)',
          description:
            'x402 v2, `exact` scheme, USDC on Base. Without a `PAYMENT-SIGNATURE` header this returns 402 with a base64 `PAYMENT-REQUIRED` header (and the same JSON body). Retry with `PAYMENT-SIGNATURE` to pay; the boost activates once payment settles and a `PAYMENT-RESPONSE` header carries the receipt. The price includes the 50% agent discount. Returns 503 while x402 is not enabled.',
          operationId: 'buyBoostX402',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['serverId'],
                  properties: {
                    serverId: { type: 'string' },
                    sku: {
                      type: 'string',
                      enum: [
                        'priority_review',
                        'featured_7d',
                        'category_sponsor_7d',
                      ],
                      default: 'featured_7d',
                    },
                    weeks: { type: 'integer', minimum: 1, maximum: 8 },
                    email: { type: 'string', format: 'email' },
                  },
                },
              },
            },
          },
          responses: {
            '200': jsonResponse('Paid and activated.', { type: 'object' }),
            '400': errorResponse('Invalid sku or listing not eligible.'),
            '402': errorResponse(
              'Payment required, or the supplied payment was invalid (see `error`).',
            ),
            '404': errorResponse('Listing not found.'),
            '409': errorResponse('Category already sponsored.'),
            '503': errorResponse('x402 is not enabled.'),
          },
        },
      },
      '/api/v1/ads/x402': {
        post: {
          summary: 'Buy a sponsor ad campaign autonomously with x402 (USDC)',
          description:
            'Same 402 / PAYMENT-SIGNATURE flow as /api/v1/boost/x402. Cost is impressions / 1000 × bidCpm. The campaign is created only after payment settles, then reviewed before it serves. Returns 503 while x402 is not enabled.',
          operationId: 'buyAdX402',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: [
                    'title',
                    'description',
                    'targetUrl',
                    'logoUrl',
                    'advertiserEmail',
                  ],
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    ctaText: { type: 'string', default: 'Learn More' },
                    targetUrl: { type: 'string', format: 'uri' },
                    logoUrl: { type: 'string', format: 'uri' },
                    placement: {
                      type: 'string',
                      enum: [
                        'all',
                        'directory_inline',
                        'detail_sidebar',
                        'blog_guide',
                        'header_banner',
                      ],
                      default: 'all',
                    },
                    bidCpm: {
                      type: 'integer',
                      description: 'Cents per 1,000 impressions',
                      default: 500,
                    },
                    impressions: { type: 'integer', default: 1000 },
                    advertiserEmail: { type: 'string', format: 'email' },
                  },
                },
              },
            },
          },
          responses: {
            '200': jsonResponse('Paid; campaign created pending review.', {
              type: 'object',
            }),
            '400': errorResponse('Invalid ad.'),
            '402': errorResponse(
              'Payment required, or the supplied payment was invalid (see `error`).',
            ),
            '503': errorResponse('x402 is not enabled.'),
          },
        },
      },
      '/api/a2a': {
        post: {
          summary: 'A2A (Agent2Agent) JSON-RPC endpoint',
          description:
            'A2A 1.0 and 0.3 JSON-RPC binding; send `A2A-Version: 1.0` for 1.0. Each MCP tool is an A2A skill: SendMessage with a data part `{ "skill": "<tool name>", "arguments": {...} }`, or a text part to search. Answers with a Message (no tasks are kept). Agent card: /.well-known/agent-card.json.',
          operationId: 'a2aJsonRpc',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jsonrpc', 'method', 'id'],
                  properties: {
                    jsonrpc: { type: 'string', enum: ['2.0'] },
                    id: {},
                    method: { type: 'string', example: 'SendMessage' },
                    params: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'JSON-RPC 2.0 response (errors use A2A codes).',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
      '/api/acp/checkout_sessions': {
        post: {
          summary: 'Agentic Commerce Protocol checkout (boosts)',
          description:
            'ACP 2026-04-17 checkout_sessions API for buying listing boosts with a Stripe shared payment token. Also GET/POST /api/acp/checkout_sessions/{id}, POST .../complete and .../cancel. Needs `Authorization: Bearer` (agent token with the checkout:write scope), `API-Version: 2026-04-17` and `Idempotency-Key`. Item ids are `<sku>:<listing id>`; quantity is weeks for weekly SKUs. Full contract: https://github.com/agentic-commerce-protocol/agentic-commerce-protocol. Returns 503 while ACP is not enabled.',
          operationId: 'acpCreateCheckoutSession',
          security: [{ agentBearerAuth: ['checkout:write'] }],
          responses: {
            '201': {
              description: 'The checkout session.',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            '400': errorResponse('Bad headers or line items.'),
            '401': errorResponse('Missing or invalid agent token.'),
            '503': errorResponse('ACP is not enabled.'),
          },
        },
      },
      '/api/badge/{id}': {
        get: {
          summary: 'Generate dynamic SVG badge',
          description:
            'Returns dynamic SVG badge for README embeds with dark/light themes and directory/featured styles. Public, unauthenticated.',
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
              schema: {
                type: 'string',
                enum: ['shield', 'flat-square', 'featured', 'directory'],
                default: 'shield',
              },
            },
            {
              name: 'metric',
              in: 'query',
              description: 'Displayed data metric',
              required: false,
              schema: {
                type: 'string',
                enum: ['status', 'upvotes', 'views', 'installs'],
                default: 'status',
              },
            },
            {
              name: 'theme',
              in: 'query',
              description: 'Color theme',
              required: false,
              schema: {
                type: 'string',
                enum: ['dark', 'light'],
                default: 'dark',
              },
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
