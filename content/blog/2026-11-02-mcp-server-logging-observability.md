---
title: "MCP Server Logging Observability: Protocol Logs and Alerts"
excerpt: "Learn how to implement MCP server logging observability with protocol messages, stderr, structured tool traces, and production alerts for remote servers."
tags: ["Guides", "MCP", "Architecture", "Developer Tools"]
faq:
  - q: "Should MCP servers log to stderr or use notifications/message?"
    a: "Use stderr for process diagnostics when the server runs over stdio, and use MCP logging notifications when the client needs protocol-level log records. They serve different audiences: stderr is an operational stream outside JSON-RPC, while notifications/message are MCP messages that a capable client can receive and display. Remote servers should send operational logs to their logging system rather than assuming stderr is visible."
  - q: "How do I trace an MCP tool call?"
    a: "Trace an MCP tool call by recording the JSON-RPC request ID, session or connection identifier, tool name, start and end timestamps, outcome, and error classification. Add distributed trace context at your transport boundary when your deployment supports it, but do not assume MCP defines a universal trace-context field. Propagate correlation data through your server and downstream dependencies."
  - q: "What should I alert on for a remote MCP server?"
    a: "Alert on sustained request failures, authentication failures, transport disconnects, latency violations, overloaded sessions, and abnormal tool error rates. Also alert when tool schemas or server capabilities change unexpectedly, because clients can fail even when the process is healthy. Use rate-based and multi-window alerts instead of paging on one isolated tool error."
  - q: "Can MCP logging notifications replace application logs?"
    a: "No. MCP logging notifications are useful for messages intended for an MCP client, but they are not a durable application logging pipeline. Keep structured server logs, metrics, and traces in your operational platform. Send selected, non-sensitive records through the MCP logging mechanism when a client needs visibility, and apply level filtering and redaction before doing so."
---

MCP server logging observability requires two separate paths: protocol logging for MCP clients and operational logging for engineers. Use `notifications/message` for log records that a client should receive, use stderr for diagnostics from stdio processes, and emit structured application logs, metrics, and traces for production monitoring. For remote servers, correlate every tool call with its JSON-RPC request ID, session, transport, latency, outcome, and authentication context so failures can be investigated without logging sensitive arguments.

## The three logging paths in MCP

An MCP server can produce information at three different layers:

1. **MCP protocol messages** travel through the active MCP transport and follow JSON-RPC and MCP rules.
2. **Process diagnostics** such as stderr output are outside the MCP protocol. They are useful for local process supervision and debugging.
3. **Application telemetry** includes structured logs, metrics, traces, audit events, and alerts collected by your deployment platform.

Confusing these paths causes common production problems. A line written to stderr does not become an MCP logging notification. A `notifications/message` record is not automatically stored in your cloud logging platform. A trace span created by your HTTP server does not automatically describe the internal tool operation unless you instrument that operation.

Before implementing a pipeline, identify the transport. With [stdio and Streamable HTTP transports](/mcp-transports), stdout is reserved for protocol traffic in a stdio server, while stderr is an out-of-band diagnostic stream. A remote server normally writes operational logs to its process logger, container runtime, or hosted logging service; the MCP client sees only protocol responses and notifications that the server sends over the connection.

## MCP logging notifications

MCP defines a logging utility for servers to send log messages to clients. The notification method is `notifications/message`. Its parameters include a log `level`, a `logger` name, and `data`, where `data` can contain the log payload.

A representative notification looks like this:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "info",
    "logger": "orders-tool",
    "data": {
      "event": "upstream_request_started",
      "request_id": "42",
      "operation": "list_orders"
    }
  }
}
```

The exact client behavior varies. Some clients display these messages, some filter them by level, and some do not expose them prominently. The server should therefore treat protocol logging as a client-facing convenience, not as its only observability mechanism.

The core MCP capability is advertised by the **server**, not by a general-purpose client `logging` capability during initialization. A server that supports the logging utility can advertise the relevant `logging` server capability. The client can then send a `logging/setLevel` request to configure the minimum level the server should send. Client capability fields and extensions can vary by MCP version or implementation, so do not infer core logging support from a client initialization capability unless the relevant specification or client documentation explicitly defines it.

The standard log levels are ordered from low to high severity: `debug`, `info`, `notice`, `warning`, `error`, `critical`, `alert`, and `emergency`. Implement the level filter on the server side so that debug events do not create unnecessary network traffic or expose details when the client has not requested them. A client may not support or display every level in the same way, so keep the operational logging path independent.

A useful policy is:

```text
debug     local development and detailed timing
info      normal lifecycle events worth showing to a client
notice    unusual but handled conditions
warning   degraded behavior or retryable problems
error     failed operation or rejected request
critical  service-level failure requiring immediate attention
```

Do not send secrets, access tokens, complete tool arguments, database rows, or provider responses by default. Protocol notifications can cross a trust boundary and may be displayed in a user interface. Log identifiers and bounded summaries instead of raw payloads.

## stderr versus protocol logging

For a stdio server, stdout carries JSON-RPC messages. Any ordinary print statement on stdout can corrupt the protocol stream. Diagnostics should go to stderr or to a separate logging destination.

A minimal process-level pattern is:

```python
import json
import sys


def diagnostic(message, **fields):
    record = {"message": message, **fields}
    print(json.dumps(record), file=sys.stderr, flush=True)


diagnostic(
    "tool handler started",
    tool="search_documents",
    request_id="42",
)
```

This output is visible to a local launcher, IDE, terminal, container runtime, or process supervisor, depending on how the client starts the server. It is not a JSON-RPC response and cannot be relied on as a client-visible MCP event.

For an MCP notification, write through the SDK or transport abstraction rather than manually writing JSON to stdout. SDK APIs differ by language and version, but the implementation should preserve the same separation: protocol writes are serialized by the MCP connection, while diagnostic writes are handled by the application logger.

For remote deployments, stderr is still useful inside a container or service instance, but it is not a client delivery mechanism. Configure the runtime to collect it, normalize it as structured data, and attach service, instance, region, and deployment metadata. If a remote client must see progress or a user-safe status update, send the appropriate MCP notification through the protocol instead.

The [MCP Protocol Inspector and response debugger](/tools/protocol-inspector) can help verify which messages are actually crossing the connection. It should complement, not replace, server-side logs and traces.

## Use structured logs for operations

A production MCP server should emit one structured event per meaningful lifecycle transition rather than relying on interpolated text. JSON is a practical format because most log collectors can parse it without custom rules.

A tool-call completion event might contain:

```json
{
  "timestamp": "2026-10-18T12:34:56.789Z",
  "severity": "INFO",
  "service": "inventory-mcp",
  "environment": "production",
  "transport": "streamable_http",
  "session_id": "sess_7f2c",
  "jsonrpc_request_id": "42",
  "tool": "lookup_inventory",
  "duration_ms": 238,
  "outcome": "success",
  "downstream": "inventory-api",
  "schema_version": "2026-01-15"
}
```

Use stable field names across tools. At minimum, capture:

- `timestamp` in UTC with sufficient precision
- service, environment, deployment, and instance identifiers
- transport and connection or session identifier
- JSON-RPC request ID when one is available
- method and tool name
- start time, end time, and duration
- outcome such as `success`, `validation_error`, `tool_error`, `timeout`, or `internal_error`
- downstream service and retry count
- authenticated principal or tenant identifier in a privacy-safe form

Avoid high-cardinality fields that make metrics expensive, such as complete user input or arbitrary URLs. They can be useful in sampled traces or short-retention debug logs, but should be governed by a redaction policy.

Use a consistent event taxonomy. For example, `mcp.session.opened`, `mcp.initialize.completed`, `mcp.tools.list.completed`, `mcp.tool.started`, `mcp.tool.completed`, `mcp.tool.failed`, and `mcp.auth.rejected` are easier to search than free-form messages. Keep the event name stable even when the human-readable message changes.

The difference between a protocol failure and a tool failure matters when choosing the `outcome` value. The [MCP server error-handling guide](/blog/mcp-server-error-handling-protocol-tool-errors) covers that distinction in detail; use it to keep JSON-RPC errors, tool execution errors, and transport failures separate in your telemetry.

## Trace tool calls end to end

A tool call usually crosses several boundaries: the MCP transport, request dispatcher, tool validation, business logic, downstream API, database, and response serializer. Instrument each boundary so a slow or failed request can be explained from one trace rather than inferred from unrelated log lines.

At the transport boundary, create or continue a server-side span for the incoming MCP request. Attach attributes such as:

```text
rpc.system = jsonrpc
mcp.method = tools/call
mcp.tool.name = lookup_inventory
mcp.transport = streamable_http
mcp.session.id = sess_7f2c
mcp.request.id = 42
```

Attribute names are an application convention here, not a claim that every name is mandated by MCP. Use the naming conventions of your tracing system where they exist. The important property is consistent correlation.

Create child spans for validation, authorization, downstream calls, and material work. Record duration and status, but do not record raw tool arguments automatically. If an argument is needed for diagnosis, hash or classify it, apply field-level redaction, and enforce a retention policy.

On completion, record one terminal event containing the same correlation identifiers as the trace. On failure, classify the error before logging it:

```text
validation_error  input or schema rejected before execution
unauthorized      caller lacked permission
not_found         requested resource was absent
timeout           deadline exceeded
upstream_error    dependency returned or caused a failure
tool_error        tool completed with an expected execution error
internal_error    unexpected server defect
```

The [structured tool output guide](/blog/mcp-structured-tool-output) explains how `outputSchema` and `structuredContent` affect tool responses. Observability should record whether the response matched the declared shape without copying the complete result into logs. A useful event can include `output_valid=true`, item counts, byte size, and a result classification.

For long-running operations, use progress notifications where the client needs live status, and retain the complete operational record in your telemetry system. The guide to [MCP progress notifications and subscriptions](/blog/mcp-progress-notifications-subscriptions-guide) covers the protocol behavior; your tracing should still create one parent operation and child spans or milestones for the work performed.

## Monitoring remote MCP servers

To [monitor an MCP server](/best/monitoring), combine protocol, service, and infrastructure signals. A healthy process is not necessarily a healthy MCP endpoint: it might reject authentication, fail initialization, time out on one tool, or return an incompatible schema.

Track these metrics by server, environment, transport, and tool where appropriate:

- request rate for initialization, discovery, tool calls, and other supported methods
- success and failure rate, separated by error class
- tool-call latency at p50, p95, and p99
- timeout rate and downstream retry count
- active sessions and connection duration
- authentication failures and authorization denials
- protocol parse, validation, and capability-negotiation failures
- notification delivery or write failures
- response size and downstream dependency latency
- process restarts, memory pressure, CPU saturation, and event-loop lag

Do not aggregate every tool into one success percentage. A low-volume administrative tool may be failing while the aggregate remains normal. Use per-tool views for high-value operations and service-wide views for transport and platform health.

For remote Streamable HTTP deployments, monitor connection establishment, request termination, reconnects, and the behavior of any intermediary such as a reverse proxy or load balancer. Check idle timeouts, request body limits, response buffering, and authentication middleware. The [remote MCP deployment guide](/blog/deploying-remote-mcp-servers-production-guide) provides the broader production checklist; observability should verify those assumptions continuously.

## Alert conditions that deserve attention

Alerts should identify user impact or imminent loss of control, not merely produce a notification for every error. Good starting conditions include:

1. **Initialization failures:** page when a sustained proportion of new sessions cannot complete initialization or capability negotiation.
2. **Authentication spikes:** alert on a sudden increase in rejected credentials, especially when concentrated by source, tenant, or region.
3. **Tool error budget consumption:** alert when a critical tool exceeds its failure or timeout threshold over a rolling window.
4. **Latency degradation:** use separate thresholds for interactive tools and long-running jobs; a single latency target is rarely appropriate for both.
5. **Transport instability:** alert on repeated disconnects, failed writes, abnormal reconnect rates, or proxy-generated errors.
6. **Dependency failure:** alert when a downstream system causes correlated MCP tool failures or retries.
7. **Schema or capability drift:** alert when the deployed tool list, input schema, output schema, or server capability set changes outside an approved release.
8. **Resource exhaustion:** alert on process restarts, memory growth, thread or connection pool exhaustion, and event-loop delays.

Use a warning tier for early degradation and a paging tier for sustained customer impact. Include the affected tool, deployment, region, recent release, request volume, and a trace or log query in the alert payload. Avoid putting sensitive tool arguments into alert text.

A remote server also needs security telemetry. Record authorization decisions, policy matches, rate-limit events, and audit identifiers without logging credentials. The [remote MCP authentication guide](/blog/securing-remote-mcp-servers-authentication-guide) covers the security controls; connect those controls to alerts so repeated failures and policy bypass attempts are visible.

## A practical implementation sequence

Implement MCP server logging observability in this order:

1. **Protect the protocol stream.** Ensure stdio stdout contains only MCP traffic and route diagnostics to stderr or a logging library.
2. **Define the event schema.** Standardize request ID, session ID, tool, outcome, duration, deployment, and redaction fields before adding dashboards.
3. **Instrument the dispatcher.** Log every incoming method and terminal outcome, including requests that fail before reaching a tool handler.
4. **Instrument tools and dependencies.** Add spans and structured events around validation, authorization, downstream calls, retries, and serialization.
5. **Implement client-facing logging carefully.** Send selected records through `notifications/message`, honor the level configured through `logging/setLevel`, and keep sensitive data out of `data`.
6. **Build service dashboards.** Start with request volume, error rate, latency, active sessions, authentication failures, and dependency health.
7. **Create alerts from user impact.** Tune thresholds with real traffic and separate high-volume transient errors from sustained failures.
8. **Test the failure paths.** Verify malformed requests, tool errors, timeouts, disconnects, rejected authentication, notification handling, and redaction in a staging environment.

The [MCP testing and debugging guide](/blog/testing-and-debugging-mcp-servers) covers an end-to-end workflow for validating these cases. For protocol changes, also check the relevant [MCP protocol versioning guidance](/mcp-protocol-versioning) before changing capabilities, schemas, or logging behavior.

## Next steps

Start by defining one redacted structured event for every MCP request and one trace span for every tool execution. Validate protocol notifications with the [Protocol Inspector](/tools/protocol-inspector), compare operational platforms in [Best Monitoring & Observability MCP Servers](/best/monitoring), and review the production architecture guidance in [Architecting Production-Ready MCP Servers](/blog/architecting-production-mcp-servers).
