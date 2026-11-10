import { BEST_TOPICS } from './bestTopics';
import { getAllPosts } from './blog';
import {
  type CatalogCount,
  formatCatalogAsOf,
  getCatalogCount,
} from './catalogCount';
import { categorySlug } from './categories';
import { MCP_CLIENTS } from './clients';
import { WORKFLOW_PROMPTS } from './prompts';
import {
  type CatalogIndexRow,
  formatServerAsMarkdown,
  getCatalogIndexRows,
  getServersForLlmsTxt,
  iterateActiveServers,
  type LlmsTxtServer,
} from './servers';

/**
 * The content of the whole-catalog exports, as chunks of text. Built by
 * /api/cron/exports into R2 (lib/catalogExportStore.ts); /llms.txt and
 * /data.json also build inline as a fallback while no stored copy exists.
 * /llms-full.txt never does: it is ~90 MB.
 *
 * Each one throws when D1 fails (after lib/d1Retry.ts's one retry per page),
 * so a build never stores a partial catalog.
 */

export type ExportBuild = {
  /** Listings in the export. */
  rows: number;
  chunks: AsyncIterable<string> | Iterable<string>;
};

/** /llms-full.txt: every servable listing as markdown, one D1 page at a time. */
export async function buildLlmsFull(
  catalog: CatalogCount | null,
  now = new Date(),
): Promise<ExportBuild> {
  const pages = iterateActiveServers();
  // Read the first page before committing to a build, so a dead D1 fails
  // fast instead of after the header.
  const first = await pages.next();
  let header = `# AllMCPs - Complete Catalog Export (LLM Format)\n\n`;
  header += `> Every Model Context Protocol (MCP) server listed on https://allmcps.com.\n`;
  if (catalog) {
    header += `> Listings: ${catalog.count} (as of ${formatCatalogAsOf(catalog)})\n`;
  }
  header += `> Promo code AGENTREADY takes 50% off paid boosts, priority review and Premium. Listing is free without it.\n`;
  header += `> Generated: ${now.toISOString()}\n\n`;

  const build: ExportBuild = { rows: 0, chunks: [] };
  build.chunks = (async function* () {
    yield header;
    let next = first;
    while (!next.done) {
      build.rows += next.value.length;
      yield next.value
        .map((server) => `${formatServerAsMarkdown(server)}\n---\n\n`)
        .join('');
      next = await pages.next();
    }
  })();
  return build;
}

/** Servers per JSON chunk: keeps each string a few hundred KB. */
const JSON_CHUNK_ROWS = 1000;

/** /data.json: the structured dataset. */
export async function buildDataJson(
  catalog: CatalogCount | null,
  now = new Date(),
): Promise<ExportBuild> {
  const servers: CatalogIndexRow[] = await getCatalogIndexRows();
  const meta = {
    name: 'AllMCPs — Model Context Protocol Server Directory',
    description:
      'Structured export of every active MCP (Model Context Protocol) server listed on AllMCPs, including categories, descriptions, install identifiers, and directory links.',
    url: 'https://allmcps.com',
    documentation: 'https://allmcps.com/llms.txt',
    license: 'https://allmcps.com/terms',
    generatedAt: now.toISOString(),
    // Rows in this export. catalogCount is the site-wide count every page
    // shows (lib/catalogCount.ts); they differ only by listings that changed
    // between the two reads.
    count: servers.length,
    catalogCount: catalog?.count ?? servers.length,
    catalogCountAsOf: catalog?.asOf ?? null,
  };
  const entry = (s: CatalogIndexRow) =>
    JSON.stringify({
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      repository: s.url,
      detailUrl: `https://allmcps.com/mcp/${s.id}`,
      markdownUrl: `https://allmcps.com/mcp/${s.id}.md`,
      installName: s.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    });
  function* chunks() {
    // The metadata object minus its closing brace, then the servers array.
    yield `${JSON.stringify(meta).slice(0, -1)},"servers":[`;
    for (let i = 0; i < servers.length; i += JSON_CHUNK_ROWS) {
      const slice = servers.slice(i, i + JSON_CHUNK_ROWS).map(entry);
      yield (i > 0 ? ',' : '') + slice.join(',');
    }
    yield ']}';
  }
  return { rows: servers.length, chunks: chunks() };
}

/**
 * The real install for a listing, or nothing. Never a name-derived guess: an
 * agent that runs a made-up package name can install a stranger's code.
 */
function llmsInstallNote(server: LlmsTxtServer): string {
  if (!server.installPackage) return '';
  if (server.installKind === 'remote')
    return ` (Remote endpoint: \`${server.installPackage}\`)`;
  if (server.installKind === 'stdio')
    return ` (Package: \`${server.installPackage}\`)`;
  return '';
}

/** /llms.txt: the site map for agents, with the top listings per category. */
export async function buildLlmsTxt(
  catalog: CatalogCount | null,
): Promise<ExportBuild> {
  const servers = await getServersForLlmsTxt();

  // Group servers by category
  const categoriesMap: Record<string, LlmsTxtServer[]> = {};
  for (const s of servers) {
    const cat = s.category || 'Uncategorized';
    if (!categoriesMap[cat]) categoriesMap[cat] = [];
    categoriesMap[cat].push(s);
  }

  let content = `# AllMCPs - The Definitive Model Context Protocol Directory\n\n`;
  content += `> AllMCPs (https://allmcps.com) is the open directory of Model Context Protocol (MCP) servers, tools, and integrations for AI agents, Claude Desktop, Cursor, and custom LLMs.\n\n`;

  content += `## Directory Overview\n`;
  // The site-wide count (lib/catalogCount.ts), the same number every page shows.
  content += catalog
    ? `- **Total MCP Servers:** ${catalog.count} (as of ${formatCatalogAsOf(catalog)})\n`
    : `- **Total MCP Servers:** ${servers.length}\n`;
  content += `- **Categories:** ${Object.keys(categoriesMap).join(', ')}\n`;
  content += `- **Full Catalog Export (Markdown):** https://allmcps.com/llms-full.txt\n`;
  content += `- **Structured Catalog Export (JSON dataset):** https://allmcps.com/data.json\n`;
  content += `- **Agent Search API:** https://allmcps.com/api/v1/search?q={query}\n`;
  content += `- **Remote MCP Server Tool:** https://allmcps.com/api/mcp\n`;
  content += `- **Per-listing Markdown:** https://allmcps.com/mcp/{id}.md\n`;
  content += `- **Per-listing Alternatives:** https://allmcps.com/mcp/{id}/alternatives\n`;
  content += `- **Side-by-side Compare:** https://allmcps.com/mcp/{id}/vs/{otherId}\n`;
  content += `- **Agent auth & claim API:** https://allmcps.com/auth.md (register via POST /api/v1/agent/register, confirm code at /confirm, and claim listings via POST /api/v1/agent/claim with DNS TXT / site badge / GitHub README)\n\n`;

  content += `## AllMCPs Developer Resources\n`;
  content += `- **AllMCPs API Documentation:** https://allmcps.com/docs/api\n`;
  content += `- **AllMCPs OpenAPI Spec:** https://allmcps.com/api/v1/openapi.json (RFC 9457-style typed errors, OAuth-style scoped Bearer auth documented under components.securitySchemes)\n`;
  content += `- **AllMCPs OAuth Scopes / Protected Resource Metadata:** https://allmcps.com/.well-known/oauth-protected-resource\n`;
  content += `- **AllMCPs MCP Server (remote, JSON-RPC):** https://allmcps.com/api/mcp — also live at https://allmcps.com/.well-known/mcp. Speaks MCP 2026-07-28 (per-request \`_meta\`, \`server/discover\`) and the initialize-based 2025-11-25 and earlier. Tools include search_mcp_servers (transport and verified_only filters), get_mcp_install_config (configs for 13 clients), get_mcp_alternatives, compare_mcp_servers and recommend_mcp_stack.\n`;
  content += `- **AllMCPs CLI / MCP Server (npm package):** \`npx allmcps-server\` — https://www.npmjs.com/package/allmcps-server (run with no args for the stdio MCP server, or a subcommand like \`allmcps-server search <query>\` for direct CLI output)\n`;
  content += `- **AllMCPs API Versioning & Deprecation Policy:** URL-versioned (\`/api/v1\`); deprecations get a \`Deprecation\`/\`Sunset\` header ≥90 days ahead — see https://allmcps.com/docs/api\n\n`;

  content += `## Submit an MCP Server (Free)\n`;
  content += `- **Listing is always free** — no payment required to get listed.\n`;
  content += `- **Submit (web):** https://allmcps.com/submit\n`;
  content += `- **Submit (agent API, recommended):** POST a JSON-RPC \`tools/call\` for \`submit_mcp_server\` to https://allmcps.com/api/mcp — call \`tools/list\` first for the full field schema (required: name, url, description, category, email; optional enrichment: tags, license, authType, pricingModel, maintenanceStatus, compatibleClients, supportUrl, suggestedInstallCommand, suggestedInstallArgs — fill in whatever you can confidently determine from the repo for a fully flushed-out listing). Also available as the \`submit_mcp_server\` tool in the \`allmcps-server\` npm package. Or POST the same fields as flat JSON to https://allmcps.com/api/v1/submit (no CAPTCHA — the human /submit form requires one, this endpoint doesn't; GET https://allmcps.com/api/v1/categories for the valid category list). AI assistants may submit on behalf of the person authorised to list a server: one accurate submission per server, no bulk or unattended runs (https://allmcps.com/terms#prohibited-conduct).\n`;
  content += `- Paid boosts (priority review, featured, premium) are optional upgrades. See https://allmcps.com/pricing\n\n`;

  content += `## Promotions\n`;
  content += `- Promo code \`AGENTREADY\` takes 50% off paid boosts, priority review and Premium at checkout. Listing is free without it.\n\n`;

  content += `## Agent Workflow Prompts (Ready-to-use MCP System Prompts)\n`;
  content += `- **Prompts Hub:** https://allmcps.com/prompts\n`;
  for (const w of WORKFLOW_PROMPTS) {
    content += `- [${w.title}](https://allmcps.com/prompts/${w.slug}): ${w.subtitle}\n`;
  }
  content += `\n`;

  content += `## Best MCP Servers by Use Case (curated, ranked)\n`;
  for (const t of BEST_TOPICS) {
    content += `- [Best MCP Servers for ${t.title}](https://allmcps.com/best/${t.slug})\n`;
  }
  content += `\n`;

  content += `## MCP Client Setup Guides (how to install MCP servers)\n`;
  for (const c of MCP_CLIENTS) {
    content += `- [How to Install MCP Servers in ${c.name}](https://allmcps.com/clients/${c.slug})\n`;
  }
  content += `\n`;

  content += `## Categories & Featured Servers\n\n`;

  for (const [category, catServers] of Object.entries(categoriesMap)) {
    content += `### ${category}\n`;
    content += `Category page: https://allmcps.com/categories/${categorySlug(category)}\n`;
    for (const server of catServers.slice(0, 10)) {
      content += `- [${server.name}](https://allmcps.com/mcp/${server.id}): ${server.description}${llmsInstallNote(server)}\n`;
    }
    content += `\n`;
  }

  content += `## Quick Setup Instructions for Agents\n`;
  content += `To install any server in Claude Desktop or compatible AI clients:\n`;
  content += `1. Open your \`claude_desktop_config.json\`.\n`;
  content += `2. Add \`"server-name": { "command": "npx", "args": ["-y", "package-name"] }\` under \`mcpServers\`.\n\n`;

  // Every article, so answer engines can cite the specific post rather than /blog.
  content += `## Articles\n`;
  for (const p of getAllPosts()) {
    content += `- [${p.title}](https://allmcps.com/blog/${p.slug}): ${p.excerpt}\n`;
  }
  content += `\n`;

  content += `## Useful Links\n`;
  content += `- Directory Homepage: https://allmcps.com\n`;
  content += `- Best MCP Servers by Use Case: https://allmcps.com/best\n`;
  content += `- Agent Prompts & Workflows: https://allmcps.com/prompts\n`;
  content += `- Blog & Articles: https://allmcps.com/blog\n`;
  content += `- Blog RSS: https://allmcps.com/blog/rss.xml\n`;
  content += `- All Guides: https://allmcps.com/guides\n`;
  content += `- Browse Categories: https://allmcps.com/categories\n`;
  content += `- MCP Setup Guide (HowTo): https://allmcps.com/guide\n`;
  content += `- What is MCP: https://allmcps.com/what-is-mcp\n`;
  content += `- How to Build an MCP Server: https://allmcps.com/build-mcp-server\n`;
  content += `- Deploy Remote MCP Server: https://allmcps.com/deploy-mcp-server\n`;
  content += `- MCP Security Best Practices: https://allmcps.com/mcp-security\n`;
  content += `- MCP Troubleshooting (not connecting, zero tools, timeouts): https://allmcps.com/mcp-troubleshooting\n`;
  content += `- MCP for SEO & AEO Automation Guide: https://allmcps.com/mcp-for-seo\n`;
  content += `- MCP Protocol Versioning Explained (2026-07-28 stateless revision): https://allmcps.com/mcp-protocol-versioning\n`;
  content += `- MCP Transports Explained (stdio vs Streamable HTTP): https://allmcps.com/mcp-transports\n`;
  content += `- State of MCP (live ecosystem statistics: server counts, transports, auth, licenses, health): https://allmcps.com/state-of-mcp\n`;
  content += `- Trust & Traffic Transparency: https://allmcps.com/trust\n`;
  content += `- Pricing & Boosting: https://allmcps.com/pricing\n`;
  content += `- Free Developer Tools (Config Auditor, MCP Playground, OpenAPI-to-MCP, Protocol Inspector, Config Generator, Config Validator, Token Calculator): https://allmcps.com/tools\n`;
  content += `- Badge Generator: https://allmcps.com/badge-generator\n`;
  content += `- Feeling Lucky Arcade (Random MCP Discovery): https://allmcps.com/lucky\n`;
  content += `- Structured Catalog Dataset (JSON): https://allmcps.com/data.json\n`;
  content += `- Sitemap index: https://allmcps.com/sitemap.xml (shards: /sitemap/core.xml, /sitemap/listings.xml, /sitemap/secondary.xml)\n`;

  return { rows: servers.length, chunks: [content] };
}

export const EXPORT_BUILDERS = {
  'llms-full.txt': buildLlmsFull,
  'data.json': buildDataJson,
  'llms.txt': buildLlmsTxt,
} as const;

/** An export built in memory and returned whole (the inline fallback for the small ones). */
export async function renderExport(
  build: (catalog: CatalogCount | null) => Promise<ExportBuild>,
): Promise<string> {
  const catalog = await getCatalogCount();
  const { chunks } = await build(catalog);
  let out = '';
  for await (const c of chunks) out += c;
  return out;
}
