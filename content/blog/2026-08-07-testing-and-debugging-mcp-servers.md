---
title: "Testing and Debugging MCP Servers: From Inspector to CI"
excerpt: "A practical guide to testing Model Context Protocol servers before you ship — the Inspector, unit-testing tool handlers, integration harnesses, structured logging, and a pre-publish checklist."
tags: ["MCP", "Testing", "Debugging", "Developer Tools", "Tutorial"]
faq:
  - q: "How do I test an MCP server before publishing it?"
    a: "Run it through the official MCP Inspector for a manual smoke test, write unit tests against your tool handler functions directly (no protocol involved), then write at least one integration test that spins up a real client and calls tools/list and tools/call over the actual transport. Each layer catches different bugs — schema mismatches, business-logic errors, and transport/serialization issues respectively."
  - q: "Why does my MCP server crash or hang with no visible error?"
    a: "The most common cause on stdio transport is a tool handler writing to stdout with console.log, print(), or a stray library log. stdout is reserved exclusively for JSON-RPC protocol messages on stdio servers, so any stray text corrupts the stream and the client either hangs waiting for a valid frame or throws a parse error. Redirect all logging to stderr instead."
  - q: "What is the MCP Inspector?"
    a: "The MCP Inspector is the protocol maintainers' official debugging tool. Run it with npx @modelcontextprotocol/inspector against your server command, and it opens a browser UI that lists your tools, resources, and prompts, lets you invoke them with arbitrary arguments, and shows the raw JSON-RPC traffic in both directions."
  - q: "Should I test MCP tool handlers or the full protocol round-trip?"
    a: "Both, but not as one test. Unit-test the handler function in isolation for fast feedback on business logic, and keep a small integration suite that exercises the real client-server transport for the handful of tools where argument parsing, serialization, or transport-level behavior actually matters. Reserve the full round-trip for a golden set of prompts you re-run before every release, not every commit."
---

> **TL;DR:** A Model Context Protocol server that "connects fine" in a manual check can still fail in production — wrong tool descriptions confuse the model, a stray `console.log` corrupts a stdio stream, a schema accepts input it can't actually handle. This guide covers the testing pyramid for MCP servers: the Inspector for manual smoke tests, unit tests for handler logic, an integration harness for the real transport, structured logging that won't break stdio, and a checklist to run before every release.

Most MCP servers get exactly one round of testing: the author runs it, watches Claude Desktop or Cursor list the tools, calls one of them by hand, and ships. That catches the happy path and nothing else. It won't catch a tool description vague enough that the model picks the wrong tool, a Zod schema that silently coerces bad input instead of rejecting it, or a `console.log` buried in a dependency that corrupts your stdio stream under load.

This guide walks through testing MCP servers the way you'd test any other piece of infrastructure a model depends on — with layers, starting from fast and manual and moving to automated and protocol-accurate.

## The testing pyramid for MCP servers

```text
        ┌─────────────────────────────┐
        │   Golden-set eval prompts   │  ← run before release
        │  (does the MODEL pick the   │
        │   right tool, with good     │
        │   arguments, from a prompt) │
        └─────────────────────────────┘
      ┌───────────────────────────────────┐
      │   Integration tests (real client)  │  ← run in CI
      │  tools/list, tools/call over the   │
      │  actual transport (stdio/HTTP/SSE) │
      └───────────────────────────────────┘
   ┌─────────────────────────────────────────┐
   │        Unit tests (handler logic)         │  ← run on every save
   │   call the function directly, no protocol  │
   └─────────────────────────────────────────┘
```

Each layer catches a different class of bug. Skipping straight to manual testing in a client is like skipping straight to end-to-end browser tests for a REST API — technically possible, painfully slow to debug.

## Layer 0: The MCP Inspector

Before writing any test code, run your server through the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), the protocol maintainers' own debugging tool:

```bash
npx @modelcontextprotocol/inspector node dist/server.js
```

This launches your server as a child process and opens a browser UI that:

- Lists every tool, resource, and prompt your server advertises, with its raw JSON Schema
- Lets you invoke any tool with hand-typed arguments and see the exact response
- Shows the raw JSON-RPC messages flowing in both directions, which is the fastest way to spot a malformed response before a client ever sees it

Use the Inspector first every time you add or change a tool. It costs nothing to set up and it's the fastest way to catch a broken schema or an off-by-one in your response shape before you've written a single test.

## Layer 1: Unit test the handler, not the protocol

Your tool handler is a plain function. Test it as one — no client, no transport, no server instance:

```typescript
// weather.ts
export async function getForecast(args: { city: string; days: number }) {
  if (args.days < 1 || args.days > 10) {
    throw new Error("days must be between 1 and 10");
  }
  const data = await fetchWeatherApi(args.city, args.days);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}
```

```typescript
// weather.test.ts
import { describe, it, expect, vi } from "vitest";
import { getForecast } from "./weather";

describe("getForecast", () => {
  it("rejects an out-of-range day count", async () => {
    await expect(getForecast({ city: "Denver", days: 30 })).rejects.toThrow(
      "days must be between 1 and 10"
    );
  });

  it("returns MCP-shaped content on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tempF: 72 }),
    }));
    const result = await getForecast({ city: "Denver", days: 3 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ tempF: 72 });
  });
});
```

This is the layer that should hold the bulk of your test count. It runs in milliseconds, needs no child process, and pinpoints business-logic bugs precisely — exactly what you want on every save.

## Layer 2: Integration test the real transport

Unit tests never touch your `server.tool(...)` registration, your Zod schema, or the JSON-RPC serialization step — which means they'd miss a mismatched schema, a tool registered under the wrong name, or a response object that doesn't actually satisfy the SDK's expected shape. For that, spin up a real client against a real transport in your test suite:

```typescript
// server.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("weather MCP server (integration)", () => {
  let client: Client;

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["dist/server.js"],
    });
    client = new Client({ name: "test-harness", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("advertises the get_forecast tool with a valid schema", async () => {
    const { tools } = await client.listTools();
    const forecast = tools.find((t) => t.name === "get_forecast");
    expect(forecast).toBeDefined();
    expect(forecast?.inputSchema.properties).toHaveProperty("city");
  });

  it("rejects out-of-range arguments over the wire", async () => {
    const result = await client.callTool({
      name: "get_forecast",
      arguments: { city: "Denver", days: 30 },
    });
    expect(result.isError).toBe(true);
  });
});
```

Run this suite in CI on every pull request. It's slower than the unit layer (real process spawn, real serialization) but it's the only layer that would catch, for example, a tool whose Zod schema and TypeScript types have drifted apart.

## Layer 3: Golden-set evals for tool selection

Both layers above assume the model already decided to call the right tool with the right arguments. Neither one tests that assumption — and a vague tool description is one of the most common reasons a working server performs badly in practice. Keep a small, versioned set of realistic prompts and the tool call you expect them to trigger:

```json
[
  {
    "prompt": "What's the weather like in Denver this weekend?",
    "expectedTool": "get_forecast",
    "expectedArgsContain": { "city": "Denver" }
  },
  {
    "prompt": "Convert 72 fahrenheit to celsius",
    "expectedTool": "convert_temperature",
    "expectedArgsContain": { "unit": "celsius" }
  }
]
```

Run this set against a real model before every release — not on every commit, it's slower and costs tokens — and check whether the model picked the tool you expected. When it doesn't, the fix is almost always a clearer tool `description` or tighter parameter naming, not a code change. This is the layer that catches the failure mode unit and integration tests structurally cannot: the model *could* call your tool correctly, but chose not to, or chose the wrong one.

## Structured logging that won't corrupt your transport

The single most common "my server just hangs" bug on stdio transport has nothing to do with your tool logic:

```typescript
// Breaks a stdio MCP server — do not do this
console.log("Fetching forecast for", args.city);
```

On stdio transport, **stdout is the JSON-RPC wire** — every byte written to it is expected to be a protocol frame. A stray `console.log`, a debug `print()`, or a dependency that logs to stdout by default injects plain text into that stream, and the client either throws a parse error or hangs waiting for a well-formed message that never comes. This is invisible in the Inspector's UI half the time, because the Inspector's own transport layer is more forgiving than a production client.

The fix is to log to stderr only, ideally as structured JSON so it's greppable:

```typescript
function log(level: "info" | "warn" | "error", msg: string, meta?: Record<string, unknown>) {
  process.stderr.write(JSON.stringify({ level, msg, ...meta, ts: new Date().toISOString() }) + "\n");
}

log("info", "tool_call", { tool: "get_forecast", city: args.city });
```

If you're deploying over remote HTTP/SSE instead of stdio, this specific failure mode goes away — logging to stdout is fine there, since the protocol travels over HTTP, not the process's standard streams. See our guide on [deploying remote MCP servers](/blog/deploying-remote-mcp-servers-production-guide) if you're weighing stdio against a hosted transport.

## Common failure modes and how to catch them

| Symptom | Likely cause | Which layer catches it |
| --- | --- | --- |
| Client hangs on connect, no error | Stray `console.log`/`print` on stdout (stdio transport) | Manual — Inspector often masks this; test with a real client |
| Model calls the wrong tool | Vague or overlapping tool `description` fields | Layer 3 (golden-set evals) |
| Tool "works" in Inspector, fails in production client | Response shape doesn't match SDK expectations exactly | Layer 2 (integration test) |
| Valid-looking input crashes the handler | Zod schema is looser than the handler's actual assumptions | Layer 1 (unit test) |
| Works locally, fails after deploy | Missing env var / secret not propagated to the runtime | Deployment smoke test, not a test-suite concern |
| Intermittent timeouts under load | Handler makes a blocking synchronous call or unbounded fetch | Load/integration test with realistic concurrency |

## Pre-publish checklist

Run through this before submitting a server to a directory or tagging a release:

- [ ] Every tool has a `description` specific enough that a model choosing between it and a similarly named tool would pick correctly
- [ ] Every input schema rejects out-of-range and malformed input rather than silently coercing it
- [ ] No `console.log`/`print`/default-logging dependency writes to stdout on a stdio server
- [ ] At least one integration test exercises `tools/list` and `tools/call` over the real transport
- [ ] Error responses set `isError: true` rather than throwing an unhandled exception that kills the process
- [ ] A golden-set eval has been run against the current tool descriptions, not an earlier version of them
- [ ] The server has been run through the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) after the most recent schema change

## Next steps

Testing closes the loop that starts with building and ends with running in production:

- Just building your first server? Start with [How to Build an MCP Server](/build-mcp-server).
- Ready to move past `stdio` and host it for a team or agent fleet? See [Deploying Remote MCP Servers](/blog/deploying-remote-mcp-servers-production-guide).
- Locking down a remote deployment? Read [Securing & Authenticating Remote MCP Servers](/blog/securing-remote-mcp-servers-authentication-guide).
- Connection issues that look like test failures but aren't? Check the [MCP Server Not Connecting troubleshooting guide](/blog/mcp-server-not-connecting-troubleshooting-guide).
- Once it's tested and stable, [submit your MCP server to AllMCPs](/submit) so other developers can find it.
