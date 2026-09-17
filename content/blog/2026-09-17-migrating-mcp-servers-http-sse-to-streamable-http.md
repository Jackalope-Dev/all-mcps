---
title: "Migrating MCP Servers from HTTP+SSE to Streamable HTTP"
excerpt: "The HTTP+SSE transport is deprecated and the dual-endpoint session model is the reason. Here is what Streamable HTTP actually changes, how to run both transports from one handler during the window, and the proxy and infrastructure settings that quietly break the migration."
tags: ["MCP", "Guides", "Architecture", "Developer Tools"]
faq:
  - q: "Is the HTTP+SSE transport removed from MCP?"
    a: "Not removed, deprecated. A server that still exposes GET /sse and POST /message keeps working during the deprecation window, which MCP's feature lifecycle policy sets at a minimum of twelve months. What changed is that new servers should not build on it, and clients are expected to try Streamable HTTP first and fall back to HTTP+SSE only when the modern request fails. Treat it the way you would treat any deprecated API you still ship: keep it answering, stop adding to it, and put every new capability on the modern path."
  - q: "What is the actual difference between HTTP+SSE and Streamable HTTP?"
    a: "HTTP+SSE splits one logical conversation across two endpoints and a session identifier. The client opens a long-lived GET /sse stream, the server pushes back a session-scoped POST URL, and every subsequent request goes to that URL while responses come back down the original stream. Streamable HTTP collapses that into a single endpoint where each request gets its own response, which may be a plain JSON body or a stream scoped to that one request. There is no standalone stream, no session endpoint handshake, and no requirement that two HTTP interactions land on the same instance."
  - q: "Do I need sticky sessions with Streamable HTTP?"
    a: "No, and that is most of the point. Under HTTP+SSE the POST and the stream it answers on had to reach the same process, so any load balancer in front of the server needed session affinity. Streamable HTTP makes each request self-contained, so requests can be spread across instances freely. If your deployment still needs affinity after migrating, something in your own code is holding per-connection state that the protocol no longer guarantees."
  - q: "Can one server support both transports at once?"
    a: "Yes, and that is the recommended migration path. Keep the legacy GET /sse and POST /message routes mounted exactly as they are, add the single modern endpoint, and route both into the same tool implementations. The transport layer is the only thing that should be aware of which era a caller belongs to. If a tool handler ever needs to know, the split has been drawn in the wrong place."
  - q: "Why does my migrated server work locally but time out in production?"
    a: "Almost always a proxy buffering the response. A streamed Streamable HTTP response is still a single HTTP response, so anything that buffers response bodies before forwarding them, including the default configuration of several reverse proxies and CDNs, will hold the entire stream until completion and turn incremental output into one delayed blob or an outright timeout. Disable response buffering on the MCP route and confirm the streaming path end to end rather than only against localhost."
---

> **TL;DR:** The [HTTP+SSE transport](/mcp-transports) is deprecated, and the reason is structural rather than stylistic: it split one conversation across two endpoints plus a session identifier, which forced sticky sessions onto every deployment that outgrew a single process. **Streamable HTTP** replaces it with one endpoint where each request carries its own response, streamed or not. This post covers what actually changes on the wire, how to serve both transports from one set of tool handlers during the deprecation window, the infrastructure settings that break a technically-correct migration, and how to tell when you are finished.

If you deployed a remote MCP server any time in the last year, you almost certainly built it on HTTP+SSE. It was the transport every tutorial showed, including [our own production deployment guide](/blog/deploying-remote-mcp-servers-production-guide), and it worked. Then the [2026-07-28 revision](/mcp-protocol-versioning) marked it discouraged in favour of Streamable HTTP, and a transport that had been the obvious default became something you are expected to migrate off.

This is not a rename. The two transports disagree about something fundamental — whether a conversation is a thing that exists between requests — and that disagreement is why the migration touches your infrastructure at least as much as your code.

---

## What HTTP+SSE Actually Required

The dual-endpoint model looks innocuous written down:

1. The client sends `GET /sse`. The server responds with `Content-Type: text/event-stream` and holds the connection open.
2. The server's first event hands back a session-scoped URL, something like `/message?sessionId=abc123`.
3. Every client request is a `POST` to that URL. The response to each one arrives as an event on the stream from step 1, correlated by JSON-RPC id.

Three properties fall out of that, and all three become problems at scale.

**The stream must outlive every request it carries.** A single socket stays open for the entire conversation. That socket now has to survive every proxy, load balancer, and idle timeout between the client and your process — and the default idle timeout on a lot of that infrastructure is sixty seconds, which is shorter than plenty of legitimate tool calls.

**The POST and the stream must reach the same process.** The response to a POST goes out on a socket held by one specific instance. If your load balancer sends the POST somewhere else, that instance has no stream to answer on. The fix was session affinity, which means a deploy drops in-flight conversations and horizontal scaling stops being transparent.

**The session identifier becomes real state.** Something has to know that `abc123` maps to an open stream on a particular box. That is server state with a lifetime, which means eviction, leaks, and a recovery story for what happens when it disappears mid-conversation.

None of this is bad engineering. It is the natural consequence of modelling a remote transport on the one MCP started with, where a persistent bidirectional channel is simply free.

## What Streamable HTTP Changes

Streamable HTTP asks a narrower question: what if each request just got its own response?

One endpoint. A client POSTs a JSON-RPC request to it. The server replies with either a plain JSON response or a stream scoped to that single request, and when the response is done, the HTTP interaction is over. Nothing survives it.

```http
POST /mcp HTTP/1.1
Host: mcp.example.com
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search","arguments":{"q":"postgres"}}}
```

The `Accept` header is doing the interesting work. The client is saying it can handle either shape, and the server picks per request: a fast tool returns `application/json` and is done, while a tool that emits progress returns `text/event-stream` and streams events belonging to that one call.

The consequences invert the list above. There is no standalone stream to keep alive between requests, so idle timeouts stop being a protocol concern. There is no session endpoint, so two requests from the same client can land on different instances without anything noticing. There is no session identifier to store, because nothing needs to be remembered between requests in the first place.

This is the same reasoning that produced [MRTR](/blog/mcp-mrtr-multi-round-trip-requests-guide) for server-initiated requests. Both changes take something that was implicitly a long-lived connection and make it an explicit, resumable exchange instead. If you have already ported your server off `sampling/createMessage` and `elicitation/create`, this migration will feel familiar.

## Running Both Transports From One Handler

The migration only stays manageable if the transport split lives at the edge of your server and nowhere else. Mount the modern endpoint beside the legacy pair, and route everything into the same handlers:

```typescript
import express from 'express';

const app = express();
app.use(express.json());

// Every transport funnels into this. It knows nothing about HTTP.
async function handleRpc(message: JsonRpcRequest): Promise<JsonRpcResponse> {
  switch (message.method) {
    case 'tools/call':
      return callTool(message);
    case 'tools/list':
      return listTools(message);
    default:
      return methodNotFound(message);
  }
}

// ── Modern: one endpoint, one response per request ──
app.post('/mcp', async (req, res) => {
  const message = req.body as JsonRpcRequest;
  const wantsStream = (req.headers.accept ?? '').includes('text/event-stream');

  if (!wantsStream || !isStreamingTool(message)) {
    res.json(await handleRpc(message));
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.flushHeaders();

  // Events here belong to THIS request only, and the response ends with it.
  for await (const event of streamRpc(message)) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
});

// ── Legacy: kept answering, closed to new work ──
app.get('/sse', legacySseHandler);
app.post('/message', legacyMessageHandler);

app.listen(3000);
```

Two rules keep this from rotting.

**No tool handler may branch on transport.** If `callTool` needs to know whether it was reached through `/mcp` or `/message`, the split has been drawn too deep and you now have two servers wearing one codebase. Anything transport-shaped — how a stream is framed, how a response is written — belongs above `handleRpc` and nowhere below it.

**New capability goes on the modern path only.** The legacy routes are in maintenance. They answer what they already answered. Every tool you add from here exists on `/mcp`, and when the window closes you delete two route registrations rather than unpicking a year of divergence.

## The Infrastructure Settings That Break It

This is where a correct migration fails in production while passing every local test, because none of it reproduces against `localhost`.

**Response buffering.** The single biggest one. A streamed Streamable HTTP response is still one HTTP response, and any intermediary that buffers response bodies will hold the whole thing until your handler finishes — converting incremental progress into one delayed lump, or a gateway timeout if the tool runs long. Nginx buffers proxied responses by default:

```nginx
location /mcp {
    proxy_pass http://mcp_backend;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
}
```

The `X-Accel-Buffering: no` response header does the same job from the application side, and is worth sending regardless since you do not always control the proxy config.

**Compression middleware.** Gzip middleware that buffers to build a compression window will stall a stream just as effectively as a proxy will. Exclude the MCP route, or make sure the middleware flushes per chunk.

**Idle and read timeouts.** These stop mattering *between* requests after the migration, but they still apply *within* a single long streaming response. A ten-minute tool call still needs a read timeout above ten minutes.

**CORS, if browser clients connect.** One endpoint means one preflight surface, which is simpler than the dual-endpoint version — but `Accept` has to survive as an allowed request header, or clients lose the ability to ask for a stream at all.

A useful sanity check, since it fails loudly when buffering is on:

```bash
curl -N -X POST https://mcp.example.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"slow_search","arguments":{}}}'
```

With `-N` disabling curl's own buffering, events should appear incrementally. If they all arrive at once when the call completes, something between you and the server is buffering, and the code is not the problem.

## Detecting Which Transport a Client Speaks

Clients are migrating on their own schedule, so your server will meet both for a while. Detect once per connection or origin, not per call — the detection rules in the [protocol versioning guide](/mcp-protocol-versioning) are the reliable ones, and the answer should be cached for the life of the process.

The short version for HTTP: attempt the modern single-endpoint request first. A modern server answers it. A legacy-only server returns a transport-level error or a non-MCP error body, and only then is falling back to `GET /sse` justified. Probing the deprecated transport first inverts the incentive and keeps legacy paths warm long past their usefulness.

Server-side, the tell is `_meta`. Modern clients send `io.modelcontextprotocol/protocolVersion` on every request; legacy clients complete an `initialize` handshake and never send that field at all. That single check is enough to decide which response shape a caller can handle, and it costs nothing to evaluate.

## Knowing When You Are Done

The migration is finished when all four of these are true, not when the modern endpoint starts answering:

- **No sticky sessions.** Session affinity is off at the load balancer and the server still works. If removing affinity breaks it, per-connection state is still hiding somewhere in your code.
- **Legacy routes are cold.** Instrument `GET /sse` with a counter. When it reads zero across a full traffic cycle, the routes are deletable — and you will know rather than guess.
- **Streaming verified through the real edge.** Not localhost. The `curl -N` check above, run against production, through every proxy that sits in front of you.
- **Nothing stores a session identifier.** No Redis key, no in-memory map, no correlation table keyed by session. If one still exists, you have kept the HTTP+SSE model and changed only its URLs.

That last one is the real test. Streamable HTTP is not a different way to spell the same transport; it is the removal of the assumption that a conversation exists between requests. A server that migrated the endpoints but kept the session table has done the syntax and skipped the semantics, and it will need the same migration again the first time it scales past one instance.

If you are starting fresh instead of migrating, the [transports guide](/mcp-transports) covers choosing between stdio and Streamable HTTP in the first place, and the [deployment guide](/blog/deploying-remote-mcp-servers-production-guide) covers getting either one into production. When your server is ready for other people to find, [submit it to the directory](/submit).
