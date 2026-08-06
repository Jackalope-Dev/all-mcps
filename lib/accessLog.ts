/**
 * API access logging — classifies User-Agent strings into known LLM/agent
 * categories and writes non-blocking log rows to the api_access_logs table.
 */
import { apiAccessLogs } from '@/db/schema';

export type CallerClass =
  | 'claude'
  | 'cursor'
  | 'chatgpt'
  | 'perplexity'
  | 'gemini'
  | 'copilot'
  | 'windsurf'
  | 'claudebot'
  | 'gptbot'
  | 'bingbot'
  | 'amazonbot'
  | 'applebot'
  | 'metabot'
  | 'bytespider'
  | 'ccbot'
  | 'duckduckbot'
  | 'yandexbot'
  | 'bot'
  | 'agent'
  | 'browser'
  | 'unknown';

export type Endpoint =
  | 'mcp_jsonrpc'
  | 'v1_search'
  | 'v1_server_detail'
  | 'llms_txt'
  | 'llms_full_txt'
  | 'markdown_view';

/**
 * Ordered so the first match wins. Compound crawler names (e.g. "ClaudeBot",
 * "GPTBot") are matched as bare substrings rather than `\bword\b` — a `\b`
 * boundary can't land between "Claude" and "Bot" inside one glued token, so
 * those patterns must come first or they'd silently fall through to the
 * generic 'agent' bucket instead of naming the actual crawler.
 */
const UA_PATTERNS: [RegExp, CallerClass][] = [
  [/claudebot/i, 'claudebot'],
  [/claude[\s_-]?desktop/i, 'claude'],
  [/\bclaude\b/i, 'claude'],
  [/\banthropicclient\b/i, 'claude'],
  [/\bcursor\b/i, 'cursor'],
  [/chatgpt[\s_-]?user/i, 'chatgpt'],
  [/gptbot/i, 'gptbot'],
  [/\bopenai\b/i, 'chatgpt'],
  [/perplexitybot/i, 'perplexity'],
  [/\bperplexity\b/i, 'perplexity'],
  [/google[\s_-]?extended/i, 'gemini'],
  [/\bgemini\b/i, 'gemini'],
  [/googlebot/i, 'gemini'],
  [/\bcopilot\b/i, 'copilot'],
  [/github[\s_-]?copilot/i, 'copilot'],
  [/\bwindsurf\b/i, 'windsurf'],
  [/\bcodeium\b/i, 'windsurf'],
  // Named crawlers/bots — surfaced individually instead of the generic bucket
  [/bingbot/i, 'bingbot'],
  [/amazonbot/i, 'amazonbot'],
  [/applebot/i, 'applebot'],
  [/(meta-externalagent|facebookexternalhit|facebookcatalog)/i, 'metabot'],
  [/bytespider/i, 'bytespider'],
  [/ccbot/i, 'ccbot'],
  [/duckduckbot/i, 'duckduckbot'],
  [/yandexbot/i, 'yandexbot'],
  // Generic bot/crawler fallback for anything unnamed above
  [/\bbot\b/i, 'bot'],
  [/\bcrawl/i, 'bot'],
  [/\bspider\b/i, 'bot'],
  // Known browser user-agents
  [/mozilla.*?(chrome|firefox|safari|edge)/i, 'browser'],
];

/**
 * Classify a User-Agent string into one of the known caller categories.
 */
export function classifyCaller(userAgent: string | null | undefined): CallerClass {
  if (!userAgent) return 'unknown';
  for (const [pattern, cls] of UA_PATTERNS) {
    if (pattern.test(userAgent)) return cls;
  }
  // No browser UA and no known bot → likely a custom agent / SDK
  return 'agent';
}

/** Human-readable display names for caller classes. */
export const CALLER_LABELS: Record<CallerClass, string> = {
  claude: 'Claude / Anthropic',
  cursor: 'Cursor IDE',
  chatgpt: 'ChatGPT / OpenAI',
  perplexity: 'Perplexity AI',
  gemini: 'Gemini / Google',
  copilot: 'GitHub Copilot',
  windsurf: 'Windsurf / Codeium',
  claudebot: 'ClaudeBot (Anthropic crawler)',
  gptbot: 'GPTBot (OpenAI crawler)',
  bingbot: 'Bingbot (Microsoft)',
  amazonbot: 'Amazonbot',
  applebot: 'Applebot',
  metabot: 'Meta / Facebook bot',
  bytespider: 'Bytespider (ByteDance)',
  ccbot: 'CCBot (Common Crawl)',
  duckduckbot: 'DuckDuckBot',
  yandexbot: 'YandexBot',
  bot: 'Other bots & crawlers',
  agent: 'Custom agents',
  browser: 'Browser (Human)',
  unknown: 'Unknown',
};

/** Brand colors for each caller class (for dashboard charts). */
export const CALLER_COLORS: Record<CallerClass, string> = {
  claude: '#D97706',
  cursor: '#00D4AA',
  chatgpt: '#10A37F',
  perplexity: '#1DA1F2',
  gemini: '#4285F4',
  copilot: '#7C3AED',
  windsurf: '#06B6D4',
  claudebot: '#B45309',
  gptbot: '#059669',
  bingbot: '#00809D',
  amazonbot: '#FF9900',
  applebot: '#A2AAAD',
  metabot: '#0866FF',
  bytespider: '#FE2C55',
  ccbot: '#78716C',
  duckduckbot: '#DE5833',
  yandexbot: '#FC3F1D',
  bot: '#6B7280',
  agent: '#F59E0B',
  browser: '#94A3B8',
  unknown: '#4B5563',
};

type LogParams = {
  serverId?: string | null;
  endpoint: Endpoint;
  methodOrTool?: string | null;
  userAgent?: string | null;
  ipCountry?: string | null;
};

/**
 * Insert an API access log row. Returns a Promise that can be passed to
 * `ctx.waitUntil()` so it runs without blocking the response.
 *
 * @param db - Drizzle D1 database instance.
 */
export function logApiAccess(db: any, params: LogParams): Promise<void> {
  const callerClass = classifyCaller(params.userAgent);
  return db
    .insert(apiAccessLogs)
    .values({
      serverId: params.serverId || null,
      endpoint: params.endpoint,
      methodOrTool: params.methodOrTool || null,
      userAgent: (params.userAgent || '').slice(0, 512),
      callerClass,
      ipCountry: params.ipCountry || null,
    })
    .then(() => {})
    .catch((err: any) => {
      console.error('[accessLog] Failed to insert:', err?.message);
    });
}

type BatchLogParams = {
  serverIds: string[];
  endpoint: Endpoint;
  methodOrTool?: string | null;
  userAgent?: string | null;
  ipCountry?: string | null;
};

/**
 * Insert one access log row per server ID — used for search results, where a
 * single query can surface many listings and each owner needs their own
 * server-scoped row to see "search queries that find you" on their dashboard
 * (a single serverId:null row, as search logging used to write, is invisible
 * to every server's per-id analytics query).
 */
export function logApiAccessBatch(db: any, params: BatchLogParams): Promise<void> {
  if (params.serverIds.length === 0) return Promise.resolve();
  const callerClass = classifyCaller(params.userAgent);
  const userAgent = (params.userAgent || '').slice(0, 512);
  return db
    .insert(apiAccessLogs)
    .values(
      params.serverIds.map((serverId) => ({
        serverId,
        endpoint: params.endpoint,
        methodOrTool: params.methodOrTool || null,
        userAgent,
        callerClass,
        ipCountry: params.ipCountry || null,
      }))
    )
    .then(() => {})
    .catch((err: any) => {
      console.error('[accessLog] Failed to batch insert:', err?.message);
    });
}

/**
 * Helper to extract common request metadata for logging.
 */
export function extractRequestMeta(request: Request): { userAgent: string | null; ipCountry: string | null } {
  return {
    userAgent: request.headers.get('user-agent'),
    ipCountry: request.headers.get('cf-ipcountry'),
  };
}
