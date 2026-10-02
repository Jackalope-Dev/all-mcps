---
title: "Wrap REST API as MCP Server: Task-Shaped Tool Design"
excerpt: "Learn how to wrap a REST API as an MCP server by selecting useful endpoints, designing task-shaped tools, forwarding auth, and handling pagination."
tags: ["MCP", "Guides", "Architecture", "Developer Tools", "Security"]
faq:
  - q: "Can an OpenAPI specification automatically become an MCP server?"
    a: "Yes, an OpenAPI specification can be used to generate an MCP server that exposes REST operations as MCP tools. Generated servers are useful for initial coverage, but they often create one tool per operation with low-level parameters. Review the generated tool list and add task-shaped tools, safer defaults, pagination handling, and authentication controls before using the server in production."
  - q: "Should every REST endpoint become an MCP tool?"
    a: "No, every REST endpoint should not automatically become an MCP tool. Expose operations that map to actions an agent can select reliably, combine dependent calls into task-shaped workflows, and omit internal, redundant, dangerous, or excessively low-level endpoints. Keep read-only discovery operations separate from tools that mutate data or trigger expensive side effects."
  - q: "How does an MCP server pass authentication to a REST API?"
    a: "An MCP server passes authentication by obtaining credentials through its configured server boundary and adding them to the outbound REST request. Depending on the deployment, that can mean a server-side API key, OAuth access token, delegated user token, or a validated request identity. Do not expose secrets as ordinary tool arguments or blindly forward untrusted headers."
  - q: "How should pagination work in an API-to-MCP wrapper?"
    a: "Pagination should be represented explicitly in the MCP tool input and output. Accept a bounded page size and an opaque continuation cursor, return the current items plus a next cursor, and avoid fetching an unbounded collection on the model's behalf. The wrapper should translate the upstream API's page token, offset, or link into a stable cursor contract."
---

## What it means to wrap a REST API as an MCP server

To wrap a REST API as an MCP server, build a protocol adapter that exposes selected API operations through MCP tools, validates model-supplied arguments, forwards requests to the REST service, and returns structured results. The fastest API-to-MCP implementation maps OpenAPI operations directly, but a production wrapper should go further: choose tools around user tasks, collapse multi-step CRUD workflows, preserve pagination, and enforce authentication at the server boundary.

MCP clients discover tools through the server and invoke them with a tool name and JSON arguments. Your wrapper translates that invocation into one or more HTTP requests such as `GET`, `POST`, `PATCH`, or `DELETE`, then converts the response into MCP tool content. The translation layer is where the important design decisions live.

If you are evaluating generated implementations, the [best OpenAPI MCP servers](/best/openapi) page lists projects that convert OpenAPI or Swagger descriptions into MCP-compatible tools. Generation is a useful starting point, not a substitute for deciding what an agent should be allowed to do.

## Choose tools instead of copying the endpoint catalog

A REST API is usually organized for human developers and resource ownership. An MCP tool catalog is organized for model selection. Those goals overlap, but they are not identical.

Start by classifying endpoints into four groups:

1. **Useful reads:** Search, retrieve, list, and summarize operations that answer common questions.
2. **Task operations:** A sequence of API calls that users normally regard as one action, such as creating a project and adding its initial members.
3. **Administrative operations:** Configuration, permissions, billing, deletion, and other high-impact actions that may need explicit confirmation or should not be exposed.
4. **Implementation details:** Health checks, internal lookup endpoints, redundant aliases, webhooks, and endpoints that require server-managed state.

Expose the first group selectively and design the second group as task-shaped tools. Treat the third group as a security and product decision rather than automatically publishing it. Usually omit the fourth group.

A practical selection test is:

- Can the tool name describe the user's intent without HTTP terminology?
- Can the model supply the required arguments from the tool description?
- Is the result useful without exposing several raw response objects?
- Does the operation have a clear authorization boundary?
- Can you place a reasonable limit on time, result size, and side effects?

For example, an API may provide these endpoints:

```text
GET    /projects
GET    /projects/{projectId}
POST   /projects
PATCH  /projects/{projectId}
DELETE /projects/{projectId}
GET    /projects/{projectId}/members
POST   /projects/{projectId}/members
DELETE /projects/{projectId}/members/{userId}
```

A literal conversion creates eight tools. A task-oriented design might expose:

```text
search_projects
get_project
create_project
set_project_members
delete_project
```

Because the listed API exposes `DELETE /projects/{projectId}`, the MCP tool is named `delete_project`, not `archive_project`. Do not describe this operation as archiving unless the upstream API explicitly documents `DELETE` as a reversible soft delete. The tool description should state that it permanently deletes the project if that is the upstream behavior, and the wrapper should apply any required confirmation or authorization policy.

`set_project_members` can read the existing membership, calculate a safe diff, and issue the required add and remove requests. That gives the model one understandable operation while keeping reconciliation logic in tested application code. If the upstream API has no atomic transaction, document partial-failure behavior and return completed and failed changes separately.

## Collapse CRUD into task-shaped tools

CRUD endpoints are often a poor interface for an agent because the model must infer sequencing, resource identifiers, defaults, and failure recovery. A task-shaped tool should represent the outcome the user requested rather than the HTTP calls required to achieve it.

Suppose a support system exposes separate calls to create a ticket, attach a customer, add a label, and post an initial comment. Instead of exposing all four low-level operations, consider:

```json
{
  "name": "open_support_case",
  "description": "Create a support case for a customer with an optional label and initial message.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "customerId": { "type": "string" },
      "subject": { "type": "string" },
      "message": { "type": "string" },
      "label": { "type": "string" }
    },
    "required": ["customerId", "subject", "message"],
    "additionalProperties": false
  }
}
```

The implementation can make the sequence deterministic:

1. Validate the customer and normalize the subject.
2. Create the case.
3. Add the optional label.
4. Post the initial message.
5. Return the case identifier, status, and any incomplete steps.

Do not hide meaningful side effects. The description should say that the tool creates a case and posts a message. For destructive or externally visible actions, use names and descriptions that make the consequence clear. You can also split preview and execution into separate tools, such as `preview_member_changes` and `apply_member_changes`.

Keep tools narrow enough that authorization and error handling are understandable. A single `call_any_endpoint` tool is technically flexible but gives the model an unbounded HTTP client. It weakens input validation, auditing, approval flows, and the ability to explain what an invocation will do.

The [production MCP server architecture guide](/blog/architecting-production-mcp-servers) covers broader server boundaries, security controls, and deployment patterns. This article focuses on the REST-to-tool design within that boundary.

## Define a stable MCP tool contract

Each exposed tool needs a stable name, a useful description, and an input schema. Use JSON Schema features supported by your target MCP clients and SDK version; support for newer schema keywords can vary. Prefer explicit properties, required fields, enumerations for closed sets, and `additionalProperties: false` where compatible.

Keep upstream naming out of the public contract when it harms clarity. A REST API might use `per_page`, while your tool can use `pageSize` and translate it internally. Likewise, expose a domain-level `projectId` rather than asking the model to construct `/projects/{id}`.

Return results that are easy to inspect. A list tool commonly benefits from a stable envelope:

```json
{
  "items": [
    { "id": "p_123", "name": "Migration", "status": "active" }
  ],
  "nextCursor": "eyJvZmZzZXQiOjEwfQ==",
  "hasMore": true
}
```

If your SDK supports structured tool output, return a machine-readable object and include concise human-readable content when appropriate. Client behavior around structured output and content rendering varies by SDK and version, so test with the clients you intend to support rather than assuming every client displays every field identically.

Avoid returning entire upstream payloads by default. Strip transport metadata, redact sensitive fields, and select fields relevant to the tool's purpose. Provide a detail tool for large records instead of making every search response expensive.

## Implement pagination deliberately

Pagination is one of the most common failure points in an API-to-MCP wrapper. A model may ask for all records, but the upstream API may contain thousands of items, impose rate limits, or require a cursor that must be used unchanged.

Use a bounded input contract:

```json
{
  "query": "failed deployments",
  "pageSize": 20,
  "cursor": null
}
```

Then apply these rules:

- Clamp `pageSize` to a server-defined maximum, such as 50 or 100.
- Treat cursors as opaque values; do not ask the model to decode or edit them.
- Translate upstream `next`, `offset`, or `page_token` values into your cursor format.
- Return no cursor when there is no next page.
- Set request and total-work limits for tools that aggregate multiple pages.
- Preserve filters and sort order when a cursor is reused.

An encoded cursor can contain the upstream token, filter hash, sort order, and an expiration time. Sign or encrypt it if exposing those values would reveal internal details or permit tampering. The MCP client should only pass the cursor back to the same tool.

For a task tool that needs several pages, fetch only the amount necessary to complete the task. For example, `find_available_assignee` may stop after finding a valid candidate rather than loading every user. If a user explicitly needs a complete export, that is often better handled by an asynchronous job and a resource or download reference than by one long synchronous tool call.

The [MCP progress and subscriptions guide](/blog/mcp-progress-notifications-subscriptions-guide) covers progress patterns for long-running work. Use progress notifications where the client and SDK support them, but do not treat progress as a replacement for a durable job-status model.

## Forward authentication without leaking credentials

Authentication belongs at the wrapper's trust boundary. Common deployments include a local stdio server using a configured secret, a remote Streamable HTTP server using an authenticated user session, and a gateway that exchanges an incoming identity for a scoped upstream token. The right model depends on whether the API call represents the operator, the end user, or the server itself.

For each outbound request, decide explicitly:

- Which credential is used?
- Is it server-wide or user-specific?
- What scopes or permissions are required?
- Can the tool access data across tenants?
- How are tokens refreshed and revoked?
- Which headers, query parameters, or response fields must be redacted?

Never make an API key an ordinary tool argument. Do not blindly copy all inbound HTTP headers to the REST API. Validate authorization before selecting the tenant or resource, and prevent a model-provided identifier from overriding that authorization context.

A simplified request adapter might look like this:

```ts
async function apiRequest(path: string, init: RequestInit, auth: AuthContext) {
  const token = await tokenProvider.getToken(auth); // server- or user-scoped
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) {
    throw translateUpstreamError(response.status, await response.text());
  }
  return response.json();
}
```

This is illustrative rather than a drop-in implementation: token acquisition, timeout support, error handling, and request-context APIs differ between MCP SDKs. For a fuller security treatment, see [Securing remote MCP servers](/blog/securing-remote-mcp-servers-authentication-guide).

## Map errors and retries safely

An upstream HTTP status should become an actionable tool error, not an opaque stack trace. Preserve a safe category and message, such as `not_found`, `permission_denied`, `rate_limited`, `validation_error`, or `upstream_unavailable`. Include a request or correlation ID for operators, but do not expose access tokens, cookies, or sensitive upstream bodies.

Retry only operations that are safe to retry. GET requests are often retryable, subject to rate limits. A POST that creates a resource may duplicate work unless the API supports an idempotency key. For mutations, generate and persist an idempotency key where the upstream API supports it, or design the task workflow to check whether the previous step already succeeded.

Set limits at several layers: input length, response size, HTTP timeout, number of upstream calls, and total task duration. These controls matter more than merely catching exceptions because an agent can repeatedly invoke a valid tool.

## Pick a transport and deployment model

For a local wrapper, stdio is commonly the simplest deployment: the MCP client starts the process and communicates over standard input and output. For a shared or hosted wrapper, Streamable HTTP is the relevant modern transport pattern, with authentication and request isolation handled by the service. Transport support and configuration details vary across clients.

Read [MCP transports explained](/mcp-transports) before choosing between local stdio and remote Streamable HTTP. If you are maintaining an older HTTP plus SSE implementation, [this migration guide](/blog/migrating-mcp-servers-http-sse-to-streamable-http) covers the transport transition.

Keep the REST adapter independent from the MCP transport. A useful internal structure is:

```text
MCP transport
  -> tool registry and argument validation
    -> task service
      -> REST client
        -> authentication, retries, limits, observability
```

This separation lets you test tool behavior without starting an MCP process and lets you replace a local transport with a remote one without rewriting API logic.

## Generate first, then review the boundary

OpenAPI-based generators can save setup time when an API has a maintained specification. Directory projects such as [bbonnin/openapi-to-mcp](/mcp/bbonnin-openapi-to-mcp), [mcp-swagger-server](/mcp/zaizaizhao-mcp-swagger-server), [mcp-link](/mcp/automation-ai-labs-mcp-link), and [APIFold](/mcp/work90210-apifold) take different approaches to turning API descriptions into MCP servers. Check each project's current transport, authentication, schema, and maintenance behavior before adopting it.

Use generation as an inventory and scaffolding step:

1. Generate or inspect the initial tools from the OpenAPI document.
2. Remove internal and high-risk operations.
3. Rename tools around user intent where necessary.
4. Combine multi-call workflows into task tools.
5. Add bounded pagination and response shaping.
6. Add authorization checks and redaction.
7. Test malformed arguments, expired credentials, rate limits, partial failures, and repeated mutations.
8. Verify discovery and invocation with the actual MCP clients you support.

Do not assume that an OpenAPI operation's description is sufficient for model use. OpenAPI documents often describe HTTP mechanics, while an MCP tool description must explain when to use the operation, what it changes, and what the result means.

## Test the wrapper as a protocol adapter

Test at three levels. Unit tests should cover endpoint translation, schema validation, cursor handling, authorization decisions, redaction, and error mapping. Contract tests should run against a mock or staging REST API and verify request methods, paths, headers, bodies, and idempotency behavior. MCP integration tests should verify tool discovery, tool calls, structured results, and error behavior through the target SDK or client.

Include adversarial cases:

- A tool argument attempts path traversal or injection.
- A user supplies an identifier from another tenant.
- The upstream API returns a huge page or malformed JSON.
- A mutation times out after the server accepted it.
- The same cursor is reused with different filters.
- The API returns a 429 response during a multi-step task.
- A generated schema accepts unknown properties that the implementation ignores.

Record tool name, authenticated principal, upstream operation, latency, status category, and correlation ID in audit logs. Avoid logging raw arguments or response bodies by default because they may contain personal or confidential data.

MCP evolves, and client support is not uniform across protocol revisions. Pin and test the MCP SDK version used by the wrapper, then review [MCP protocol versioning](/mcp-protocol-versioning) when upgrading.

## Next steps

Start with a small, read-only slice of the REST API and implement one task-shaped mutation only after authorization and error handling are tested. Compare generated approaches in the [OpenAPI MCP server directory](/best/openapi), choose a deployment model using the [MCP transports guide](/mcp-transports), and apply the authentication guidance in [Securing remote MCP servers](/blog/securing-remote-mcp-servers-authentication-guide).
