---
title: "MCP Structured Tool Output: outputSchema and structuredContent"
excerpt: "Learn when MCP tools should return plain text or structuredContent with an outputSchema, how protocol versions affect support, and how clients render each."
tags: ["MCP", "Developer Tools", "Guides", "Architecture"]
faq:
  - q: "Is outputSchema required for every MCP tool?"
    a: "No, outputSchema is optional. Add it when a tool has a stable, machine-readable result contract that clients or downstream logic can use. A tool that returns conversational prose, logs, or an intentionally flexible response can use text content without declaring an output schema."
  - q: "Which MCP version added structuredContent?"
    a: "The MCP specification revision dated 2025-06-18 defines outputSchema and structuredContent for tool results. Actual availability depends on the protocol version negotiated by the client and server and on SDK support. Older clients or SDKs may not advertise, validate, preserve, or present these fields as structured data."
  - q: "Can an MCP tool return both text and structuredContent?"
    a: "Yes, and this is often the most compatible design. Return structuredContent for protocol-aware consumers while also placing a concise human-readable representation in the content array. The two representations should describe the same result and must not contradict each other."
  - q: "Does an MCP client automatically render structuredContent as a table?"
    a: "No. MCP defines the result fields and their relationship to outputSchema, but the host or client decides how to present them. A client may show JSON, create a table or card, pass the object to an application layer, or expose only a text representation in its user interface."
  - q: "What is the difference between inputSchema and outputSchema in MCP?"
    a: "inputSchema describes the arguments a client or model may send to a tool, while outputSchema describes the structured result the server returns. They apply to opposite directions of the tool call. Both are JSON Schema objects, but neither one by itself guarantees a custom user interface."
---

MCP structured tool output lets a server return machine-readable data through `structuredContent`, documented by an optional `outputSchema`. Use plain text when the result is primarily prose; use structured output when clients or downstream code need stable fields and predictable types. For the MCP specification revision dated 2025-06-18 and later negotiated versions that support these fields, a server that declares `outputSchema` must return `structuredContent` conforming to it. Returning both structured data and readable text is often the safest design because clients differ in how they present tool results.

## The two output paths in MCP

An MCP tool is described through `tools/list`. Its definition can include an `inputSchema` for arguments and, in protocol versions that support structured tool results, an optional `outputSchema` for successful or otherwise contract-defined results. A `tools/call` response can contain a `content` array, an optional `structuredContent` object, and an optional `isError` flag.

A minimal plain-text result looks like this:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 3 open issues assigned to Ada Lovelace."
    }
  ],
  "isError": false
}
```

A structured result can look like this:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 3 open issues assigned to Ada Lovelace."
    }
  ],
  "structuredContent": {
    "count": 3,
    "assignee": "Ada Lovelace",
    "issues": [
      {
        "id": "ISSUE-104",
        "title": "Add export support",
        "status": "open"
      },
      {
        "id": "ISSUE-108",
        "title": "Update API examples",
        "status": "open"
      },
      {
        "id": "ISSUE-112",
        "title": "Review authentication flow",
        "status": "open"
      }
    ]
  },
  "isError": false
}
```

The `content` field is an array of MCP content blocks. Text is the most portable representation, but tool results may use other supported content block types where appropriate. `structuredContent` is an object for structured data; it does not replace the complete tool-result envelope.

## Protocol version and SDK compatibility

The protocol revision boundary matters. The MCP specification dated 2025-06-18 introduced `outputSchema` on tool definitions and `structuredContent` on tool results. A server and client negotiate a protocol version during initialization, so a server must not assume that every connected client supports fields defined by that revision or later revisions.

For a connection using a protocol version before the revision that defines these fields, use the older result features supported by that version, normally `content` blocks and `isError` where applicable. Do not advertise an `outputSchema` to an older client merely because the server SDK can construct one. The exact behavior also depends on SDK releases: an SDK may expose the fields only after adding support for the relevant specification revision.

A practical compatibility check includes three separate questions:

1. Which protocol version did initialization negotiate?
2. Does the server SDK expose `outputSchema` and `structuredContent` for that version?
3. Does the target client or host preserve and present structured results, rather than only showing text?

The protocol requirement and SDK validation are related but different. For a negotiated version that defines `outputSchema`, the server must return `structuredContent` conforming to the declared schema whenever that output schema applies. An SDK may validate the result before sending it, but SDK-side validation is an implementation aid; it does not replace the server's protocol obligation. A server should also avoid declaring a schema when it cannot reliably produce a conforming result.

For background on how MCP tools fit into the larger protocol, see [what MCP is](/what-is-mcp). The details here focus specifically on tool-result design and compatibility rather than discovery or transport.

## When plain text is the right output

Plain text is usually the better choice when the output is intended to be read as an explanation rather than processed as data. Examples include:

- A tool that summarizes a document in several paragraphs.
- A diagnostic tool that returns a short explanation of a failure.
- A command whose output is intentionally similar to a terminal response.
- A result whose fields are unstable because the upstream service has no reliable contract.
- A conversational operation where forcing every sentence into fields would lose useful meaning.

For example, a `summarize_release` tool might return:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Version 4.2 adds bulk imports, changes the default timeout to 30 seconds, and deprecates the legacy token endpoint. No breaking database migration is required."
    }
  ]
}
```

Adding an output schema to this response would not necessarily improve it. A client still has to display or pass the prose somewhere, and forcing every sentence into fields such as `summary`, `migration_required`, and `deprecations` can create a misleadingly rigid contract.

Plain text is also a useful compatibility representation. A client that negotiated an older protocol version may not support structured tool results. A newer host may support the protocol field but choose to expose only the text representation in its model-facing context or user interface. A concise text result gives both categories something useful to display.

That does not mean plain text should contain arbitrary debugging output. Keep it bounded, remove secrets, identify important status clearly, and avoid making downstream consumers parse sentences with regular expressions. If another program needs reliable fields, plain text is usually the wrong interface for that program.

## When to use outputSchema and structuredContent

Use `outputSchema` and `structuredContent` when the result has a stable shape and the distinction between fields matters. Typical cases include:

- Search results with identifiers, titles, URLs, scores, and pagination data.
- Database or customer records with typed fields.
- Validation results containing a boolean outcome and a list of issues.
- Financial, operational, or monitoring data that must retain numeric values.
- File conversion results with output paths, MIME types, sizes, and warnings.
- Actions that return an operation ID, status, and follow-up metadata.

A schema gives consumers an explicit contract. Consider a tool that checks whether a deployment is ready:

```json
{
  "name": "check_deployment",
  "description": "Check whether a deployment is ready to receive traffic.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "deploymentId": {
        "type": "string"
      }
    },
    "required": ["deploymentId"],
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "deploymentId": {
        "type": "string"
      },
      "ready": {
        "type": "boolean"
      },
      "replicasReady": {
        "type": "integer",
        "minimum": 0
      },
      "replicasDesired": {
        "type": "integer",
        "minimum": 0
      },
      "reasons": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "deploymentId",
      "ready",
      "replicasReady",
      "replicasDesired",
      "reasons"
    ],
    "additionalProperties": false
  }
}
```

For a negotiated protocol version that supports this definition, the successful result must include `structuredContent` conforming to the declared schema:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Deployment dep-42 is not ready: 2 of 3 replicas are ready."
    }
  ],
  "structuredContent": {
    "deploymentId": "dep-42",
    "ready": false,
    "replicasReady": 2,
    "replicasDesired": 3,
    "reasons": [
      "Replica dep-42-7 is failing its readiness probe"
    ]
  }
}
```

The boolean must remain a boolean in `structuredContent`; do not encode it as the string `"false"`. Counts should remain numbers, identifiers should remain strings, and absent values should follow the schema's policy rather than being represented inconsistently as `null`, an empty string, or an omitted property.

## Why return both representations

The most interoperable pattern is:

1. Declare an `outputSchema` when the result contract is stable and the negotiated protocol version supports it.
2. Return an object in `structuredContent` that conforms to the schema.
3. Include concise text in `content` for older integrations, text-oriented hosts, and human-readable tool-result views.

The text should be a presentation of the result, not a second source of truth. It can omit repetitive fields, but it should include the outcome and the most important identifiers or next action. Avoid dumping a second, independently generated JSON document into text unless a specific legacy consumer requires it.

This dual representation has costs. It increases response size and creates a consistency obligation. If the structured result says `ready: false` while the text says “ready to receive traffic,” users and models can receive conflicting instructions. Generate both forms from the same internal result object where possible.

A practical server-side pattern is:

```ts
type DeploymentCheck = {
  deploymentId: string;
  ready: boolean;
  replicasReady: number;
  replicasDesired: number;
  reasons: string[];
};

function toText(result: DeploymentCheck): string {
  if (result.ready) {
    return `Deployment ${result.deploymentId} is ready: ${result.replicasReady}/${result.replicasDesired} replicas are ready.`;
  }

  return `Deployment ${result.deploymentId} is not ready: ${result.replicasReady}/${result.replicasDesired} replicas are ready. ${result.reasons.join("; ")}`;
}

function toToolResult(result: DeploymentCheck) {
  return {
    content: [{ type: "text", text: toText(result) }],
    structuredContent: result,
    isError: false
  };
}
```

The exact handler types and registration APIs vary between MCP SDKs. The protocol-level fields are the important part: `content`, `structuredContent`, `isError`, and the tool's optional `outputSchema`.

## How clients handle each form

There is no single universal MCP user interface. A client or host decides how to expose a tool result, and behavior varies by client and version.

For a negotiated protocol version that supports structured results, a protocol-aware client can receive `structuredContent` as part of the tool result and use it as structured data. It may validate the object against `outputSchema`, pass the object to an application layer, or use fields to build a richer interface. MCP does not require every host to render a table, card, badge, or form.

A host may also choose not to expose structured data directly in its user interface or model-facing presentation. For example, it may serialize the result into a text tool message, show a simplified summary, or keep the object available only to an application layer. That is a presentation choice, not evidence that the protocol field was absent or invalid.

Older clients and SDKs require separate caution. If they negotiate a protocol version that predates structured tool results, they cannot be expected to understand `outputSchema` or `structuredContent` as defined by the newer revision. A client implementation might ignore unknown JSON members, reject an unsupported response, or expose only the known `content` field; servers should not rely on a particular fallback unless they have tested that client.

For this reason, include useful text in `content` when compatibility matters. The fallback does not change the protocol requirement for a supported negotiated version: when `outputSchema` is declared there, the server still has to provide conforming `structuredContent`. Text is an additional representation, not a substitute for the required structured field.

## Error results and partial results

The `isError` flag indicates that a tool call produced an error result, but it does not automatically exempt that result from an applicable `outputSchema`. If a tool declares an output schema, the `structuredContent` returned by the tool must conform to that schema, including when the server represents an error through the tool result.

There are two sound designs. First, define a result schema that represents both outcomes. A discriminated union can require a `status` field and then describe separate success and error properties:

```json
{
  "outputSchema": {
    "oneOf": [
      {
        "type": "object",
        "properties": {
          "status": { "const": "ok" },
          "deploymentId": { "type": "string" },
          "ready": { "type": "boolean" }
        },
        "required": ["status", "deploymentId", "ready"],
        "additionalProperties": false
      },
      {
        "type": "object",
        "properties": {
          "status": { "const": "error" },
          "code": { "type": "string" },
          "message": { "type": "string" }
        },
        "required": ["status", "code", "message"],
        "additionalProperties": false
      }
    ]
  }
}
```

An error result can then include matching structured data:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Could not read deployment dep-42: access denied."
    }
  ],
  "structuredContent": {
    "status": "error",
    "code": "ACCESS_DENIED",
    "message": "Could not read deployment dep-42."
  },
  "isError": true
}
```

Second, do not declare an `outputSchema` if the tool intentionally returns errors whose shape falls outside the declared contract. In that design, use the supported `content` and `isError` fields for those results rather than advertising a schema that the server cannot satisfy. Do not declare a success-only schema and assume that setting `isError: true` makes arbitrary structured data valid.

For long-running work, a tool might return an operation identifier and status rather than pretending that an incomplete result is final. MCP also has mechanisms for progress and related long-running workflows; see the guide to [progress notifications and subscriptions](/blog/mcp-progress-notifications-subscriptions-guide) when a call needs live updates.

## Schema design practices

A useful `outputSchema` is deliberately explicit.

- Make required fields genuinely available on every response represented by the schema.
- Use `additionalProperties: false` when rejecting unknown fields helps catch server and client drift; leave room for extensions when forward compatibility matters.
- Keep field names stable and descriptive.
- Use arrays for collections instead of newline-delimited text inside one string.
- Preserve numeric, boolean, and null semantics intentionally.
- Document pagination, truncation, ordering, and timestamps in the schema description or tool description.
- Avoid exposing secrets, access tokens, internal stack traces, or unbounded upstream payloads.

Schema evolution needs the same care as any other API. Adding an optional field is generally less disruptive than renaming a required field or changing a string into an object. If a change is not backward compatible, consider a new tool or an explicit protocol/versioning strategy. The [MCP protocol versioning guide](/mcp-protocol-versioning) covers version negotiation and compatibility at the protocol level; your tool's data contract still needs its own change policy.

The tool description also matters. Explain what the result means, especially when a field is easy to misinterpret. A schema says that `score` is a number, but the description should say whether a higher score is better, what range is expected, and whether it is comparable across calls. See [how to write MCP tool descriptions](/blog/writing-mcp-tool-descriptions-that-work) for guidance on making tool contracts understandable to models.

## Testing structured output

Test the result at three levels.

1. Test the server's internal result builder with normal, empty, boundary, and failure cases.
2. Validate serialized `structuredContent` against the declared output schema.
3. Inspect the result in the clients your users actually run, including a text-only or older client if compatibility matters.

Useful cases include empty arrays, missing upstream fields, large result sets, Unicode text, timestamps, permission failures, and partial upstream failures. Confirm that `content` and `structuredContent` describe the same outcome. A schema validator can catch missing required properties, wrong primitive types, and invalid array items; it cannot tell you whether the result is semantically correct.

Use the MCP Inspector or your SDK's test harness for protocol-level checks, then add automated tests to CI. The [MCP testing and debugging guide](/blog/testing-and-debugging-mcp-servers) covers a broader workflow for inspecting tools, requests, and server behavior.

When testing compatibility, explicitly record the negotiated protocol version and SDK version. Test a server path that declares `outputSchema` against a client known to support the 2025-06-18 revision or later, then test the text fallback against older or text-oriented clients. This catches a different class of failure from schema validation: a correct structured response can still be invisible in a host that does not expose structured data in its presentation layer.

## Choosing a design for your tool

Use this decision process:

1. Ask whether a caller needs individual fields, typed values, filtering, or follow-up automation.
2. Check whether the negotiated protocol version and SDK path support `outputSchema` and `structuredContent`.
3. If no structured consumer exists, return concise text and avoid inventing a schema.
4. If the result is stable and machine-readable, define an output schema around that data contract.
5. For supported protocol versions, return `structuredContent` that conforms to the schema for every result covered by it, including defined errors.
6. Add readable `content` unless you control every client and know structured output is supported and presented.
7. Test validation, version negotiation, error shapes, and rendering with the clients in your deployment.

The choice is not simply “JSON versus text.” The strongest MCP tool often returns structured data for machines and a short explanation for people and text-oriented model contexts. The key is to respect the negotiated protocol version, meet the output-schema requirement when it applies, keep representations consistent, and avoid assuming that a valid structured result automatically produces a custom UI.

## Next steps

Review existing tools for results that downstream code currently has to parse from prose. Those are good candidates for `outputSchema` and `structuredContent`. Then test the revised responses across your chosen transports using the [MCP transports guide](/mcp-transports), and apply the production concerns in [architecting production-ready MCP servers](/blog/architecting-production-mcp-servers).
