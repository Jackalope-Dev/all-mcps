import { getAllPosts, getPostBySlug, type BlogPost } from './blog';
import {
  getActiveServers,
  getServerById,
  getRelatedServers,
  formatServerSummaryLine,
  relatedRankingScore,
  type Server,
} from './servers';
import { DIRECTORY_CATEGORIES, categoryFromSlug, categorySlug, parseCategoryLabel, categoryIntroCopy } from './categories';
import { BEST_TOPICS, bestTopicBySlug, selectServersForTopic, type BestTopic } from './bestTopics';
import { MCP_CLIENTS, mcpClientBySlug, type McpClient } from './clients';
import { WORKFLOW_PROMPTS, getWorkflowBySlug, type McpWorkflow } from './prompts';
import { computeQualityScore } from './qualityScore';

const SITE = 'https://allmcps.com';

/** Category pages cap the listed servers to match the HTML page's MAX_CARDS. */
const MAX_LISTED_SERVERS = 60;

export function formatBlogPostMarkdown(post: BlogPost): string {
  let md = `# ${post.title}\n\n`;
  md += `> ${post.excerpt}\n\n`;
  md += `**Published:** ${post.date}  \n`;
  if (post.tags.length > 0) md += `**Tags:** ${post.tags.join(', ')}  \n`;
  md += `**Reading time:** ${post.readingTime} min  \n`;
  md += `**URL:** ${SITE}/blog/${post.slug}\n\n`;
  md += `---\n\n`;
  md += `${post.content}\n`;

  if (post.faq.length > 0) {
    md += `\n## Frequently Asked Questions\n\n`;
    for (const { q, a } of post.faq) {
      md += `**${q}**\n${a}\n\n`;
    }
  }

  return md;
}

export function formatBlogIndexMarkdown(posts: BlogPost[]): string {
  let md = `# AllMCPs Blog\n\n`;
  md += `${posts.length} post${posts.length === 1 ? '' : 's'} on the Model Context Protocol, AI agent tooling, and directory updates.\n\n`;

  for (const post of posts) {
    md += `## [${post.title}](${SITE}/blog/${post.slug})\n`;
    md += `${post.date} · ${post.readingTime} min read\n\n`;
    md += `${post.excerpt}\n\n`;
  }

  return md;
}

export function formatCategoryMarkdown(category: string, servers: Server[]): string {
  const { label } = parseCategoryLabel(category);
  const slug = categorySlug(category);
  const ranked = [...servers].sort((a, b) => relatedRankingScore(b) - relatedRankingScore(a));
  const topNames = ranked.slice(0, 3).map((s) => s.name);
  const intro = categoryIntroCopy(category, servers.length, topNames);

  let md = `# ${label} MCP Servers\n\n`;
  md += `${intro}\n\n`;
  md += `**Category page:** ${SITE}/categories/${slug}\n`;
  md += `**Listed servers:** ${servers.length}\n\n`;

  if (ranked.length === 0) {
    md += `No servers are currently listed in this category.\n`;
    return md;
  }

  md += `## Servers\n\n`;
  for (const server of ranked.slice(0, MAX_LISTED_SERVERS)) {
    md += `${formatServerSummaryLine(server)}\n`;
  }
  if (ranked.length > MAX_LISTED_SERVERS) {
    md += `\n...and ${ranked.length - MAX_LISTED_SERVERS} more. Full list: ${SITE}/categories/${slug}\n`;
  }

  return md;
}

export function formatCategoryIndexMarkdown(counts: { category: string; count: number }[]): string {
  let md = `# AllMCPs Categories\n\n`;
  md += `Browse the full MCP server directory by category.\n\n`;

  for (const { category, count } of counts) {
    const { emoji, label } = parseCategoryLabel(category);
    md += `- [${emoji} ${label}](${SITE}/categories/${categorySlug(category)}) — ${count} server${count === 1 ? '' : 's'}\n`;
  }

  return md;
}

/** Returns null when the slug doesn't match a known post, so the route can 404. */
export async function renderBlogPostMarkdown(slug: string): Promise<string | null> {
  const post = getPostBySlug(slug);
  return post ? formatBlogPostMarkdown(post) : null;
}

export async function renderBlogIndexMarkdown(): Promise<string> {
  return formatBlogIndexMarkdown(getAllPosts());
}

/** Returns null when the slug doesn't match a known category, so the route can 404. */
export async function renderCategoryMarkdown(slug: string): Promise<string | null> {
  const category = categoryFromSlug(slug);
  if (!category) return null;
  const servers = await getActiveServers();
  const inCategory = servers.filter((s) => s.category === category);
  return formatCategoryMarkdown(category, inCategory);
}

export async function renderCategoryIndexMarkdown(): Promise<string> {
  const servers = await getActiveServers();
  const counts = DIRECTORY_CATEGORIES.map((category) => ({
    category,
    count: servers.filter((s) => s.category === category).length,
  }));
  return formatCategoryIndexMarkdown(counts);
}

export function formatBestTopicMarkdown(topic: BestTopic, servers: Server[]): string {
  const ranked = [...servers].sort((a, b) => relatedRankingScore(b) - relatedRankingScore(a));

  let md = `# Best ${topic.title} MCP Servers\n\n`;
  md += `${topic.lead}\n\n`;
  md += `**Page:** ${SITE}/best/${topic.slug}\n`;
  md += `**Ranked servers:** ${ranked.length}\n\n`;

  if (ranked.length === 0) {
    md += `No servers currently match this topic.\n`;
    return md;
  }

  md += `## Servers\n\n`;
  for (const server of ranked.slice(0, MAX_LISTED_SERVERS)) {
    md += `${formatServerSummaryLine(server)}\n`;
  }
  if (ranked.length > MAX_LISTED_SERVERS) {
    md += `\n...and ${ranked.length - MAX_LISTED_SERVERS} more. Full list: ${SITE}/best/${topic.slug}\n`;
  }

  if (topic.faq.length > 0) {
    md += `\n## Frequently Asked Questions\n\n`;
    for (const { q, a } of topic.faq) {
      md += `**${q}**\n${a}\n\n`;
    }
  }

  return md;
}

export function formatBestIndexMarkdown(topics: BestTopic[]): string {
  let md = `# Best MCP Servers by Use Case\n\n`;
  md += `Curated, ranked lists of MCP servers for common use cases.\n\n`;
  for (const t of topics) {
    md += `- [Best ${t.title} MCP Servers](${SITE}/best/${t.slug}) — ${t.lead}\n`;
  }
  return md;
}

export function formatClientMarkdown(client: McpClient): string {
  let md = `# How to Install MCP Servers in ${client.name}\n\n`;
  md += `${client.lead}\n\n`;
  md += `**Config file:** ${client.configFilename}  \n`;
  md += `**Page:** ${SITE}/clients/${client.slug}\n\n`;

  if (client.configLocations.length > 0) {
    md += `## Config file location\n\n`;
    for (const loc of client.configLocations) {
      md += `- **${loc.os}:** \`${loc.path}\`\n`;
    }
    md += `\n`;
  }

  md += `## Example config\n\n\`\`\`\n${client.configExample}\n\`\`\`\n\n`;

  md += `## Setup steps\n\n`;
  client.steps.forEach((step, i) => {
    md += `${i + 1}. **${step.title}** — ${step.body}\n`;
  });
  md += `\n`;

  if (client.faq.length > 0) {
    md += `## Frequently Asked Questions\n\n`;
    for (const { q, a } of client.faq) {
      md += `**${q}**\n${a}\n\n`;
    }
  }

  return md;
}

export function formatClientIndexMarkdown(clients: McpClient[]): string {
  let md = `# MCP Client Setup Guides\n\n`;
  md += `How to install MCP servers in popular AI clients.\n\n`;
  for (const c of clients) {
    md += `- [How to Install MCP Servers in ${c.name}](${SITE}/clients/${c.slug}) — ${c.lead}\n`;
  }
  return md;
}

export function formatPromptMarkdown(workflow: McpWorkflow): string {
  let md = `# ${workflow.title}\n\n`;
  md += `> ${workflow.subtitle}\n\n`;
  md += `${workflow.description}\n\n`;
  md += `**Category:** ${workflow.category}  \n`;
  md += `**Page:** ${SITE}/prompts/${workflow.slug}\n\n`;

  md += `## Required MCP servers\n\n`;
  for (const mcp of workflow.requiredMcps) {
    md += `- **${mcp.name}** — ${mcp.description}\n  \`${mcp.command} ${mcp.args.join(' ')}\`\n`;
  }
  md += `\n`;

  md += `## System prompt\n\n\`\`\`\n${workflow.systemPrompt}\n\`\`\`\n\n`;

  if (workflow.faq.length > 0) {
    md += `## Frequently Asked Questions\n\n`;
    for (const { q, a } of workflow.faq) {
      md += `**${q}**\n${a}\n\n`;
    }
  }

  return md;
}

export function formatPromptIndexMarkdown(workflows: McpWorkflow[]): string {
  let md = `# MCP Workflow Prompts\n\n`;
  md += `Ready-to-use system prompts pairing specific MCP servers for common agent workflows.\n\n`;
  for (const w of workflows) {
    md += `- [${w.title}](${SITE}/prompts/${w.slug}) — ${w.subtitle}\n`;
  }
  return md;
}

export function formatAlternativesMarkdown(server: Server, alternatives: Server[]): string {
  let md = `# Alternatives to ${server.name}\n\n`;
  md += `**Original listing:** ${SITE}/mcp/${server.id}\n`;
  md += `**Category:** ${server.category}\n\n`;

  if (alternatives.length === 0) {
    md += `No close alternatives are catalogued yet. Browse more ${server.category} servers: ${SITE}/categories/${categorySlug(server.category)}\n`;
    return md;
  }

  md += `${alternatives.length} alternative${alternatives.length === 1 ? '' : 's'} with similar capabilities:\n\n`;
  for (const alt of alternatives) {
    md += `${formatServerSummaryLine(alt)}\n`;
  }

  return md;
}

/** Top N tool/feature names for the comparison table — mirrors app/mcp/[id]/vs/[other]/page.tsx's toolNames(). */
function compareToolNames(s: Server, max = 6): string[] {
  if (s.tools?.length) return s.tools.map((t) => t.name).filter(Boolean).slice(0, max);
  if (s.aiFeatures?.length) return s.aiFeatures.slice(0, max);
  return [];
}

export function formatCompareMarkdown(left: Server, right: Server): string {
  const qLeft = computeQualityScore(left);
  const qRight = computeQualityScore(right);
  const toolsLeft = compareToolNames(left);
  const toolsRight = compareToolNames(right);

  let md = `# ${left.name} vs ${right.name}\n\n`;
  md += `Side-by-side comparison of two Model Context Protocol servers.\n\n`;
  md += `| | ${left.name} | ${right.name} |\n`;
  md += `|---|---|---|\n`;
  md += `| Category | ${left.category} | ${right.category} |\n`;
  md += `| Quality score | ${qLeft.score}/100 (${qLeft.tier}) | ${qRight.score}/100 (${qRight.tier}) |\n`;
  md += `| GitHub stars | ${left.githubStars ?? '—'} | ${right.githubStars ?? '—'} |\n`;
  md += `| Installs | ${left.copies ?? 0} | ${right.copies ?? 0} |\n`;
  md += `| Upvotes | ${left.upvotes ?? 0} | ${right.upvotes ?? 0} |\n`;
  md += `| Tools | ${toolsLeft.length ? toolsLeft.join(', ') : '—'} | ${toolsRight.length ? toolsRight.join(', ') : '—'} |\n`;
  md += `| Listing | ${SITE}/mcp/${left.id} | ${SITE}/mcp/${right.id} |\n\n`;
  md += `## ${left.name}\n${left.description}\n\n`;
  md += `## ${right.name}\n${right.description}\n\n`;

  return md;
}

/** Returns null when the slug doesn't match a known topic, so the route can 404. */
export async function renderBestTopicMarkdown(slug: string): Promise<string | null> {
  const topic = bestTopicBySlug(slug);
  if (!topic) return null;
  const servers = await getActiveServers();
  const selected = selectServersForTopic(topic, servers);
  return formatBestTopicMarkdown(topic, selected);
}

export async function renderBestIndexMarkdown(): Promise<string> {
  return formatBestIndexMarkdown(BEST_TOPICS);
}

/** Returns null when the slug doesn't match a known client, so the route can 404. */
export async function renderClientMarkdown(slug: string): Promise<string | null> {
  const client = mcpClientBySlug(slug);
  return client ? formatClientMarkdown(client) : null;
}

export async function renderClientIndexMarkdown(): Promise<string> {
  return formatClientIndexMarkdown(MCP_CLIENTS);
}

/** Returns null when the slug doesn't match a known workflow, so the route can 404. */
export async function renderPromptMarkdown(slug: string): Promise<string | null> {
  const workflow = getWorkflowBySlug(slug);
  return workflow ? formatPromptMarkdown(workflow) : null;
}

export async function renderPromptIndexMarkdown(): Promise<string> {
  return formatPromptIndexMarkdown(WORKFLOW_PROMPTS);
}

/** Returns null when the server id doesn't exist, so the route can 404. */
export async function renderAlternativesMarkdown(id: string): Promise<string | null> {
  const server = await getServerById(id);
  if (!server) return null;
  const alternatives = await getRelatedServers(server, 12);
  return formatAlternativesMarkdown(server, alternatives);
}

/** Returns null when either server id doesn't exist or the ids are identical, so the route can 404. */
export async function renderCompareMarkdown(idA: string, idB: string): Promise<string | null> {
  if (!idA || !idB || idA === idB) return null;
  const [left, right] = await Promise.all([getServerById(idA), getServerById(idB)]);
  if (!left || !right) return null;
  return formatCompareMarkdown(left, right);
}
