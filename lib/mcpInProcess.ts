import { POST as mcpPost } from '@/app/api/mcp/route';
import type { McpCall } from '@/lib/a2a';

/** Headers carried from the caller so auth, rate limits and logs still see them. */
const FORWARD = [
  'authorization',
  'user-agent',
  'cf-connecting-ip',
  'x-forwarded-for',
  'x-real-ip',
  'cf-ipcountry',
];

/** Calls the /api/mcp handler in-process, as the original caller. */
async function mcpRpc(
  from: Request,
  method: string,
  params: unknown,
): Promise<{ result?: any; error?: { message?: string } }> {
  const headers = new Headers({
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  });
  for (const h of FORWARD) {
    const v = from.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set(
    'user-agent',
    `${headers.get('user-agent') || 'unknown'} (via A2A)`,
  );
  const res = await mcpPost(
    new Request('https://allmcps.com/api/mcp', {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
  if (res.status === 429) {
    return { error: { message: 'Rate limited. Slow down and retry shortly.' } };
  }
  return (await res.json()) as { result?: any; error?: { message?: string } };
}

export function mcpToolCaller(from: Request): McpCall {
  return (name, args) => mcpRpc(from, 'tools/call', { name, arguments: args });
}
