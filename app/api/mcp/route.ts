import {
  extractRequestMeta,
  logApiAccess,
  logApiAccessBatch,
} from '@/lib/accessLog';
import { fetchActiveSponsorAd, logAiInjectionEvent } from '@/lib/ads';
import {
  AGENT_SCOPES,
  getAgentAuthDb,
  hasAgentScope,
  resolveAgentAuthFlexible,
} from '@/lib/agentAuth';
import { confirmAgentRegistration } from '@/lib/agentConfirm';
import { registerAgent } from '@/lib/agentRegister';
import { DIRECTORY_CATEGORIES, resolveCategoryParam } from '@/lib/categories';
import { claimListing } from '@/lib/claimListing';
import { CLIENT_CONFIG_SLUGS } from '@/lib/clientConfigs';
import { listingClientConfigs } from '@/lib/listingClientConfigs';
import {
  checkModernRequest,
  modernRequestVersion,
  negotiateLegacyVersion,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '@/lib/mcpProtocol';
import {
  formatClientConfigsMarkdown,
  formatComparisonMarkdown,
  formatListingLine,
  listingFacts,
  sponsorContentBlock,
} from '@/lib/mcpToolFormat';
import { formatUsd, PAID_PRODUCTS, type PaidSku } from '@/lib/pricing';
import {
  checkRateLimit,
  clientKey,
  rateLimitedResponse,
} from '@/lib/rateLimit';
import { isServable } from '@/lib/servability';
import {
  AUTH_TYPES,
  COMPATIBLE_CLIENT_SLUGS,
  MAINTENANCE_STATUSES,
  PRICING_MODELS,
  TAG_LIMITS,
} from '@/lib/serverEnums';
import {
  formatServerAsMarkdown,
  getCategoryCounts,
  getRelatedServers,
  getServerById,
  type Server,
  searchActiveServers,
} from '@/lib/servers';
import { submitListing } from '@/lib/submitListing';
import { computeTrustTier } from '@/lib/trustTier';

const SERVER_INFO = {
  name: 'AllMCPs Directory Server',
  version: '1.5.0',
};

const SERVER_INSTRUCTIONS =
  'AllMCPs is a curated directory of MCP servers. Use search_mcp_servers to find servers for a task, get_mcp_install_config for setup in a specific client, get_mcp_alternatives and compare_mcp_servers to choose between options. Listings that are pending review or flagged as dead are never returned.';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

const TOOLS = [
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
      'Initiate a sponsorship / boost order for an MCP server by ID, returning a Stripe checkout session URL and x402 invoice.',
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
        email: {
          type: 'string',
          description: 'Optional contact/billing email',
        },
      },
      required: ['id'],
    },
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
      'Programmatically submit a new MCP server repository to AllMCPs.com for indexing and review. Supports the same optional enrichment fields as the human submission form — fill in whichever you can confidently determine from the repository (README, package.json, code) to produce a fully flushed-out listing. Omit anything you are not confident about rather than guessing; all enrichment fields are optional and unrecognized enum values are simply dropped, not rejected.',
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

const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name',
    },
  });
}

export async function GET(request: Request) {
  // An MCP client opening a GET stream (2025 Streamable HTTP) gets the spec's
  // "no stream here" answer; anyone else gets a description of the endpoint.
  if ((request.headers.get('accept') || '').includes('text/event-stream')) {
    return new Response(null, {
      status: 405,
      headers: { ...CORS, Allow: 'POST, OPTIONS' },
    });
  }
  return Response.json(
    {
      status: 'active',
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      mcpEndpoint: 'https://allmcps.com/api/mcp',
      protocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
      description:
        'Model Context Protocol remote server for the AllMCPs directory: search, per-client install configs, alternatives, comparisons, submissions and claim verification.',
      tools: TOOLS.map((t) => t.name),
    },
    {
      headers: {
        ...CORS,
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}

type TextContent = {
  type: 'text';
  text: string;
  annotations?: Record<string, unknown>;
};

/** Up to `limit` results that pass the optional filters, searching wider when filtering. */
async function filteredSearch(opts: {
  query: string;
  category: string | null;
  limit: number;
  transport: 'remote' | 'stdio' | null;
  verifiedOnly: boolean;
}): Promise<Server[]> {
  const filtering = Boolean(opts.transport || opts.verifiedOnly);
  const results = await searchActiveServers({
    query: opts.query,
    category: opts.category,
    limit: filtering ? Math.min(opts.limit * 4, 100) : opts.limit,
    vectorTopK: 30,
  });
  if (!filtering) return results;
  return results
    .filter((s) => {
      if (opts.verifiedOnly) {
        const tier = computeTrustTier(s);
        if (tier !== 'verified' && tier !== 'runs_needs_keys') return false;
      }
      // A guessed install has no known transport, so it never matches.
      if (opts.transport && listingFacts(s).transport !== opts.transport)
        return false;
      return true;
    })
    .slice(0, opts.limit);
}

export async function POST(request: Request) {
  async function logMcp(serverId: string | null, tool: string) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const cfCtx = await getCloudflareContext();
      if (cfCtx?.env && (cfCtx.env as any).DB) {
        const logDb = (await import('drizzle-orm/d1')).drizzle(
          (cfCtx.env as any).DB,
        );
        const meta = extractRequestMeta(request);
        cfCtx.ctx.waitUntil(
          logApiAccess(logDb, {
            serverId,
            endpoint: 'mcp_jsonrpc',
            methodOrTool: tool,
            userAgent: meta.userAgent,
            ipCountry: meta.ipCountry,
          }),
        );
      }
    } catch {
      /* best-effort */
    }
  }

  // Attribute a search_mcp_servers call to every server it surfaced, so
  // each owner's "search queries that find you" panel has data — a single
  // serverId:null row (like other tool calls use) is invisible to every
  // server's per-id analytics query.
  async function logMcpSearch(serverIds: string[], tool: string) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const cfCtx = await getCloudflareContext();
      if (cfCtx?.env && (cfCtx.env as any).DB) {
        const logDb = (await import('drizzle-orm/d1')).drizzle(
          (cfCtx.env as any).DB,
        );
        const meta = extractRequestMeta(request);
        cfCtx.ctx.waitUntil(
          serverIds.length > 0
            ? logApiAccessBatch(logDb, {
                serverIds,
                endpoint: 'mcp_jsonrpc',
                methodOrTool: tool,
                userAgent: meta.userAgent,
                ipCountry: meta.ipCountry,
              })
            : logApiAccess(logDb, {
                serverId: null,
                endpoint: 'mcp_jsonrpc',
                methodOrTool: tool,
                userAgent: meta.userAgent,
                ipCountry: meta.ipCountry,
              }),
        );
      }
    } catch {
      /* best-effort */
    }
  }

  const rateLimit = checkRateLimit(
    `mcp_jsonrpc:${clientKey(request)}`,
    120,
    60,
  );
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit, CORS);

  let rpcId: unknown = null;
  try {
    const body = (await request.json()) as any;
    const { jsonrpc, id, method, params } = body || {};
    rpcId = id ?? null;

    const error = (
      code: number,
      message: string,
      status = 200,
      data?: Record<string, unknown>,
    ) =>
      Response.json(
        {
          jsonrpc: '2.0',
          id: id ?? null,
          error: { code, message, ...(data ? { data } : {}) },
        },
        { status, headers: CORS },
      );

    if (jsonrpc !== '2.0' || typeof method !== 'string') {
      return error(
        -32600,
        'Invalid Request: jsonrpc must be 2.0 and method a string',
        400,
      );
    }

    // A notification (no id) gets 202 with no body on Streamable HTTP.
    if (id === undefined || method.startsWith('notifications/')) {
      return new Response(null, { status: 202, headers: CORS });
    }

    // Modern (2026-07-28+) requests declare their version per request; legacy
    // ones negotiated it at initialize. See lib/mcpProtocol.ts.
    const modernVersion = modernRequestVersion(params);
    if (modernVersion) {
      const check = checkModernRequest({
        version: modernVersion,
        method,
        params,
        headers: request.headers,
      });
      if (!check.ok)
        return error(check.code, check.message, check.status, check.data);
    }
    const modern = modernVersion !== null;

    const result = (r: Record<string, unknown>) =>
      Response.json(
        {
          jsonrpc: '2.0',
          id,
          result: modern ? { resultType: 'complete', ...r } : r,
        },
        { headers: CORS },
      );
    const toolResult = (
      content: TextContent[],
      opts: { isError?: boolean; structuredContent?: unknown } = {},
    ) =>
      result({
        content,
        ...(opts.structuredContent !== undefined
          ? { structuredContent: opts.structuredContent }
          : {}),
        ...(opts.isError ? { isError: true } : {}),
      });
    const text = (t: string, isError = false) =>
      toolResult([{ type: 'text', text: t }], { isError });

    if (method === 'initialize') {
      const clientName = params?.clientInfo?.name;
      await logMcp(
        null,
        clientName ? `initialize (${clientName})` : 'initialize',
      );
      return result({
        protocolVersion: negotiateLegacyVersion(params?.protocolVersion),
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      });
    }

    if (method === 'server/discover') {
      await logMcp(null, 'server/discover');
      return result({
        supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
        capabilities: { tools: {} },
        _meta: { 'io.modelcontextprotocol/serverInfo': SERVER_INFO },
        instructions: SERVER_INSTRUCTIONS,
        ttlMs: 3_600_000,
        cacheScope: 'public',
      });
    }

    if (method === 'ping') return result({});

    if (method === 'tools/list') {
      return result({
        tools: TOOLS,
        ...(modern ? { ttlMs: 300_000, cacheScope: 'public' } : {}),
      });
    }

    if (method !== 'tools/call') {
      return error(-32601, `Method not found: ${method}`, 404);
    }

    const toolName = params?.name;
    const args = params?.arguments || {};

    if (toolName === 'search_mcp_servers') {
      const query = String(args.query || '')
        .toLowerCase()
        .trim();
      const rawCategory = String(args.category || '').trim();
      // Stored categories carry an emoji prefix and are matched exactly, so a
      // raw agent-supplied string has to be resolved onto the catalog first.
      const category = resolveCategoryParam(rawCategory);
      const limit = Math.min(Math.max(1, Number(args.limit) || 10), 50);
      const transport =
        args.transport === 'remote' || args.transport === 'stdio'
          ? args.transport
          : null;

      if (rawCategory && !category) {
        return text(
          `Unknown category "${rawCategory}". Call list_mcp_categories for the valid names, labels, and slugs.`,
          true,
        );
      }

      // Candidate filtering happens in D1 and only returns servable listings
      // (active, not flagged). The full catalog no longer fits in a Worker.
      const results = await filteredSearch({
        query,
        category: category ?? null,
        limit,
        transport,
        verifiedOnly: args.verified_only === true,
      });
      const textOutput =
        results.length > 0
          ? results.map((s) => formatServerAsMarkdown(s)).join('\n---\n\n')
          : category && !query
            ? `No MCP servers found in category: "${category}"`
            : `No MCP servers found matching query: "${query}"`;

      const content: TextContent[] = [{ type: 'text', text: textOutput }];
      const activeAd = await fetchActiveSponsorAd('all');
      if (activeAd) {
        content.push(sponsorContentBlock(activeAd));
        await logAiInjectionEvent(activeAd.id, activeAd.placement);
      }

      await logMcpSearch(
        query ? results.map((s) => s.id) : [],
        `search_mcp_servers${query ? ` query: ${query}` : ''}`,
      );
      return toolResult(content, {
        structuredContent: { results: results.map(listingFacts) },
      });
    }

    if (toolName === 'get_mcp_install_config') {
      const serverId = String(args.id || '');
      const server = await getServerById(serverId);

      if (!server || !isServable(server)) {
        return text(
          server
            ? `"${server.name}" is not currently listed in the AllMCPs directory (${server.staleFlaggedAt ? 'flagged for review' : server.status}), so no install config is offered. Use search_mcp_servers to find an alternative.`
            : `Server with ID "${serverId}" not found in AllMCPs directory.`,
          true,
        );
      }

      const all = listingClientConfigs(server);
      const wanted =
        typeof args.client === 'string' && args.client ? args.client : null;
      const configs =
        all && wanted ? all.filter((c) => c.client === wanted) : all;
      if (all && configs && configs.length === 0) {
        return text(
          `No "${wanted}" config for this server. Valid clients: ${all.map((c) => c.client).join(', ')}.`,
          true,
        );
      }

      const textOutput = `${formatServerAsMarkdown(server)}\n${formatClientConfigsMarkdown(configs)}`;
      await logMcp(serverId, 'get_mcp_install_config');
      return toolResult([{ type: 'text', text: textOutput }], {
        structuredContent: {
          id: server.id,
          name: server.name,
          envVars: server.aiEnvVars || [],
          configs,
        },
      });
    }

    if (toolName === 'get_mcp_alternatives') {
      const serverId = String(args.id || '');
      const limit = Math.min(Math.max(1, Number(args.limit) || 5), 10);
      const server = await getServerById(serverId);
      // Pending, removed and flagged listings are not in the directory.
      if (!server || !isServable(server)) {
        return text(
          `Server with ID "${serverId}" not found in AllMCPs directory.`,
          true,
        );
      }
      // getRelatedServers reads servable listings only.
      const facts = (await getRelatedServers(server, limit)).map(listingFacts);
      const md =
        facts.length > 0
          ? `# Alternatives to ${server.name}\n\n${facts.map(formatListingLine).join('\n')}\n`
          : `No alternatives to ${server.name} found in its category yet.`;
      await logMcp(serverId, 'get_mcp_alternatives');
      return toolResult([{ type: 'text', text: md }], {
        structuredContent: { id: server.id, alternatives: facts },
      });
    }

    if (toolName === 'compare_mcp_servers') {
      const ids: string[] = Array.isArray(args.ids)
        ? [...new Set<string>(args.ids.map(String))]
        : [];
      if (ids.length < 2 || ids.length > 4) {
        return text('Pass 2 to 4 distinct server IDs in `ids`.', true);
      }
      const found = await Promise.all(ids.map((sid) => getServerById(sid)));
      const missing = ids.filter((_, i) => {
        const s = found[i];
        return !s || !isServable(s);
      });
      if (missing.length > 0) {
        return text(`Not found in AllMCPs: ${missing.join(', ')}.`, true);
      }
      const facts = (found as Server[]).map(listingFacts);
      await logMcp(null, `compare_mcp_servers ${ids.join(',')}`);
      return toolResult(
        [{ type: 'text', text: formatComparisonMarkdown(facts) }],
        { structuredContent: { servers: facts } },
      );
    }

    if (toolName === 'recommend_mcp_stack') {
      const role = String(args.role || '').trim();
      if (!role) return text('Pass a `role`, e.g. "data science".', true);

      // One directory search for the role, then at most one server per
      // category so the stack spans the workflow instead of five near-copies.
      const hits = await searchActiveServers({
        query: role.toLowerCase(),
        limit: 24,
        vectorTopK: 30,
      });
      const seenCategories = new Set<string>();
      const stack: Server[] = [];
      for (const s of hits) {
        if (stack.length >= 5) break;
        if (seenCategories.has(s.category)) continue;
        seenCategories.add(s.category);
        stack.push(s);
      }

      const facts = stack.map(listingFacts);
      const md =
        facts.length > 0
          ? `# MCP stack for "${role}"\n\n${facts.map(formatListingLine).join('\n')}\n\nCall get_mcp_install_config with an ID for setup in your client.\n`
          : `No MCP servers found for "${role}". Try a more specific task, e.g. "postgres", "browser automation" or "github".`;
      const content: TextContent[] = [{ type: 'text', text: md }];
      const activeAd = await fetchActiveSponsorAd('all');
      if (activeAd) {
        content.push(sponsorContentBlock(activeAd));
        await logAiInjectionEvent(activeAd.id, activeAd.placement);
      }

      await logMcp(null, `recommend_mcp_stack role: ${role.toLowerCase()}`);
      return toolResult(content, { structuredContent: { role, stack: facts } });
    }

    if (toolName === 'list_mcp_categories') {
      const counts = await getCategoryCounts();

      let md = `# AllMCPs Categories\n\n`;
      for (const [cat, count] of Object.entries(counts)) {
        md += `- **${cat}**: ${count} servers\n`;
      }

      await logMcp(null, 'list_mcp_categories');
      return text(md);
    }

    if (toolName === 'get_boost_pricing') {
      let md = `# AllMCPs Server Boosting & Sponsorship Tiers\n\n`;
      md += `🎁 **AI Agent Exclusive 50% Off Promo**: Use promo code \`AGENTREADY\` at checkout for 50% off any tier!\n\n`;
      for (const p of Object.values(PAID_PRODUCTS)) {
        const halfPrice = formatUsd(Math.round(p.unitAmount * 0.5));
        md += `### ${p.name} (${p.sku})\n`;
        md += `- **Regular Price**: ${formatUsd(p.unitAmount)} (${p.interval})\n`;
        md += `- **Agent 50% Off Price (\`AGENTREADY\`)**: ${halfPrice}\n`;
        md += `- **Tagline**: ${p.tagline}\n`;
        md += `- **Benefits**:\n`;
        for (const b of p.benefits) {
          md += `  - ${b}\n`;
        }
        md += `\n`;
      }

      await logMcp(null, 'get_boost_pricing');
      return text(md);
    }

    if (toolName === 'boost_mcp_server') {
      const serverId = args.id;
      const sku = (args.sku || 'featured_7d') as PaidSku;

      const server = await getServerById(serverId);
      if (!server) {
        return text(
          `Server "${serverId}" not found in AllMCPs directory.`,
          true,
        );
      }

      const product = PAID_PRODUCTS[sku];
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://allmcps.com';
      const checkoutUrl = `${appUrl}/pricing?serverId=${encodeURIComponent(serverId)}&sku=${sku}&coupon=AGENTREADY`;
      const regularPrice = product ? formatUsd(product.unitAmount) : 'N/A';
      const discountedPrice = product
        ? formatUsd(Math.round(product.unitAmount * 0.5))
        : 'N/A';

      const outputText = `# Boost Order Created for "${server.name}"

- **Server ID**: ${server.id}
- **Selected Tier**: ${product ? product.name : sku}
- **Regular Price**: ${regularPrice}
- **Agent Discounted Price (50% Off with AGENTREADY)**: **${discountedPrice}**
- **Applied Coupon**: \`AGENTREADY\`
- **Checkout URL**: [Complete 50% Off Payment via Stripe](${checkoutUrl})

### Autonomous Agent Payment (x402 Protocol)
\`\`\`json
{
  "spec": "x402-v1",
  "asset": "USD",
  "amount": ${product ? product.unitAmount / 100 : 0},
  "payee": "AllMCPs Directory",
  "checkout_url": "${checkoutUrl}"
}
\`\`\`

To complete activation, open the checkout URL or trigger autonomous agent payment.`;

      await logMcp(serverId, `boost_mcp_server sku:${sku}`);
      return text(outputText);
    }

    if (toolName === 'get_boost_status') {
      const serverId = args.id;
      const server = await getServerById(serverId);

      if (!server) {
        return text(`Server "${serverId}" not found.`, true);
      }

      const isFeatured = !!(server as any).isFeatured;
      const isPremium = !!(server as any).isPremium;
      const featuredUntil = (server as any).featuredUntil
        ? new Date((server as any).featuredUntil).toISOString()
        : 'N/A';

      const md = `# Boost Status for "${server.name}"

- **Server ID**: ${server.id}
- **Status**: ${server.status}
- **Featured Boost**: ${isFeatured ? '✅ Active' : '❌ Inactive'}
- **Premium Subscription**: ${isPremium ? '✅ Active' : '❌ Inactive'}
- **Featured Expiration**: ${featuredUntil}
- **Category**: ${server.category}
`;

      await logMcp(serverId, 'get_boost_status');
      return text(md);
    }

    if (toolName === 'submit_mcp_server') {
      const {
        tags,
        pricingModel,
        authType,
        license,
        compatibleClients,
        maintenanceStatus,
        supportUrl,
        suggestedInstallCommand,
      } = args;

      // Call the submission logic in-process rather than `fetch()`-ing
      // `/api/v1/submit` — a same-zone Worker subrequest back to this own
      // deployment isn't reliable and was silently failing every call here,
      // regardless of payload validity (see lib/submitListing.ts).
      const outcome = await submitListing(
        args,
        `mcp_tool:${clientKey(request)}`,
      );

      if (outcome.ok) {
        const data = outcome.body;
        const enrichedFields = [
          tags?.length && `tags: ${tags.join(', ')}`,
          pricingModel && `pricing: ${pricingModel}`,
          authType && `auth: ${authType}`,
          license && `license: ${license}`,
          maintenanceStatus && `status: ${maintenanceStatus}`,
          compatibleClients?.length &&
            `clients: ${compatibleClients.join(', ')}`,
          supportUrl && `support: ${supportUrl}`,
          suggestedInstallCommand && `install: ${suggestedInstallCommand}`,
        ].filter(Boolean);

        const md = `# MCP Server "${data.name}" Submitted Successfully! 🎉

- **Server ID**: ${data.id}
- **Status**: ${data.status} (Pending Manual Review & Verification)
- **Claim & Verify URL**: [Verify Listing](${data.claim_url})
${enrichedFields.length ? `- **Enrichment captured**: ${enrichedFields.join(' · ')}\n` : ''}
### Add Verification Badge to your README.md
To verify your listing automatically and trigger immediate indexing, embed this markdown badge in your GitHub repository:

\`\`\`markdown
${data.badge_markdown}
\`\`\`
`;
        await logMcp(data.id, 'submit_mcp_server');
        return text(md);
      }

      const errMsg =
        typeof outcome.body?.error === 'string'
          ? outcome.body.error
          : 'Invalid submission payload';
      return text(`Submission failed: ${errMsg}`, true);
    }

    if (toolName === 'register_mcp_agent') {
      const outcome = await registerAgent(args);
      const msg = outcome.ok
        ? `# Registration Code Sent

A 6-digit confirmation code was emailed to **${outcome.body.email}**. It expires at ${outcome.body.expiresAt}.

Next: call \`confirm_mcp_agent\` with the same email and that code to receive a bearer token.`
        : `Registration failed: ${typeof outcome.body?.error === 'string' ? outcome.body.error : 'Invalid registration payload'}`;

      await logMcp(null, 'register_mcp_agent');
      return text(msg, !outcome.ok);
    }

    if (toolName === 'confirm_mcp_agent') {
      const outcome = await confirmAgentRegistration(args);
      const msg = outcome.ok
        ? `# Agent Registered

- **Bearer Token**: \`${outcome.body.token}\`
- **Scopes**: ${outcome.body.scopes.join(', ')}
- **Expires**: ${outcome.body.expiresAt}

Save this token — pass it as \`agentToken\` on \`verify_mcp_claim\` calls (or as an \`Authorization: Bearer\` header if your client supports it). It will not be shown again; re-run register_mcp_agent + confirm_mcp_agent to mint a new one if lost.`
        : `Confirmation failed: ${typeof outcome.body?.error === 'string' ? outcome.body.error : 'Invalid confirmation payload'}`;

      await logMcp(null, 'confirm_mcp_agent');
      return text(msg, !outcome.ok);
    }

    if (toolName === 'verify_mcp_claim') {
      return handleVerifyMcpClaim(args, request, logMcp, text);
    }

    // The spec's protocol error for an unknown tool.
    return error(-32602, `Unknown tool: ${toolName}`);
  } catch (e: any) {
    return Response.json(
      {
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32603, message: e?.message || 'Internal error' },
      },
      { status: 500, headers: CORS },
    );
  }
}

async function handleVerifyMcpClaim(
  args: any,
  request: Request,
  logMcp: (serverId: string | null, tool: string) => Promise<void>,
  text: (t: string, isError?: boolean) => Response,
): Promise<Response> {
  const {
    id: serverId,
    method = 'github',
    websiteUrl,
    agentToken,
  } = args || {};

  // Prefer a resolved agent bearer token (header, or the `agentToken`
  // arg for clients that can't set custom headers per call) so this
  // works fully unattended — see register_mcp_agent/confirm_mcp_agent.
  // Falls back to a browser session cookie (claimListing's default)
  // when neither is present.
  const authDb = await getAgentAuthDb();
  const agent = authDb
    ? await resolveAgentAuthFlexible(
        authDb,
        request.headers.get('Authorization'),
        typeof agentToken === 'string' ? agentToken : null,
      )
    : null;

  if (agent && !hasAgentScope(agent, 'listings:claim')) {
    return text(
      `Verification failed: this agent token was not granted the "listings:claim" scope (granted: ${agent.scopes.join(', ') || 'none'}). Re-register with register_mcp_agent requesting scopes: ["listings:claim"].`,
      true,
    );
  }

  // In-process, not a self-`fetch()` — see lib/submitListing.ts for why.
  const outcome = await claimListing(
    { id: serverId, method, websiteUrl },
    agent ? { userId: agent.userId, email: agent.email } : undefined,
  );

  if (outcome.ok) {
    const data = outcome.body as any;
    const md = `# Listing Verification Result for "${serverId}"
- **Server ID**: ${serverId}
- **Method**: ${method}
- **Status**: ${data.pending ? '⏳ Under Admin Review' : '✅ Verified & Claimed!'}
- **Message**: ${data.message}
`;
    await logMcp(serverId, `verify_mcp_claim method:${method}`);
    return text(md);
  }

  const errMsg =
    typeof outcome.body?.error === 'string'
      ? outcome.body.error
      : 'Proof not found or sign-in required.';
  return text(`Verification failed: ${errMsg}`, true);
}
