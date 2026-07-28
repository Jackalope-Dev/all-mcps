/**
 * Helper utility for posting tweets via X / Twitter API v2.
 * 
 * Required Environment Variables (for X API v2 OAuth 1.0a or OAuth 2.0):
 * - TWITTER_API_KEY
 * - TWITTER_API_SECRET
 * - TWITTER_ACCESS_TOKEN
 * - TWITTER_ACCESS_TOKEN_SECRET
 * - TWITTER_BEARER_TOKEN (optional)
 */

interface McpServerTweetPayload {
  id: string;
  name: string;
  description: string;
  category?: string;
  isNew?: boolean;
}

export async function postTweet(text: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;

  // Check if credentials exist
  if (!bearerToken && (!apiKey || !accessToken)) {
    console.log('[Twitter API] Credentials not configured. Simulated tweet text:\n', text);
    return { success: false, error: 'Twitter API credentials not configured in environment variables.' };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }

    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers,
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
 * Format and post an open-graph optimized tweet for an MCP server
 */
export async function tweetMcpServer(server: McpServerTweetPayload) {
  const url = `https://allmcps.com/mcp/${server.id}`;
  const header = server.isNew ? '🚀 New MCP Server Listed!' : '✨ Featured MCP Server Highlight';
  const cleanDesc = server.description ? (server.description.length > 180 ? server.description.slice(0, 177) + '...' : server.description) : '';

  const tweetText = `${header}\n\n${server.name}\n${cleanDesc}\n\nExplore & install on @AllMCPs:\n${url}`;

  return postTweet(tweetText);
}
