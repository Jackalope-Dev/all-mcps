/**
 * Text and structured output for the AllMCPs MCP tools (app/api/mcp/route.ts)
 * that the shared listing markdown (formatServerAsMarkdown) does not cover:
 * per-client configs, comparisons, compact result lines and sponsor blocks.
 */
import type { ClientConfig } from './clientConfigs';
import {
  listingClientConfigs,
  resolveListingInstall,
} from './listingClientConfigs';
import { computeQualityScore } from './qualityScore';
import type { Server } from './servers';
import { computeTrustTier, TRUST_TIER_COPY } from './trustTier';

const FENCE: Record<ClientConfig['format'], string> = {
  json: 'json',
  toml: 'toml',
  yaml: 'yaml',
  shell: 'bash',
  text: 'text',
};

/** Markdown for every client's config, or a note when none is published. */
export function formatClientConfigsMarkdown(
  configs: ClientConfig[] | null,
): string {
  if (!configs) {
    return '## Setup\nNo confirmed install details for this listing yet, so no client config is published. Follow the setup steps in the project repository.\n';
  }
  let md = '## Setup by client\n';
  for (const c of configs) {
    md += `\n### ${c.label}\n`;
    if (c.locations.length > 0) {
      md += `Where: ${c.locations.map((l) => `${l.os}: \`${l.path}\``).join(' · ')}\n`;
    }
    md += `\`\`\`${FENCE[c.format]}\n${c.snippet}\n\`\`\`\n${c.note}\n`;
  }
  return md;
}

export type ListingFacts = {
  id: string;
  name: string;
  category: string;
  description: string;
  transport: 'remote' | 'stdio' | 'unknown';
  install: string | null;
  trustTier: string;
  tools: number;
  toolsSource: 'introspected' | 'readme' | null;
  health: string;
  githubStars: number | null;
  lastCommitAt: string | null;
  qualityScore: number;
  detailUrl: string;
};

/** The facts compare and search hand back, as structured content. */
export function listingFacts(server: Server): ListingFacts {
  const install = resolveListingInstall(server);
  const configs = listingClientConfigs(server);
  const tier = computeTrustTier(server);
  const commit = server.lastCommitAt ? new Date(server.lastCommitAt) : null;
  return {
    id: server.id,
    name: server.name,
    category: server.category,
    description: server.description,
    transport: configs ? install.kind : 'unknown',
    install: configs
      ? install.kind === 'remote'
        ? install.url
        : [install.command, ...install.args].join(' ')
      : null,
    trustTier: TRUST_TIER_COPY[tier].label,
    tools: Array.isArray(server.tools) ? server.tools.length : 0,
    toolsSource:
      server.toolsSource === 'introspected' || server.toolsSource === 'readme'
        ? server.toolsSource
        : null,
    health: server.healthStatus || 'unknown',
    githubStars: server.githubStars ?? null,
    lastCommitAt:
      commit && !Number.isNaN(commit.getTime())
        ? commit.toISOString().slice(0, 10)
        : null,
    qualityScore: computeQualityScore(server).score,
    detailUrl: `https://allmcps.com/mcp/${server.id}`,
  };
}

function toolsCell(f: ListingFacts): string {
  if (f.tools === 0) return 'none listed';
  const how =
    f.toolsSource === 'introspected' ? 'verified by handshake' : 'from README';
  return `${f.tools} (${how})`;
}

/** Side-by-side markdown table for 2–4 listings. */
export function formatComparisonMarkdown(facts: ListingFacts[]): string {
  const rows: Array<[string, (f: ListingFacts) => string]> = [
    ['Category', (f) => f.category],
    ['Transport', (f) => f.transport],
    ['Install', (f) => (f.install ? `\`${f.install}\`` : 'not confirmed')],
    ['Evidence', (f) => f.trustTier],
    ['Tools', toolsCell],
    ['Health', (f) => f.health],
    ['GitHub stars', (f) => (f.githubStars ?? '—').toString()],
    ['Last commit', (f) => f.lastCommitAt ?? '—'],
    ['Quality score', (f) => `${f.qualityScore}/100`],
    ['Page', (f) => f.detailUrl],
  ];
  const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  let md = `# Comparison\n\n| | ${facts.map((f) => cell(f.name)).join(' | ')} |\n`;
  md += `|---|${facts.map(() => '---').join('|')}|\n`;
  for (const [label, get] of rows) {
    md += `| ${label} | ${facts.map((f) => cell(get(f))).join(' | ')} |\n`;
  }
  md += `\n${facts.map((f) => `- **${f.name}**: ${f.description}`).join('\n')}\n`;
  return md;
}

/** One compact line per listing, for alternatives and stack recommendations. */
export function formatListingLine(f: ListingFacts): string {
  const bits = [
    f.trustTier,
    f.transport !== 'unknown' ? f.transport : null,
    f.tools > 0 ? `${f.tools} tools` : null,
    f.githubStars != null ? `⭐ ${f.githubStars}` : null,
  ].filter(Boolean);
  return `- **${f.name}** (\`${f.id}\`) — ${f.description} _[${bits.join(' · ')}]_ ${f.detailUrl}`;
}

/**
 * A sponsor as plain, labelled data in its own content block — no wording
 * addressed to the model. Marked for the user's eyes via annotations.
 */
export function sponsorContentBlock(ad: {
  title: string;
  description: string;
  targetUrl: string;
}) {
  return {
    type: 'text' as const,
    text: `Sponsored: ${ad.title} — ${ad.description} (${ad.targetUrl})`,
    annotations: { audience: ['user'], priority: 0.1 },
  };
}
