---
title: "MCP Server Stateless Scaling: Sessions and Routing"
excerpt: "Learn how MCP server stateless scaling works with Streamable HTTP, including session IDs, protocol headers, load-balancer routing, external state, and serverless limits."
tags: ["Deployment"]
faq:
  - q: "Can an MCP server run behind a load balancer?"
    a: "Yes, an MCP server can run behind a load balancer when the transport, session handling, and proxy configuration are compatible. A stateless Streamable HTTP server can generally send each request to any healthy replica. A stateful server needs sticky routing or shared state so that follow-up requests can find the initialized session and any server-side data associated with it."
  - q: "Where is the MCP session ID sent?"
    a: "The MCP session ID is sent in the Mcp-Session-Id HTTP header. A server that creates a session returns this header during initialization, and the client includes it on later HTTP requests. Proxies and load balancers must preserve this header in both directions. The identifier should be opaque and must not contain credentials or sensitive application data."
  - q: "Does stateless MCP mean the server does not need initialize?"
    a: "No. Stateless MCP does not remove the protocol initialization exchange. It means the server does not retain per-client protocol or application state between requests, so requests can be handled independently after the client supplies the information needed for processing. Exact behavior depends on the server implementation and MCP client, so test the intended client and transport combination."
  - q: "Is Streamable HTTP suitable for serverless MCP hosting?"
    a: "Streamable HTTP can work in serverless environments, but the platform must support the required HTTP method, response streaming behavior, header handling, execution duration, and concurrency model. Long-lived SSE connections, in-memory sessions, local files, and background work are poor assumptions for many serverless runtimes. Externalize durable state and design for retries and instance replacement."
---

MCP server stateless scaling lets you place Streamable HTTP servers behind a load balancer without requiring every request from one client to reach the same process. The key design choice is whether MCP session state lives only in process memory, is shared through an external store, or is avoided by making requests independently handleable. Sticky routing can support stateful replicas, but stateless request handling with external durable systems is usually easier to operate across autoscaling and serverless infrastructure.

## What stateless scaling means for MCP

An MCP server communicates through a transport, and the transport determines how JSON-RPC messages move between the client and server. [MCP transports](/mcp-transports) covers the broader comparison between stdio and Streamable HTTP; this article focuses on the HTTP deployment problem.

With Streamable HTTP, a client sends MCP messages with HTTP requests, commonly using `POST`. A server can return a normal JSON response or an event stream. The transport can also support a `GET` request that opens an SSE stream for server-to-client messages, depending on the server and client implementation. These are HTTP interactions, not a guarantee that one TCP connection or one application process will handle an entire MCP conversation.

That distinction matters behind a load balancer. A client may initialize through replica A, send a tool call through replica B, and open an event stream through replica C. If replica A stored the session only in local memory, the later request may fail even though all replicas are healthy.

Stateless scaling means that a replica does not require local, conversation-specific state to process the next request. The server can still use databases, APIs, caches, authentication systems, and other shared services. “Stateless” does not mean “no state anywhere”; it means state needed across requests is not tied exclusively to one ephemeral process.

For production deployment context, see the [remote MCP deployment guide](/blog/deploying-remote-mcp-servers-production-guide) and the broader [production MCP architecture guide](/blog/architecting-production-mcp-servers). They cover operational concerns beyond the scaling model.

## How MCP session IDs affect routing

Streamable HTTP servers may create a session during the initialization exchange. When they do, the server returns an `Mcp-Session-Id` HTTP response header. The client then includes that identifier in subsequent HTTP requests associated with the session.

After initialization, subsequent Streamable HTTP requests must also include the `MCP-Protocol-Version` header with the negotiated protocol version. For example, if initialization negotiated version `2025-06-18`, later requests should include `MCP-Protocol-Version: 2025-06-18`. The value is not universal: clients and servers must use the version negotiated during initialization and supported by their MCP implementation.

The session identifier is an HTTP header, not a path segment or query parameter. A reverse proxy must therefore preserve it without rewriting, dropping, logging carelessly, or exposing it through an unsafe cache key. Proxies must also preserve `MCP-Protocol-Version`, authentication headers, and the content negotiation headers required by the transport. Session IDs should be treated as opaque values. They should not encode access tokens, user records, filesystem paths, or other sensitive information.

A simplified exchange looks like this:

```http
POST /mcp HTTP/1.1
Host: mcp.example.com
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"example-client","version":"1.0.0"}}}
```

The response may include a session header:

```http
HTTP/1.1 200 OK
Content-Type: application/json
Mcp-Session-Id: opaque-session-value

{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{},"serverInfo":{"name":"example-server","version":"1.0.0"}}}
```

A later request can then contain:

```http
POST /mcp HTTP/1.1
Host: mcp.example.com
Content-Type: application/json
Accept: application/json, text/event-stream
Mcp-Session-Id: opaque-session-value
MCP-Protocol-Version: 2025-06-18

{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

The exact JSON fields depend on the MCP method and protocol version. The important scaling properties are the header relationships: if the server uses the session ID to locate protocol state, every replica must be able to resolve that ID or the load balancer must consistently route it to the owning replica. The replica must also accept the negotiated `MCP-Protocol-Version` and apply the corresponding protocol behavior.

A server may reject requests with a missing, invalid, or expired session ID, or with a missing or unsupported protocol-version header. Clients and servers also differ in how they handle sessionless operation, so do not assume that removing the session header creates a valid stateless mode. Verify the behavior of the SDK and client versions you deploy.

## Three deployment patterns

There are three common ways to operate Streamable HTTP replicas.

### 1. Stateful replicas with sticky routing

The load balancer uses the session ID, a cookie, or another affinity mechanism to route a client consistently to one replica. The replica keeps session data in process memory.

This is the smallest architectural change for an existing stateful server. It can also reduce latency because the server avoids a network lookup for every request. However, affinity is not the same as durability. A restarted instance loses its sessions, and a failed instance can make all of its attached sessions unusable.

Affinity also complicates autoscaling. A busy replica may remain overloaded while new replicas receive little traffic. Routing based on a cookie may not align with the MCP session ID, especially when clients do not accept or return cookies consistently. If the load balancer supports header-based affinity, configure it deliberately and test behavior for initialization, POST requests, and any SSE GET stream.

Use this model when sessions are short-lived, losing a session is acceptable, and the load balancer has reliable affinity support. Document the failure behavior: clients may need to reconnect and initialize again after a replica restart.

### 2. Stateful application with external session storage

Each replica can receive any request, but session data is stored in a shared system such as a database or distributed key-value store. The MCP process remains replaceable, while the session record survives instance changes according to the store’s durability and expiration policy.

A session record might contain:

```json
{
  "sessionId": "opaque-session-value",
  "principal": "user-or-service-id",
  "protocolVersion": "2025-06-18",
  "serverCapabilities": ["tools"],
  "createdAt": "2026-10-16T12:00:00Z",
  "expiresAt": "2026-10-16T13:00:00Z"
}
```

Do not copy this structure blindly into production. Store only the protocol and application data you need, encrypt sensitive values where appropriate, and define an expiration policy. Session storage needs concurrency controls because two requests from a client may arrive close together or be retried.

External state solves process affinity, but it does not solve every problem. If a tool starts a long-running job, the job itself needs durable ownership and status tracking. If an SSE stream is connected to replica B while a notification is produced on replica A, the system needs a broker, subscription layer, or another delivery mechanism to forward that event. A shared session row alone does not move an open network connection between processes.

### 3. Stateless request handling

In a genuinely sessionless design, the server omits the `Mcp-Session-Id` response header and handles each request without requiring protocol or application state retained from an earlier request. The initialization exchange still applies; sessionless does not mean that initialization can be skipped. Each request must carry, or allow the server to derive, the authentication and application context needed for processing. After initialization, requests still need to comply with the protocol-version requirements of the negotiated MCP version.

If a Streamable HTTP server does issue `Mcp-Session-Id`, that identifier is not merely optional correlation metadata. The client is expected to send it on subsequent requests, together with the negotiated `MCP-Protocol-Version` header, and the server must implement valid handling for the associated protocol and session semantics. Those semantics can be backed by process memory with sticky routing, by an external session store, or by another mechanism that lets the server resolve the identifier. A server should not return the header and then treat it as disposable when requests reach a different replica.

Tool execution should be based on authenticated identity, validated arguments, and durable backends rather than mutable fields on a server object. For example, a tool that reads a document should resolve the principal from the request’s authentication context and fetch the document from an external system. It should not depend on a previous request having populated `currentUser` in process memory.

Statelessness is especially useful when a load balancer distributes requests across replicas and when instances are frequently created or destroyed. It also makes rolling deployments simpler. The trade-off is that more work moves into shared infrastructure: authentication, databases, queues, caches, rate limits, idempotency records, and event delivery.

## Choosing sticky routing or external state

Use sticky routing when the server already has substantial in-memory session behavior and the operational consequences are acceptable. It can be a pragmatic migration step, but plan for failures and scale imbalance.

Use external state when sessions must survive process replacement, replicas need even traffic distribution, or more than one instance must observe the same conversation and job state. This is typically the better long-term model for a horizontally scaled service, although it adds network latency, schema design, capacity planning, and failure modes.

Use sessionless request handling when the protocol and product design do not require server-held conversational state. This often fits task-shaped tools that perform one authenticated operation at a time. The [REST-to-MCP design guide](/blog/wrap-rest-api-as-mcp-server) discusses task-shaped tools and compact interfaces that can reduce unnecessary server-side conversation state.

A useful decision table is:

| Requirement | Suitable approach |
|---|---|
| Existing in-memory sessions, short-lived clients | Sticky routing |
| Sessions must survive replica replacement | External session store |
| Any replica should process any request | External state or sessionless handling |
| Serverless instances with no durable local memory | Sessionless handling or external state |
| Long-lived server-to-client events | Shared event delivery plus connection-aware routing |
| Simple independent API-style tools | Sessionless handling |

Do not use sticky routing as a substitute for durable job state. A tool that launches work should write a job record to a durable system and return an identifier that can be checked later. This also makes retries and client reconnection easier to reason about.

## Load-balancer configuration concerns

A working MCP deployment requires more than sending traffic to a healthy port.

First, preserve HTTP methods and headers. The proxy must pass `POST`, and if the chosen client uses the server’s SSE stream, it must support the relevant `GET` request and return streaming responses without buffering them indefinitely. Preserve `Content-Type`, `Accept`, `Mcp-Session-Id`, `MCP-Protocol-Version`, authentication headers, and any tracing headers used by the service.

Second, configure timeouts based on the transport behavior. A short idle timeout can terminate an SSE response that is functioning correctly. A short request timeout can interrupt a long-running tool call. Conversely, very long limits can consume connections and workers when clients disappear. Set separate policies for ordinary request handling and streaming where the platform allows it.

Third, make health checks meaningful. A process responding to `/healthz` may still be unable to reach the database, session store, queue, or downstream API required by tools. Use a lightweight readiness check for dependencies and keep deep dependency checks from causing cascading load during an outage.

Fourth, control retries. Retrying a JSON-RPC request is not automatically safe: a tool may have created a resource, sent a message, or changed data before the connection failed. Use idempotency keys or durable operation records for side-effecting tools. Do not let a proxy blindly retry every `POST`.

Finally, disable caching for session-bound MCP traffic unless you have a carefully designed, authenticated cache policy. A cached response associated with one principal or session must never be returned to another.

## Serverless constraints

Serverless hosting can be a good fit for short, independent MCP requests, but several assumptions need review.

An instance may disappear immediately after a response. Local memory cannot be the only location for MCP session state, OAuth-related state, job progress, or rate-limit counters. Local files may be unavailable on another invocation or may be temporary. Use managed storage for anything that must survive a cold start or route change.

Streaming is another constraint. Some serverless platforms buffer responses, impose maximum execution durations, or do not support long-lived HTTP connections in the same way as a conventional service. An MCP server that relies on an open SSE stream may therefore require a long-running container, a platform with explicit streaming support, or a separate event delivery design.

Cold starts and concurrency also affect tool design. Avoid assuming one request at a time per process. Protect shared client objects, use bounded downstream connection pools, and set explicit limits for tool execution. If the platform can terminate an invocation, background work must be handed to a durable queue before returning control to the client.

Authentication must be verified on every request. Do not trust a session ID as proof of identity; bind session records to the authenticated principal and reject mismatches. Treat session identifiers as bearer-like routing references and avoid placing them in logs at full value. The [security MCP server directory](/best/security) is a useful place to review security-oriented tooling, while the [monitoring directory](/best/monitoring) can help with observability options.

## Testing a horizontally scaled server

Test the deployment with at least two replicas and force requests to alternate between them. A reverse proxy or test harness can simulate this by using different upstreams for successive requests. Verify initialization, `tools/list`, tool calls, errors, reconnects, and session expiration.

A practical test sequence is:

1. Initialize against replica A and record the `Mcp-Session-Id` response header and negotiated protocol version.
2. Send `notifications/initialized` and a request through replica B with that session header and the matching `MCP-Protocol-Version` header.
3. Terminate replica A and retry a request through replica B.
4. Open any supported SSE stream and produce an event from a different replica.
5. Repeat requests concurrently and inspect ordering, duplicate execution, and timeout behavior.
6. Confirm that an invalid or cross-user session ID is rejected.

Use the [MCP testing and debugging guide](/blog/testing-and-debugging-mcp-servers) for a broader test workflow, and use the [interactive MCP playground](/tools/playground) for manual protocol inspection where its supported transport matches your server.

Observe more than HTTP status codes. Record request IDs, JSON-RPC IDs, transport events, selected upstream replica, session lookup results, negotiated protocol version, tool duration, downstream failures, and retry counts. Never log authorization headers or unredacted session identifiers. If a client reconnects, distinguish a legitimate retry from duplicate side effects.

## A practical migration path

If your current server stores all state in memory, migrate incrementally.

1. Inventory state: protocol sessions, authenticated principals, tool caches, job progress, subscriptions, and temporary files.
2. Classify each item as request-local, shareable, durable, or disposable.
3. Add explicit session expiration and principal binding.
4. Move durable jobs and side effects behind idempotent APIs or operation records.
5. Add a second replica before removing affinity.
6. Test requests that alternate replicas and simulate instance loss, including the required `MCP-Protocol-Version` header.
7. Move session records and event coordination to shared infrastructure where required.
8. Remove sticky routing only after clients, proxies, and observability confirm the new behavior.

If the server currently uses HTTP plus SSE, review the [HTTP+SSE to Streamable HTTP migration guide](/blog/migrating-mcp-servers-http-sse-to-streamable-http) before changing routing. Transport migration can change connection behavior, headers, and proxy requirements independently of the state model.

## Next steps

For MCP server stateless scaling, start by deciding whether the session ID is required for correctness or only useful for correlation. A genuinely sessionless implementation should omit the header; one that returns it must resolve the associated session semantics across requests. After initialization, preserve both `Mcp-Session-Id` and the negotiated `MCP-Protocol-Version` header, then test two replicas, externalize durable state, and verify streaming and retry behavior under failure. Browse [MCP transports](/mcp-transports), the [remote deployment blueprint](/blog/deploying-remote-mcp-servers-production-guide), and [production MCP architecture patterns](/blog/architecting-production-mcp-servers) before selecting a hosting model.
