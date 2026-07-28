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
];

const COMMUNITY_HEADERS = [
  '💡 Community MCP Highlight',
  '🛠️ Tool Spotlight',
  '🤖 AI Agent Tool Highlight',
  '🔍 Discover on AllMCPs',
  '⚡ Featured MCP Server',
];

const NEW_HEADERS = [
  '🚀 New MCP Server Listed!',
  '✨ Fresh Listing on AllMCPs',
  '🆕 New MCP Server Added',
];

const CALL_TO_ACTIONS = [
  'Explore & install on @AllMCPs:',
  'Give your AI agents superpowers:',
  'Discover installation & setup on @AllMCPs:',
  'Check out details & setup on @AllMCPs:',
  'Browse & install on @AllMCPs:',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate relevant discoverability hashtags based on category
 */
export function getHashtags(category?: string): string {
  const baseTags = ['#MCP', '#AI', '#Claude'];

  const catLower = (category || '').toLowerCase();
  if (catLower.includes('database') || catLower.includes('db')) baseTags.push('#Databases');
  else if (catLower.includes('search') || catLower.includes('extraction')) baseTags.push('#Data');
  else if (catLower.includes('version') || catLower.includes('git')) baseTags.push('#DevOps');
  else if (catLower.includes('file')) baseTags.push('#DevTools');
  else if (catLower.includes('agent')) baseTags.push('#AIAgents');
  else baseTags.push('#DevTools');

  // Randomize tag order for anti-duplicate variation
  return baseTags.sort(() => Math.random() - 0.5).join(' ');
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

  const cleanDesc = server.description
    ? (server.description.length > 165 ? server.description.slice(0, 162) + '...' : server.description)
    : '';

  const tweetText = `${header}\n\n${displayTitle}${badge}\n${cleanDesc}\n\n${cta}\n${url}\n\n${hashtags}`;

  return postTweet(tweetText);
}
