import { getAllPosts, getPostBySlug, type BlogPost } from './blog';
import { getActiveServers, formatServerSummaryLine, relatedRankingScore, type Server } from './servers';
import { DIRECTORY_CATEGORIES, categoryFromSlug, categorySlug, parseCategoryLabel, categoryIntroCopy } from './categories';

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
