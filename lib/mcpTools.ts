import { AD_PLACEMENTS } from '@/lib/ads';
import { AGENT_SCOPES } from '@/lib/agentAuth';
import { DIRECTORY_CATEGORIES } from '@/lib/categories';
import { CLIENT_CONFIG_SLUGS } from '@/lib/clientConfigs';
import {
  AUTH_TYPES,
  COMPATIBLE_CLIENT_SLUGS,
  MAINTENANCE_STATUSES,
  PRICING_MODELS,
  TAG_LIMITS,
} from '@/lib/serverEnums';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/** Every tool /api/mcp serves; also the A2A agent's skills (lib/a2a.ts). */
export const MCP_TOOLS = [
  {
    name: 'search_mcp_servers',
    description:
      'Search the AllMCPs directory for Model Context Protocol (MCP) servers by keyword or category.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search term (e.g., "github", "postgres", "slack", "database")',
        },
        category: {
          type: 'string',
          description:
            'Optional category filter. Accepts a directory category name, its plain label, or its slug (e.g. "Databases" or "databases") — call list_mcp_categories for the full list.',
        },
        limit: {
          type: 'number',
          description: 'Max number of results to return (default: 10, max 50)',
        },
        transport: {
          type: 'string',
          enum: ['remote', 'stdio'],
          description:
            'Optional: only hosted (remote HTTP) servers, or only servers you run locally (stdio).',
        },
        verified_only: {
          type: 'boolean',
          description:
            'Optional: only servers we have seen run — a completed MCP handshake, or a sandbox start that stopped for an API key.',
        },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: 'get_mcp_install_config',
    description:
      'Get setup for one MCP server by ID: the config for every major client (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Cline, Zed, Codex, Gemini CLI, JetBrains, Roo Code, Continue, LM Studio) plus its documentation. Pass `client` for just one.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The server ID (e.g. "github-mcp", "sqlite-mcp")',
        },
        client: {
          type: 'string',
          enum: [...CLIENT_CONFIG_SLUGS, 'cli'],
          description:
            "Optional: return only this client's config (e.g. 'cursor', 'vs-code', 'claude-code').",
        },
      },
      required: ['id'],
    },
    annotations: READ_ONLY,
  },
  {
    name: 'get_mcp_alternatives',
    description:
      'List alternative MCP servers to a given server ID — same category, ranked by fit and evidence that they work.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The server ID to replace' },
        limit: {
          type: 'number',
          description: 'Max alternatives (default: 5, max 10)',
        },
      },
      required: ['id'],
    },
    annotations: READ_ONLY,
  },
  {
    name: 'compare_mcp_servers',
    description:
      'Compare 2 to 4 MCP servers side by side: transport, install command, evidence they work, tool count and source, health, GitHub stars, last commit and quality score.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 4,
          description: 'Server IDs to compare',
        },
      },
      required: ['ids'],
    },
    annotations: READ_ONLY,
  },
  {
    name: 'recommend_mcp_stack',
    description:
      'Recommend a small stack of complementary MCP servers for a role or workflow (e.g. "fullstack web app", "data science", "devops on AWS"), drawn from a live directory search.',
    inputSchema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          description:
            'Developer role or task (e.g. "fullstack", "data", "devops", "browser")',
        },
      },
      required: ['role'],
    },
    annotations: READ_ONLY,
  },
  {
    name: 'list_mcp_categories',
    description:
      'List all categories available in the AllMCPs directory along with server counts.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: 'get_boost_pricing',
    description:
      'Get pricing and features for boosting / featuring an MCP server on AllMCPs.com.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: 'boost_mcp_server',
    description:
      'Start a boost order for an MCP server listing. Returns a Stripe checkout link (for a human to pay by card, with the AGENTREADY 50% agent discount) and, when x402 is enabled, the exact request to pay autonomously in USDC over x402.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The server ID to boost (e.g. "github-mcp")',
        },
        sku: {
          type: 'string',
          enum: [
            'featured_7d',
            'category_sponsor_7d',
            'premium_monthly',
            'priority_review',
          ],
          description: 'Sponsorship tier (default: featured_7d)',
        },
        weeks: {
          type: 'integer',
          minimum: 1,
          maximum: 8,
          description:
            'Weeks to buy for featured_7d / category_sponsor_7d (default 1; longer blocks are cheaper per week)',
        },
        email: {
          type: 'string',
          description: 'Optional contact/billing email',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'quote_sponsor_ad',
    description:
      'Validate a sponsor ad campaign and get its exact cost, plus how to pay: autonomously over x402 (USDC) when enabled, or a link for a human to finish at allmcps.com/advertise/create. Campaigns are reviewed before they serve.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Ad headline' },
        description: { type: 'string', description: 'Ad body copy' },
        ctaText: {
          type: 'string',
          description: 'Button text (default "Learn More")',
        },
        targetUrl: { type: 'string', description: 'https URL the ad links to' },
        logoUrl: { type: 'string', description: 'https URL of a square logo' },
        placement: {
          type: 'string',
          enum: Object.keys(AD_PLACEMENTS),
          description: 'Where the ad shows (default "all")',
        },
        bidCpm: {
          type: 'integer',
          description: 'Bid in cents per 1,000 impressions (default 500 = $5)',
        },
        impressions: {
          type: 'integer',
          description: 'Impressions to buy (default 1000)',
        },
        advertiserEmail: {
          type: 'string',
          description: 'Where receipts and review results are sent',
        },
      },
      required: [
        'title',
        'description',
        'targetUrl',
        'logoUrl',
        'advertiserEmail',
      ],
    },
    annotations: READ_ONLY,
  },
  {
    name: 'get_boost_status',
    description:
      'Check current boost status, verified badge level, and sponsorship expiration for an MCP server by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The server ID to check' },
      },
      required: ['id'],
    },
    annotations: READ_ONLY,
  },
  {
    name: 'submit_mcp_server',
    description:
      'Programmatically submit a new MCP server repository to AllMCPs.com for indexing and review. Supports the same optional enrichment fields as the human submission form — fill in whichever you can confidently determine from the repository (README, package.json, code) to produce a fully flushed-out listing. Omit anything you are not confident about rather than guessing; all enrichment fields are optional and unrecognized enum values are simply dropped, not rejected. Submit each server once, on behalf of the person authorised to list it; bulk or unattended submissions are not allowed (see https://allmcps.com/terms#prohibited-conduct).',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Server name (e.g., "PostgreSQL MCP")',
        },
        url: {
          type: 'string',
          description: 'GitHub repository or website URL',
        },
        description: {
          type: 'string',
          description: 'Short summary of what this MCP server does',
        },
        category: {
          type: 'string',
          enum: DIRECTORY_CATEGORIES,
          description:
            'Best-matching category from the AllMCPs directory. Must be one of the exact enum values.',
        },
        email: {
          type: 'string',
          description:
            'Contact email for listing verification & status updates',
        },
        websiteUrl: {
          type: 'string',
          description: 'Optional official website URL',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          maxItems: TAG_LIMITS.maxTags,
          description: `Up to ${TAG_LIMITS.maxTags} short lowercase keywords describing the server (e.g. ["postgres", "sql", "database"]).`,
        },
        pricingModel: {
          type: 'string',
          enum: [...PRICING_MODELS],
          description: 'How this server is priced/licensed to use.',
        },
        pricingNotes: {
          type: 'string',
          description:
            'Short free-text pricing detail, e.g. "Free tier up to 1k requests/mo".',
        },
        authType: {
          type: 'string',
          enum: [...AUTH_TYPES],
          description: 'What authentication the server requires to connect.',
        },
        license: {
          type: 'string',
          description:
            'SPDX license identifier or name, e.g. "MIT", "Apache-2.0".',
        },
        compatibleClients: {
          type: 'array',
          items: { type: 'string', enum: [...COMPATIBLE_CLIENT_SLUGS] },
          description:
            'MCP clients this server is confirmed to work with, from the fixed client slug list.',
        },
        maintenanceStatus: {
          type: 'string',
          enum: [...MAINTENANCE_STATUSES],
          description:
            'Repository maintenance status, inferred from recent commit/release activity.',
        },
        supportUrl: {
          type: 'string',
          description: 'Optional issues/discussions/docs URL for getting help.',
        },
        suggestedInstallCommand: {
          type: 'string',
          description: 'Command to run the server, e.g. "npx".',
        },
        suggestedInstallArgs: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Args for the install command, e.g. ["-y", "@scope/mcp-server-name"].',
        },
      },
      required: ['name', 'url', 'email'],
    },
  },
  {
    name: 'verify_mcp_claim',
    description:
      'Verify ownership and claim an MCP server listing by checking GitHub README badge, website badge, or DNS TXT record. Works two ways: (1) fully unattended — pass `agentToken` from confirm_mcp_agent (or set an `Authorization: Bearer <token>` header if your client supports it), no human sign-in needed; or (2) if called with neither, requires the caller to already have an active AllMCPs browser session. Unattended agents should use register_mcp_agent + confirm_mcp_agent first.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The server ID to claim & verify (e.g. "github-mcp")',
        },
        method: {
          type: 'string',
          enum: ['github', 'website_badge', 'dns'],
          description: 'Verification method (default: github)',
        },
        websiteUrl: {
          type: 'string',
          description: 'Optional website URL for website/dns verification',
        },
        agentToken: {
          type: 'string',
          description:
            'Bearer token from confirm_mcp_agent, for unattended verification with no browser sign-in. Requires the "listings:claim" scope.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'register_mcp_agent',
    description:
      'Start unattended-agent registration: emails a 6-digit confirmation code to the given address. Follow up with confirm_mcp_agent to exchange the code for a bearer token, which unlocks verify_mcp_claim (and future privileged tools) without ever needing a human to sign in via browser.',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description:
            'Email address to register — must receive mail you (or your operator) can read to retrieve the confirmation code.',
        },
        agentName: {
          type: 'string',
          description: 'Optional label for this agent/integration.',
        },
        scopes: {
          type: 'array',
          items: { type: 'string', enum: [...AGENT_SCOPES] },
          description:
            'Optional — permissions to request. Defaults to the full supported set if omitted.',
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'confirm_mcp_agent',
    description:
      'Exchange the 6-digit code emailed by register_mcp_agent for a durable bearer token (90-day TTL). Pass the returned token as `agentToken` on verify_mcp_claim, or set it as an `Authorization: Bearer <token>` header on subsequent MCP requests if your client supports that.',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Same email address passed to register_mcp_agent.',
        },
        code: {
          type: 'string',
          description: 'The 6-digit code received by email.',
        },
      },
      required: ['email', 'code'],
    },
  },
];
