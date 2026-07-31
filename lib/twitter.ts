/**
 * Helper utility for posting tweets via X / Twitter API v2 using OAuth 1.0a User Context.
 * 
 * Required Environment Variables in Cloudflare:
 * - TWITTER_API_KEY (Consumer Key)
 * - TWITTER_API_SECRET (Consumer Secret)
 * - TWITTER_ACCESS_TOKEN (Access Token for @AllMCPs)
 * - TWITTER_ACCESS_TOKEN_SECRET (Access Token Secret for @AllMCPs)
 */

export interface McpServerTweetPayload {
  id: string;
  name: string;
  description: string;
  category?: string;
  isNew?: boolean;
  isFeatured?: boolean;
}

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

async function hmacSha1(keyStr: string, baseStr: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyStr);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(baseStr));
  // Convert ArrayBuffer to base64 string
  let binary = '';
  const bytes = new Uint8Array(signatureBuffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function getOAuth1Header(
  method: string,
  url: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<string> {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  // Sort parameter keys lexicographically for signature base string
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join('&');

  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessTokenSecret)}`;

  const signature = await hmacSha1(signingKey, baseString);
  oauthParams.oauth_signature = signature;

  const authHeaderParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`);

  return `OAuth ${authHeaderParts.join(', ')}`;
}

export async function postTweet(text: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.log('[Twitter API] Missing OAuth 1.0a credentials. Required: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET.');
    return {
      success: false,
      error: 'Missing OAuth 1.0a credentials (TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET).',
    };
  }

  const tweetUrl = 'https://api.twitter.com/2/tweets';

  try {
    const authHeader = await getOAuth1Header(
      'POST',
      tweetUrl,
      apiKey,
      apiSecret,
      accessToken,
      accessTokenSecret
    );

    const res = await fetch(tweetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Twitter API Error]:', res.status, errText);
      return { success: false, error: `Twitter API error (${res.status}): ${errText}` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    console.error('[Twitter API Exception]:', err);
    return { success: false, error: err?.message || 'Failed to post tweet' };
  }
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
 * Generate relevant discoverability hashtags based on category.
 *
 * #MCP always leads; a category-specific tag is included when we can infer one; the
 * remaining slots are filled from a rotating general pool so consecutive tweets don't
 * carry the identical hashtag set.
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

  // Pull a couple of general tags at random so the set varies between posts.
  const generalPool = ['#AI', '#Claude', '#LLM', '#AITools', '#AIAgents', '#OpenSource', '#Anthropic'];
  const shuffledGeneral = [...generalPool].sort(() => Math.random() - 0.5);
  for (const tag of shuffledGeneral) {
    if (tags.size >= 4) break;
    tags.add(tag);
  }

  // Randomize final tag order for extra anti-duplicate variation.
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

  // Fenced/inline code -> keep inner text, drop the backticks/fences.
  text = text.replace(/```[\w-]*\n?([\s\S]*?)```/g, ' $1 ');
  text = text.replace(/`([^`]+)`/g, '$1');
  // Images (incl. badges): drop entirely. Do this before links so nested
  // badge-links like [![badge](img)](href) collapse cleanly.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  // Inline + reference links -> keep the visible text only.
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
  // Raw HTML tags (<img>, <br>, <sub>, ...).
  text = text.replace(/<[^>]+>/g, ' ');
  // Emphasis / strikethrough markers.
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');
  // Line-leading markers: headings, blockquotes, list bullets, numbered lists.
  text = text.replace(/^\s{0,3}(#{1,6}\s+|>\s+|[-*+]\s+|\d+[.)]\s+)/gm, '');
  // HTML entities that survive scraping.
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Leftover empty brackets/parens from stripped images/links.
  text = text.replace(/\[\s*\]|\(\s*\)/g, '');
  // Collapse all whitespace (incl. newlines) to single spaces.
  text = text.replace(/\s+/g, ' ').trim();
  // Drop a leading platform-badge emoji run (READMEs often open with one), then
  // any leftover separator — e.g. "🐍 - Run Python" -> "Run Python".
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
      // Drop a now-dangling lead-in label left behind by the cut ("... to start. Run").
      .replace(/\b(install(?:ation)?|usage|setup|run|quick\s?start|example|getting started)\s*$/i, '')
      .replace(/[\s.;:,(\-–—]+$/, '')
      .trim();
  }

  if (text.length > maxLen) {
    const slice = text.slice(0, maxLen - 1);
    const lastSpace = slice.lastIndexOf(' ');
    // Prefer a word boundary unless that would chop off too much.
    text = (lastSpace > maxLen * 0.6 ? slice.slice(0, lastSpace) : slice).replace(/[\s.,;:]+$/, '') + '…';
  }

  return text;
}

/**
 * Format and post an open-graph optimized tweet for an MCP server
 */
export async function tweetMcpServer(server: McpServerTweetPayload) {
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

  const tweetText = `${header}\n\n${displayTitle}${badge}\n${cleanDesc}\n\n${cta}\n${url}\n\n${hashtags}`;

  return postTweet(tweetText);
}
