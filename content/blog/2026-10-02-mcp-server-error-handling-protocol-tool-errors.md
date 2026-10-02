---
title: "MCP Server Error Handling: Protocol vs Tool Errors"
excerpt: "Learn MCP server error handling: distinguish JSON-RPC protocol failures from isError tool results, and return messages models can understand and recover from."
tags: ["MCP", "Guides", "Developer Tools", "Architecture"]
faq:
  - q: "What is the difference between an MCP protocol error and a tool error?"
    a: "A protocol error is a JSON-RPC failure that means the MCP request or message could not be processed correctly. A tool error is a successful tools/call response whose result has isError: true. Protocol errors usually indicate an integration, validation, or transport problem, while tool errors describe a failure in the operation the model asked the server to perform."
  - q: "What does isError mean in MCP?"
    a: "The MCP isError field tells the client that a tool result represents an unsuccessful tool execution. The result can still contain text or other content explaining the failure. Clients generally make that content available to the model, although the exact formatting and recovery behavior depend on the MCP host or client."
  - q: "Should an MCP tool throw an exception or return isError?"
    a: "Return isError: true for an expected operational failure such as a missing record, invalid business input, rate limit, or upstream API error that the model can act on. Use an exception or protocol-level error for malformed requests, unavailable methods, broken protocol state, or failures that prevent a valid tool result from being produced. SDK behavior varies, so test the actual client path."
  - q: "How should MCP tool error messages be written for models?"
    a: "Write a concise message that states what failed, identifies the relevant input or resource, explains whether retrying can help, and gives a concrete next action. Avoid stack traces, vague messages, and secrets. For example: Issue lookup failed: project ENG exists, but issue ENG-42 was not found. Verify the issue key or list recent issues first."
---

MCP server error handling has two important paths: JSON-RPC protocol errors and tool results marked with `isError: true`. A protocol error means the MCP message, request, or session operation failed at the protocol boundary; an MCP tool error means the tool call produced a valid result that reports an operational failure. Use protocol errors for invalid or unprocessable MCP requests, and use `isError` for expected tool failures whose explanation can help the model recover.

## The two error paths

MCP uses JSON-RPC messages for communication between a client and server. A successful request returns a `result`; a failed request returns an `error` object. Tool execution adds another layer: a `tools/call` request can succeed at the protocol level while its result says that the operation itself failed.

That produces two materially different shapes.

A protocol-level failure looks like this:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "field": "issueKey",
      "reason": "Expected a string"
    }
  }
}
```

A complete JSON-RPC response containing a tool-level failure looks like this:

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "result": {
    "isError": true,
    "content": [
      {
        "type": "text",
        "text": "Issue lookup failed: issue ENG-42 was not found. Verify the issue key or list recent issues first."
      }
    ]
  }
}
```

The second response is still a valid JSON-RPC response and a valid MCP tool result. `isError` is not a replacement for the JSON-RPC `error` object. It is a field on the result returned by a tool call.

The distinction matters because MCP clients and hosts can route the two cases differently. A tool result gives the client content associated with the tool invocation, which can normally be passed to the model as tool output. A protocol error may instead be handled by the client as a failed request, logged as an integration problem, or converted into a client-specific message. Do not assume every host exposes the raw JSON-RPC shape to the model.

For general transport, lifecycle, and connection troubleshooting, use this [MCP server connection troubleshooting guide](/blog/mcp-server-not-connecting-troubleshooting-guide). This article focuses on what to return after the server is connected and handling requests.

## When to return a protocol error

Use a protocol error when the server cannot treat the message as a valid request in the current protocol state. Common examples include:

1. The JSON is malformed or cannot be parsed.
2. The request is not a valid JSON-RPC request.
3. The method does not exist.
4. Required request parameters are missing or have the wrong protocol-level type.
5. The client calls a method that is unavailable in the current session state.
6. The server cannot produce a valid response for the requested MCP operation.

JSON-RPC defines standard error codes such as `-32700` for parse errors, `-32600` for invalid requests, `-32601` for method not found, `-32602` for invalid params, and `-32603` for internal errors. Implementations may also use implementation-defined server errors. Follow the protocol and SDK behavior supported by your target clients rather than inventing a new error envelope.

For example, if a client sends a `tools/call` request with an `arguments` value that is not an object, the server should reject the request according to its protocol and SDK rules. That is different from receiving a correctly shaped argument object containing an invalid issue key. The latter is usually a tool error because the tool can explain the business failure in its result.

A protocol error is also appropriate when the server cannot safely complete the requested operation because its session or capabilities are invalid. For example, a server should not pretend that an uninitialized session successfully executed a tool. The lifecycle rules are part of the MCP protocol contract; a client may treat violations as a session or connection failure.

Avoid using protocol errors for every exception thrown by application code. If an upstream API returns a 404, a database record is absent, or a user-provided filter matches nothing, the request may still have been valid and the model may be able to change its next action. Return a tool error in those cases.

## When to return isError

Set `isError` to `true` when the tool was selected and invoked correctly, but the requested operation did not succeed. Typical examples include:

- A requested file, ticket, customer, or deployment does not exist.
- An upstream service returns an expected 4xx or 5xx response.
- A query is valid but produces no usable result.
- A precondition is not met, such as a branch being protected.
- A rate limit or temporary dependency failure prevents completion.
- The tool rejects a business value that passed basic schema validation.
- A destructive operation requires confirmation or a missing prerequisite.

The tool result should contain useful content. In the simplest case, return one text content item and set `isError` to `true`:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Deployment blocked: production requires an approved change request. Create or provide the change request ID, then retry."
    }
  ],
  "isError": true
}
```

The exact SDK API differs by language and version, but the wire-level intent is the same: produce a normal tool result with an error indicator and model-readable content. Verify the serialized response with the [MCP Protocol Inspector and response debugger](/tools/protocol-inspector), rather than relying only on a server-side log.

A tool error does not mean that the server should hide the failure from the model. The model needs to know that the tool did not complete successfully. Omitting `isError`, returning an empty success result, or converting a known failure into a vague message makes recovery less reliable and can lead to repeated calls.

## What the model sees

The model generally sees tool output supplied by the host, not necessarily the raw wire response. In the `isError` case, the host can pass the content to the model with an indication that the tool failed. The model may then inspect the message, correct an argument, ask the user for missing information, choose another tool, or explain that the operation cannot proceed.

For example, this message gives the model a viable next step:

```text
Search failed: the repository argument was valid, but repository acme/widgets is not accessible with the current credentials. Ask the user to grant access or choose a repository the configured account can read. Do not retry unchanged.
```

This one does not:

```text
Error: request failed
```

The first message distinguishes argument validity from authorization, identifies the affected resource, and tells the model whether an unchanged retry is useful. The second supplies no reliable recovery information.

Protocol errors are different. Depending on the client, a JSON-RPC failure may be surfaced as an MCP request failure, a tool-call failure generated by the host, or only an error event and log entry. Some clients may retry or terminate the request; others may report the problem to the user. Because this presentation is client-dependent, write server logs and tests around the raw protocol response, but do not promise a particular model-facing rendering unless you have tested the target host.

This is one reason to test with more than a happy-path call. The [MCP server testing and debugging guide](/blog/testing-and-debugging-mcp-servers) covers inspection and CI-oriented validation; add assertions for both the JSON-RPC error path and the `isError` result path.

## Designing recoverable tool error messages

A useful MCP tool error answers four questions:

1. What operation failed?
2. Which input, resource, or dependency was involved?
3. Why did it fail, at a level the model can use?
4. What should happen next?

A practical template is:

```text
<operation> failed: <resource or input>. <actionable reason>. <next step>. <retry guidance>.
```

Example:

```text
Calendar event creation failed: the requested end time, 2026-10-04T09:00:00Z, is before the start time, 2026-10-04T10:00:00Z. Correct the time range and retry; no event was created.
```

The final clause is important for mutation tools. The model should know whether the operation may have partially succeeded. For an uncertain network timeout, do not claim that no mutation occurred unless the server can establish that fact:

```text
Payment status is unknown: the provider timed out after submitting the charge for order ORD-1042. Do not submit again yet. Check the order or provider status before retrying to avoid a duplicate charge.
```

Return specific validation failures when the model can correct the input:

```text
Report generation failed: `from` must be earlier than `to`; received from=2026-10-08 and to=2026-10-01. Reverse the dates or provide a different range. No report was generated.
```

For authorization failures, avoid exposing credentials, tokens, internal identity data, or detailed permission internals. Say what access is needed and what the user can do:

```text
Repository read failed: the configured GitHub account cannot access acme/private-api. Ask the account owner to grant read access or select another repository. Do not retry unchanged.
```

Use stable wording and error categories when possible. Current MCP protocol versions and SDKs can support additional structured tool output, but support is not uniform across older clients and implementations. `structuredContent` should be treated as an optional structured result associated with the tool output, not as a guaranteed replacement for `content` or as a field every model will see directly. If you use it, confirm that the target protocol version and SDK support it, define the tool's output schema where the SDK requires or supports one, and test how the host exposes the data to the model.

For broad client compatibility, include a clear text explanation in `content` even when returning structured data. A current implementation might serialize a result like this:

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "Issue update failed: ENG-42 is locked by another workflow. Retry after the workflow finishes; no fields were changed."
    }
  ],
  "structuredContent": {
    "category": "conflict",
    "retryable": true,
    "resource": "ENG-42"
  }
}
```

Do not assume that an older SDK can construct this response, that an older client will preserve the `structuredContent` member, or that the host will place every structured field in the model's context. Validate the wire response and the client-visible transcript for the versions you support. If your tool advertises an output schema, keep that schema aligned with the actual structured result; otherwise, consumers may reject, ignore, or misinterpret the data. The text content remains the safest place for recovery instructions.

## Error handling in tool implementations

Keep the boundary between expected failures and unexpected defects explicit. A useful pattern is:

```text
validate protocol shape
validate tool arguments
call application service
translate expected failures to an explicit isError tool result
log unexpected defects with a correlation ID
verify how the target SDK serializes unexpected exceptions
```

Do not assume that an uncaught exception becomes a JSON-RPC protocol error. Several MCP SDKs catch exceptions from tool handlers and serialize them as tool results with `isError: true`; other behavior can vary by SDK, adapter, and version. Explicitly catch and translate expected domain, dependency, authorization, and validation failures. For unexpected exceptions, document the target SDK's behavior, test the serialized response through the actual transport, and decide whether you need an SDK-specific wrapper to sanitize the result. The important distinction is the response on the wire, not the exception class inside your handler.

Argument schemas should reject obviously malformed input before business logic runs. Tool descriptions should explain important constraints so the model is less likely to make invalid calls in the first place. See [how to write MCP tool descriptions that get picked](/blog/writing-mcp-tool-descriptions-that-work) for the discovery and instruction side of that contract.

Do not place a stack trace in the model-facing message. Log the stack trace server-side with a correlation ID, then return a safe message:

```text
Export failed: the storage service returned an internal error. Retry once after a short delay. If it persists, report reference EXP-7f31b2; no download was returned.
```

The correlation ID should not contain secrets or raw user data. It lets an operator connect the model-visible failure to server logs without disclosing implementation details.

For retries, be explicit. “Retryable” depends on the operation: a read may be safe to repeat, while a mutation may require idempotency keys or a status check. Never instruct the model to retry an operation unchanged when duplicate side effects are possible. Production architecture decisions around authentication, transports, and tool boundaries are covered in [architecting production-ready MCP servers](/blog/architecting-production-mcp-servers).

## Testing both kinds of failure

A focused test matrix should include at least:

| Case | Expected response | Model recovery value |
|---|---|---|
| Malformed JSON | JSON-RPC parse error | Primarily an operator/client issue |
| Unknown method | JSON-RPC method error | Detects capability or version mismatch |
| Wrong argument shape | JSON-RPC or SDK validation error | Detects contract mismatch |
| Valid call, missing resource | Tool result with `isError: true` | Model can correct or search |
| Valid call, authorization failure | Tool result with `isError: true` | Model can request access or choose another resource |
| Timeout after mutation | Tool error with uncertain outcome | Prevents unsafe duplicate retry |
| Unexpected exception | SDK-specific serialized result plus server log | Protects secrets and verifies actual behavior |

Assert the serialized response, not just the exception class inside your handler. A test that passes because an exception was thrown may still fail to verify whether the SDK emitted a protocol error or a tool result with `isError`. For unexpected exceptions especially, pin the SDK version in the test environment and record the behavior you rely on; serialization can change between SDK versions.

Also test the response through the client you support. Hosts may format tool errors differently, truncate long content, or apply their own retry behavior. Hosts may also ignore structured output that an SDK successfully serialized. Test initialization, capability negotiation, tool discovery, and `tools/call` independently. Protocol version differences can affect available fields and behavior, so keep the server and client contract aligned with the relevant [MCP protocol versioning guidance](/mcp-protocol-versioning).

## Operational logging and observability

Model-facing errors and operator-facing diagnostics serve different purposes. The model needs a concise explanation and next action. Operators need timestamps, request or session correlation, tool name, dependency status, latency, retry count, and a sanitized exception. Record whether the failure was protocol-level or tool-level so dashboards do not combine integration defects with expected domain failures.

Metrics should separate categories such as invalid parameters, authorization failures, not-found results, rate limits, dependency timeouts, and unexpected server exceptions. A high count of `isError` results is not automatically a server bug: a search tool may legitimately report many empty or inaccessible results. Conversely, a low error count can hide failures if the server incorrectly returns successful empty content.

For directory teams evaluating operational tooling, the [monitoring MCP server directory](/best/monitoring) is a useful starting point. The same principle applies whether you inspect MCP traffic directly or export application-level telemetry: preserve the distinction between a request that violated the protocol and a valid tool invocation that could not complete.

## Practical decision rule

Use this rule at the handler boundary:

- If MCP or JSON-RPC cannot interpret, route, validate, or execute the request as a protocol operation, return a protocol error according to the target SDK and protocol version.
- If the request is valid and the selected tool can report an operational, domain, dependency, or authorization failure, return a normal tool result with `isError: true`.
- If an exception is unexpected, do not infer its wire representation from the fact that it was uncaught. Check and test the target SDK's serialization behavior.
- If the outcome of a mutation is unknown, say so explicitly and give safe status-check guidance.
- In every tool error, tell the model what failed, why it matters, whether retrying is safe, and what to do next.

That separation makes failures easier for clients to classify, easier for operators to diagnose, and more useful to models attempting recovery.

## Next steps

Inspect both response shapes with the [MCP Protocol Inspector](/tools/protocol-inspector), then add protocol-error, explicit `isError`, and unexpected-exception cases to your CI tests. Review tool descriptions alongside error messages, verify structured output against the protocol and SDK versions you support, and use the [production MCP server architecture guide](/blog/architecting-production-mcp-servers) when deciding how logging, retries, authentication, and side-effecting tools should interact.
