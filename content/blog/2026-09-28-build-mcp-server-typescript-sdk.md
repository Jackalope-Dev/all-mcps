---
title: "Build MCP Server TypeScript SDK: Tool, Resource, and Test"
excerpt: "Build an MCP server with the TypeScript SDK from zero: register a tool and resource, test both with an in-memory client, and compare stdio with HTTP."
tags: ["MCP", "Guides", "Developer Tools", "Architecture"]
faq:
  - q: "What package do I need to build an MCP server in TypeScript?"
    a: "Use the official `@modelcontextprotocol/sdk` package and its TypeScript server APIs. You will usually also need `zod` for tool input schemas, `typescript`, and a TypeScript runtime such as `tsx` for local development. SDK import paths and some transport details vary by SDK release, so verify them against the version installed in your project."
  - q: "Should a TypeScript MCP server use stdio or Streamable HTTP?"
    a: "Use stdio when a local MCP client launches your server as a child process. Use Streamable HTTP when a server must be reached over a network or shared by multiple clients. Stdio is simpler because the process boundary handles isolation; HTTP requires request handling, authentication, origin validation, deployment, and lifecycle decisions."
  - q: "How do I test an MCP tool without starting a real server process?"
    a: "Create the server with the TypeScript SDK, connect it to one side of an `InMemoryTransport` pair, and connect an MCP `Client` to the other side. The test can then call the tool and read the resource through the protocol, which verifies registration and serialized results without spawning a subprocess or opening a port."
  - q: "What does an MCP resource callback return?"
    a: "A resource callback returns a `contents` array containing the requested URI and either text or a blob, plus an optional MIME type. The callback receives a URL-like URI object. For a static resource, register one URI such as `demo://greeting`; for dynamic data, use a resource template and generate content from the requested URI."
---

The fastest way to build an MCP server with the TypeScript SDK is to create an `McpServer`, register a tool with a Zod input schema, register a resource with a URI and callback, then connect a transport. This tutorial builds that server from zero, tests it through an in-memory MCP client, and shows why the stdio and Streamable HTTP entrypoints should usually be separate. The same design applies to a local [MCP server](/build-mcp-server) that exposes files, APIs, databases, or developer tools.

## What you will build

The example server exposes:

- A tool named `add` that accepts two numbers and returns their sum.
- A static resource at `demo://greeting` containing text.
- A test that calls the tool and reads the resource through MCP rather than calling implementation functions directly.
- A stdio entrypoint for desktop and editor clients.
- An HTTP entrypoint outline for a remotely reachable server.

The code uses the official TypeScript SDK package, `@modelcontextprotocol/sdk`. SDK APIs can differ between major releases, so use the import paths and transport constructor documented for the version in your lockfile. The registration pattern below is the current common SDK shape for TypeScript servers.

## Create the TypeScript project

Create a project and install the runtime and development dependencies:

```bash
mkdir mcp-typescript-example
cd mcp-typescript-example
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install --save-dev typescript tsx @types/node
```

Add a `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

Set the project to use ESM and add scripts to `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/stdio.ts",
    "build": "tsc",
    "start": "node dist/stdio.js",
    "test": "tsx --test test/server.test.ts"
  }
}
```

Using `tsx` is convenient during development. The production process can run compiled JavaScript from `dist`, which avoids requiring a TypeScript runtime on the target machine.

## Define the MCP server

Create `src/server.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createServer() {
  const server = new McpServer({
    name: "typescript-example",
    version: "1.0.0"
  });

  server.registerTool(
    "add",
    {
      title: "Add numbers",
      description: "Return the sum of two numbers.",
      inputSchema: {
        a: z.number().describe("First number"),
        b: z.number().describe("Second number")
      }
    },
    async ({ a, b }) => {
      const sum = a + b;

      return {
        content: [
          {
            type: "text",
            text: String(sum)
          }
        ],
        structuredContent: { sum }
      };
    }
  );

  server.registerResource(
    "greeting",
    "demo://greeting",
    {
      title: "Greeting",
      description: "A small static greeting resource.",
      mimeType: "text/plain"
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: "Hello from the TypeScript MCP server."
        }
      ]
    })
  );

  return server;
}
```

The `McpServer` is the high-level server object. Its constructor metadata is advertised during initialization; it is not the network listener and it does not choose stdio or HTTP by itself.

`registerTool` takes a name, metadata, and an asynchronous handler. The `inputSchema` object uses Zod values. The SDK uses that schema to describe the tool input to the client and validate arguments before the handler runs. The handler receives an object whose properties match the schema.

The returned `content` array is the normal MCP tool result content. A text item is easy for clients to display and is a useful fallback for clients that do not use structured results. `structuredContent` contains machine-readable JSON. If your server relies on structured output validation, use the output-schema options supported by your installed SDK version and test that contract explicitly.

`registerResource` associates a resource name and URI with metadata and a read callback. The callback returns `contents`, not a bare string. Each content item identifies its URI and can contain text or binary data. Resources are not tools: a client reads a resource with the resource protocol rather than invoking a function with tool arguments. The [MCP resources and prompts guide](/blog/mcp-resources-and-prompts-guide) covers the broader primitive design choices.

## Add the stdio entrypoint

Create `src/stdio.ts`:

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const server = createServer();
const transport = new StdioServerTransport();

await server.connect(transport);
```

`StdioServerTransport` reads protocol messages from standard input and writes protocol messages to standard output. An MCP client normally starts this program as a child process and sends JSON-RPC messages over the process pipes.

Do not write diagnostic messages to stdout in a stdio server. A line such as `console.log("started")` can corrupt the protocol stream. Use stderr instead:

```ts
console.error("MCP server started");
```

Many local clients expect a command and argument configuration similar to this:

```json
{
  "mcpServers": {
    "typescript-example": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-typescript-example/dist/stdio.js"]
    }
  }
}
```

The exact configuration file and restart behavior depend on the client. See the guide to [installing MCP servers in Claude, Cursor, Windsurf, and VS Code](/blog/how-to-install-mcp-servers-in-claude-cursor-windsurf-and-vs-code) for client-specific configuration. You can also compare transport behavior in the [MCP transports guide](/mcp-transports).

## Test the server through MCP

Testing the handler function alone would not verify the tool name, schema, protocol result, or resource response. Instead, connect the server and a client with an in-memory transport.

Create `test/server.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

test("exposes the add tool and greeting resource", async () => {
  const server = createServer();
  const client = new Client({
    name: "typescript-example-test-client",
    version: "1.0.0"
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const toolResult = await client.callTool({
    name: "add",
    arguments: { a: 2, b: 3 }
  });

  assert.deepEqual(toolResult.structuredContent, { sum: 5 });

  const resourceResult = await client.readResource({
    uri: "demo://greeting"
  });

  assert.equal(
    resourceResult.contents[0].text,
    "Hello from the TypeScript MCP server."
  );

  await client.close();
  await server.close();
});
```

Run it with:

```bash
npm test
```

`InMemoryTransport.createLinkedPair()` creates two connected transport endpoints. The server uses one endpoint and the client uses the other. This keeps the test inside one process while preserving the MCP client-server boundary.

The test also demonstrates two different client operations. `callTool` sends a tool invocation with a name and arguments. `readResource` requests a URI. If either registration is wrong, the test fails at the protocol operation rather than only failing an internal function assertion.

SDK releases may expose transport shutdown or client cleanup methods slightly differently. If TypeScript reports that `close()` is unavailable for the exact version you installed, use that release's documented cleanup method; the important part is to close resources in tests that create sockets, processes, or long-lived sessions.

## Add a Streamable HTTP entrypoint

Stdio and HTTP are transport choices for the same MCP server. Keep `createServer()` transport-neutral, then create a separate entrypoint for HTTP. A minimal Streamable HTTP shape looks like this:

```ts
import { createServer as createHttpServer } from "node:http";
import { StreamableHTTPServerTransport } from
  "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const mcpServer = createServer();
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined
});

await mcpServer.connect(transport);

const httpServer = createHttpServer(async (request, response) => {
  if (request.url !== "/mcp") {
    response.writeHead(404).end("Not found");
    return;
  }

  // Parse the request body according to the SDK version in use.
  // The SDK's HTTP examples show the required body-handling pattern.
  await transport.handleRequest(request, response);
});

httpServer.listen(3000, "127.0.0.1", () => {
  console.error("MCP HTTP server listening on http://127.0.0.1:3000/mcp");
});
```

Treat this as an entrypoint outline rather than a universal copy-and-paste HTTP server. Streamable HTTP SDK APIs have changed across releases, and some versions expect the parsed JSON body as an additional argument to `handleRequest`. Follow the HTTP server example shipped with your installed SDK for body parsing, session handling, and response lifecycle.

The HTTP entrypoint also needs production controls that stdio does not. Validate the `Origin` header, bind safely, authenticate clients where required, enforce request size and timeout limits, and decide whether sessions are needed. Do not expose an unauthenticated server on a public interface merely because the local stdio version works. The [production MCP architecture guide](/blog/architecting-production-mcp-servers) and [remote MCP deployment guide](/blog/deploying-remote-mcp-servers-production-guide) cover those operational decisions.

A single server instance should generally be connected to one transport lifecycle. Do not connect the same `McpServer` instance to both a stdio transport and an HTTP transport in the same process unless the SDK version explicitly supports that arrangement. Instead, create a fresh server for each entrypoint by calling `createServer()`.

## Stdio versus Streamable HTTP

Choose stdio when:

- A desktop or editor client launches the server locally.
- Credentials can be supplied through the process environment.
- One client owns the server process lifecycle.
- You want the smallest deployment surface.

Choose Streamable HTTP when:

- The MCP server runs as a service.
- Clients are remote or cannot launch local processes.
- You need an HTTP reverse proxy, service discovery, or centralized operations.
- You have designed authentication, authorization, logging, rate limits, and session behavior.

Stdio is not a weaker version of MCP. It is a local transport with a different trust and lifecycle model. HTTP is not automatically multi-tenant or production-ready; those properties must be implemented around the protocol. Transport selection should follow the client and deployment boundary, not the tool implementation.

## Extend the example safely

Once the test passes, replace the `add` implementation with a real operation while keeping the same separation:

1. Validate every external input with a Zod schema or equivalent boundary validation.
2. Keep side effects in the tool handler or a service it calls, not in module initialization.
3. Return concise text for human-readable clients and structured data for programs.
4. Use resources for addressable context such as documents, records, schemas, or generated reports.
5. Keep secrets out of tool descriptions, resource text, and logs.
6. Add tests for invalid arguments, authorization failures, upstream timeouts, and empty results.

For example, a database lookup usually belongs behind a tool when the client supplies filters or the operation has side effects. A stable document or schema that a model can inspect by URI is often better represented as a resource. If the server needs the model to perform an extra model-generation step, read about [MCP sampling](/blog/how-mcp-sampling-works-guide) and its client support requirements rather than assuming every client implements it.

You can inspect the official [`server-everything` listing](/mcp/modelcontextprotocol-server-everything) for a broad protocol exercise server, or use the [MCP playground](/tools/playground) to experiment with MCP interactions before integrating a real backend.

## Common mistakes in a TypeScript MCP server

### Logging on stdout

With stdio, stdout belongs to MCP messages. Send diagnostics to stderr and configure application loggers accordingly.

### Registering a schema that does not match the handler

If the schema says a value is a number, do not assume the handler will receive a string and convert it later without testing. Let the SDK validate the boundary, then handle domain constraints such as ranges and permissions separately.

### Returning only an internal value

A tool handler must return an MCP tool result. Returning a plain number instead of an object containing `content` is not equivalent to returning tool output.

### Treating resources like functions

A resource callback receives a URI request and returns `contents`. It is not invoked through `client.callTool`, and resource metadata should tell clients what the URI represents.

### Starting HTTP without a security model

An HTTP listener changes who can reach the server. Add authentication and origin checks before binding it to a non-loopback interface. For version compatibility, also review [MCP protocol versioning](/mcp-protocol-versioning) when upgrading SDKs or deploying mixed client versions.

## Next steps

Run the example locally with `npm test`, then build it with `npm run build` and configure the compiled stdio entrypoint in your MCP client. When the server needs to run remotely, adapt the separate HTTP entrypoint and follow the [remote MCP hosting guide](/deploy-mcp-server). For more implementation ideas, browse [developer-focused MCP servers](/best/developer-tools) and compare their tool and resource boundaries before adding your own integrations.
