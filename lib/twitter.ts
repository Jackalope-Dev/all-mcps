import { socialPosts } from '../db/schema';

export interface McpServerTweetPayload {
  id: string;
  name: string;
  description: string;
  category?: string;
  isNew?: boolean;
  isFeatured?: boolean;
}

export interface TweetQueueOptions {
  source?: string;
  dedupeKey?: string;
  now?: Date;
}

export interface TweetQueueResult {
  success: boolean;
  queued: boolean;
  duplicate?: boolean;
  guid: string;
  text: string;
  error?: string;
}

export function escapeForXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function toTweetQueueGuid(dedupeKey?: string): string {
  return dedupeKey ? `tweet:${dedupeKey}` : `tweet:${crypto.randomUUID()}`;
}

const FEATURED_HEADERS = [
  '🔥 Featured MCP Server',
  '⭐ Top Pick on AllMCPs',
  '🚀 Featured AI Tool',
  '💎 Highlighted MCP Server',
  '👑 Premium MCP Pick',
  '🌟 Editor’s Choice MCP',
  '🏆 Standout MCP Server',
  '📌 Featured on AllMCPs',
];

const COMMUNITY_HEADERS = [
  '💡 Community MCP Highlight',
  '🛠️ Tool Spotlight',
  '🤖 AI Agent Tool Highlight',
  '🔍 Discover on AllMCPs',
  '⚡ Featured MCP Server',
  '🧩 MCP Server Spotlight',
  '📡 On the MCP Radar',
  '🔦 Under the Spotlight',
  '💬 From the MCP Directory',
];

const NEW_HEADERS = [
  '🚀 New MCP Server Listed!',
  '✨ Fresh Listing on AllMCPs',
  '🆕 New MCP Server Added',
  '🎉 Just Landed on AllMCPs',
  '📥 New MCP Server Just In',
  '🌱 Freshly Added MCP Server',
];

const CALL_TO_ACTIONS = [
  'Explore & install on @AllMCPs:',
  'Give your AI agents superpowers:',
  'Discover installation & setup on @AllMCPs:',
  'Check out details & setup on @AllMCPs:',
  'Browse & install on @AllMCPs:',
  'Grab the setup guide on @AllMCPs:',
  'See how to wire it up on @AllMCPs:',
  'Add it to your AI stack via @AllMCPs:',
  'Full details on @AllMCPs:',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Helper to convert raw repository / server names into clean, display-ready Title Case.
 * e.g., 'modelcontextprotocol/server-memory' -> 'Server Memory'
 * e.g., 'sqlite-mcp-server' -> 'SQLite MCP Server'
 */
export function formatDisplayTitle(rawName: string): string {
  if (!rawName) return '';
  let cleaned = rawName.trim();

  // If in owner/repo format, extract the repo name for primary title
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    cleaned = parts[parts.length - 1];
  }

  // Replace hyphens and underscores with spaces
  cleaned = cleaned.replace(/[-_]+/g, ' ');

  // Acronyms & brand casing map
  const upperAcronyms = new Set([
    'MCP', 'AI', 'API', 'SQL', 'DB', 'LLM', 'JSON', 'CLI', 'URL',
    'REST', 'SDK', 'UI', 'UX', 'CSS', 'HTML', 'JS', 'TS', 'HTTP', 'HTTPS'
  ]);

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (upperAcronyms.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Generate relevant discoverability hashtags based on category.
 */
export function getHashtags(category?: string): string {
  const tags = new Set<string>(['#MCP']);

  const catLower = (category || '').toLowerCase();
  if (catLower.includes('database') || catLower.includes('db')) tags.add('#Databases');
  else if (catLower.includes('search') || catLower.includes('extraction')) tags.add('#Data');
  else if (catLower.includes('version') || catLower.includes('git')) tags.add('#DevOps');
  else if (catLower.includes('file')) tags.add('#DevTools');
  else if (catLower.includes('agent')) tags.add('#AIAgents');
  else tags.add('#DevTools');

  const generalPool = ['#AI', '#Claude', '#LLM', '#AITools', '#AIAgents', '#OpenSource', '#Anthropic'];
  const shuffledGeneral = [...generalPool].sort(() => Math.random() - 0.5);
  for (const tag of shuffledGeneral) {
    if (tags.size >= 4) break;
    tags.add(tag);
  }

  return [...tags].sort(() => Math.random() - 0.5).join(' ');
}

// Install-command clause ("npx -y ...", "Install: pip install ...") that reads as
// noise in a tweet — it belongs on the directory page, not in a highlight post.
const INSTALL_COMMAND_RE =
  /\b(npx|npm\s+install|pnpm\s+add|yarn\s+add|pip3?\s+install|uvx|uv\s+pip|docker\s+run|go\s+install|cargo\s+install|brew\s+install)\b/i;

/**
 * Descriptions are scraped from READMEs and carry markdown/HTML cruft — badge
 * images, links, bold/italic, inline code, headings, list bullets, raw tags.
 * Strip all of it down to a single line of plain text suitable for a tweet.
 */
export function stripMarkdown(input: string): string {
  if (!input) return '';
  let text = input;

  text = text.replace(/```[\w-]*\n?([\s\S]*?)```/g, ' $1 ');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');
  text = text.replace(/^\s{0,3}(#{1,6}\s+|>\s+|[-*+]\s+|\d+[.)]\s+)/gm, '');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  text = text.replace(/\[\s*\]|\(\s*\)/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();
  text = text.replace(/^[-–—:|]\s*/, '').trim();

  return text;
}

/**
 * Clean a scraped description into tweet-ready plain text: strip markdown, drop a
 * trailing install-command clause, then truncate on a word boundary.
 */
export function cleanTweetDescription(description: string | undefined, maxLen = 165): string {
  let text = stripMarkdown(description || '');
  if (!text) return '';

  const installIdx = text.search(INSTALL_COMMAND_RE);
  if (installIdx > 0) {
    text = text
      .slice(0, installIdx)
      .replace(/[\s.;:,(\-–—]+$/, '')
      .replace(/\b(install(?:ation)?|usage|setup|run|quick\s?start|example|getting started)\s*$/i, '')
      .replace(/[\s.;:,(\-–—]+$/, '')
      .trim();
  }

  if (text.length > maxLen) {
    const slice = text.slice(0, maxLen - 1);
    const lastSpace = slice.lastIndexOf(' ');
    text = (lastSpace > maxLen * 0.6 ? slice.slice(0, lastSpace) : slice).replace(/[\s.,;:]+$/, '') + '…';
  }

  return text;
}

/**
 * Format an open-graph optimized tweet body for an MCP server.
 */
export function buildMcpServerTweetText(server: McpServerTweetPayload): string {
  const url = `https://allmcps.com/mcp/${server.id}`;
  const displayTitle = formatDisplayTitle(server.name || server.id);
  const hashtags = getHashtags(server.category);
  const cta = getRandomItem(CALL_TO_ACTIONS);

  let header = getRandomItem(COMMUNITY_HEADERS);
  let badge = '';

  if (server.isNew) {
    header = getRandomItem(NEW_HEADERS);
  } else if (server.isFeatured) {
    header = getRandomItem(FEATURED_HEADERS);
    badge = ' ⭐';
  }

  const cleanDesc = cleanTweetDescription(server.description);
  return `${header}\n\n${displayTitle}${badge}\n${cleanDesc}\n\n${cta}\n${url}\n\n${hashtags}`;
}

/**
 * Queue a tweet item into D1-backed social_posts (later consumed by RSS pollers).
 */
export async function tweetMcpServer(
  db: any,
  server: McpServerTweetPayload,
  options: TweetQueueOptions = {},
): Promise<TweetQueueResult> {
  const text = buildMcpServerTweetText(server);
  const guid = toTweetQueueGuid(options.dedupeKey);
  const createdAt = options.now ?? new Date();

  try {
    await db.insert(socialPosts).values({
      guid,
      channel: 'twitter',
      status: 'queued',
      serverId: server.id,
      tweetText: text,
      source: options.source ?? null,
      dedupeKey: options.dedupeKey ?? null,
      createdAt,
    });

    return { success: true, queued: true, guid, text };
  } catch (error: any) {
    const message = String(error?.message || error || '');
    if (options.dedupeKey && /UNIQUE constraint failed:\s*social_posts\.dedupe_key/i.test(message)) {
      return { success: true, queued: false, duplicate: true, guid, text };
    }
    return {
      success: false,
      queued: false,
      guid,
      text,
      error: message || 'Failed to enqueue tweet item.',
    };
  }
}
