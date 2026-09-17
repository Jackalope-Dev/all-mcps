import { isSafeFetchTarget } from '../urlSafety';

/**
 * Does a cached remote endpoint actually speak MCP?
 *
 * `looksLikeMcpEndpointUrl` is a *shape* test — it accepts any URL with an /mcp, /sse or
 * /message path segment, or an api./mcp./sse. host. That bar exists to stop a plain
 * homepage being handed to a client, and it does that job, but plenty of URLs clear it
 * while serving HTML to humans: https://magichour.ai/mcp is their connection-docs page,
 * and it was cached as the endpoint for one of their listings. Thousands of listings hand
 * out a URL parsed out of README text that nothing has ever connected to.
 *
 * So this asks the endpoint directly. The hard part is not detecting success — it's
 * refusing to call a healthy server dead:
 *
 *  - An OAuth-protected server answers `initialize` with 401 + WWW-Authenticate (RFC 9728).
 *    That is a correctly-configured server, not a broken one. A probe that only accepts
 *    anonymous success would clear exactly the servers that implement auth properly.
 *  - A legacy SSE-transport server expects `GET` with an event-stream Accept header and
 *    may reject the Streamable-HTTP `POST` outright.
 *  - Timeouts, 5xx, 403 bot-walls and DNS failures say something about the network or the
 *    moment, not about whether the URL is an MCP endpoint.
 *
 * Only a content-level verdict — it served HTML, or it is definitively gone — is treated
 * as proof of "not an MCP endpoint". Everything else returns 'unknown' and the caller
 * leaves the data alone.
 */

const PROTOCOL_VERSION = '2025-06-18';
const CLIENT_INFO = { name: 'AllMCPs Endpoint Verifier', version: '1.0.0' };
const TIMEOUT_MS = 12000;

export type EndpointVerdict = 'alive' | 'not-mcp' | 'unknown';

export type ProbeResult = {
  verdict: EndpointVerdict;
  /** Short human-readable reason, safe to log or store. */
  detail: string;
};

export type ProbeResponseFacts = {
  status: number;
  contentType: string;
  wwwAuthenticate?: string | null;
  /** Response body, or a prefix of it — only ever inspected, never executed. */
  body: string;
};

/** Is this body a JSON-RPC response to our initialize call from a real MCP server? */
function looksLikeInitializeResult(body: string): boolean {
  // Both transports are covered: a bare JSON body, or SSE frames whose `data:` lines
  // carry the JSON-RPC message.
  const candidates = body.includes('data:')
    ? body
        .split(/\r?\n/)
        .filter((l) => l.trim().startsWith('data:'))
        .map((l) => l.trim().slice(5).trim())
    : [body];

  for (const candidate of candidates) {
    if (!candidate || candidate === '[DONE]') continue;
    try {
      const msg = JSON.parse(candidate);
      if (msg?.jsonrpc !== '2.0') continue;
      // A JSON-RPC *error* still proves something MCP-shaped is listening; only a
      // result with protocol/server identity proves a completed handshake, and either
      // is enough to keep the row.
      if (msg.result?.protocolVersion || msg.result?.serverInfo || msg.error) {
        return true;
      }
    } catch {
      // Not JSON — keep looking at the remaining frames.
    }
  }
  return false;
}

/**
 * Turn one HTTP response into a verdict. Pure, so the classification rules are testable
 * without a network: every branch here decides whether a listing keeps or loses its
 * advertised connection URL.
 */
export function classifyProbeResponse(facts: ProbeResponseFacts): ProbeResult {
  const contentType = (facts.contentType || '').toLowerCase();

  // RFC 9728 protected resource: healthy, just needs credentials we deliberately don't have.
  if (facts.status === 401 && facts.wwwAuthenticate) {
    return {
      verdict: 'alive',
      detail: 'OAuth-protected (401 + WWW-Authenticate)',
    };
  }

  if (looksLikeInitializeResult(facts.body)) {
    return {
      verdict: 'alive',
      detail: `MCP handshake answered (HTTP ${facts.status})`,
    };
  }

  // An open event stream is a live SSE-transport endpoint even before any frame arrives.
  if (contentType.includes('text/event-stream')) {
    return { verdict: 'alive', detail: 'SSE stream opened' };
  }

  // Served a web page to a JSON-RPC POST: this is documentation or marketing, not a
  // transport. The single most common way a listing advertises an unusable endpoint.
  //
  // Restricted to a 2xx on purpose. HTML is the strongest "not MCP" signal we have,
  // but a Cloudflare challenge ("Just a moment...") and a 502 gateway page are HTML
  // too, and neither says anything about the URL. Only a page served *successfully*
  // to a JSON-RPC POST proves the endpoint is for humans.
  if (
    contentType.includes('text/html') &&
    facts.status >= 200 &&
    facts.status < 300
  ) {
    return {
      verdict: 'not-mcp',
      detail: `Served HTML, not MCP (HTTP ${facts.status})`,
    };
  }

  if (facts.status === 404 || facts.status === 410) {
    return {
      verdict: 'not-mcp',
      detail: `Endpoint gone (HTTP ${facts.status})`,
    };
  }

  // 403 is usually a bot wall, 5xx is the server having a bad day, 405 may be an SSE-only
  // endpoint that dislikes POST — none of them are evidence about the URL itself.
  return { verdict: 'unknown', detail: `Inconclusive (HTTP ${facts.status})` };
}

async function postInitialize(url: string): Promise<ProbeResponseFacts> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO,
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return {
    status: res.status,
    contentType: res.headers.get('content-type') || '',
    wwwAuthenticate: res.headers.get('www-authenticate'),
    body: (await res.text()).slice(0, 4000),
  };
}

/** GET fallback for legacy SSE-transport servers that only accept an event-stream GET. */
async function getEventStream(url: string): Promise<ProbeResponseFacts> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const facts = {
    status: res.status,
    contentType: res.headers.get('content-type') || '',
    wwwAuthenticate: res.headers.get('www-authenticate'),
    body: '',
  };
  // Don't drain an event stream that stays open by design — the content type is the
  // signal, and reading to completion would block until the timeout.
  if (!facts.contentType.toLowerCase().includes('text/event-stream')) {
    facts.body = (await res.text()).slice(0, 4000);
  }
  await res.body?.cancel().catch(() => {});
  return facts;
}

/**
 * Probe one URL. Never throws: a network failure is 'unknown', because "we couldn't reach
 * it just now" must not cost a listing its connection details.
 */
export async function probeRemoteEndpoint(url: string): Promise<ProbeResult> {
  const target = (url || '').trim();
  if (!target || !/^https?:\/\//i.test(target)) {
    return { verdict: 'not-mcp', detail: 'Not an http(s) URL' };
  }
  if (!isSafeFetchTarget(target)) {
    // Private/loopback/metadata addresses: never probe them, and never advertise them
    // either — no client on the open internet could use one.
    return { verdict: 'not-mcp', detail: 'Not a permitted public endpoint' };
  }

  let first: ProbeResult;
  try {
    first = classifyProbeResponse(await postInitialize(target));
  } catch (e) {
    first = {
      verdict: 'unknown',
      detail:
        (e as Error)?.name === 'TimeoutError'
          ? 'Connection timed out'
          : (e as Error)?.message || 'Connection failed',
    };
  }
  if (first.verdict === 'alive') return first;

  // A POST-hostile SSE endpoint looks identical to a dead one until you ask the way it
  // expects, so confirm with a GET before taking anything away.
  try {
    const second = classifyProbeResponse(await getEventStream(target));
    if (second.verdict === 'alive') return second;
    // Trust whichever probe reached a content-level verdict; prefer the POST's wording.
    if (first.verdict === 'not-mcp') return first;
    return second.verdict === 'not-mcp' ? second : first;
  } catch {
    return first;
  }
}
