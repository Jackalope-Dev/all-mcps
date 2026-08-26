---
title: "MCP Progress Notifications and Subscriptions: Handling Long-Running Tasks and Live Updates"
excerpt: "Long-running MCP tools often fail silently or hit hard client timeouts in Claude and Cursor. Here is how to implement JSON-RPC progress tokens, resource subscriptions, logging levels, and cancellation in TypeScript and Python."
tags: ["MCP", "Developer Tools", "Architecture", "Guides"]
faq:
  - q: "What is an MCP progress token and how does it work?"
    a: "An MCP progress token is an opaque identifier (string or number) supplied by the host client in the _meta property of a request. When a server executes a long-running tool, it sends out-of-band JSON-RPC notifications named notifications/progress tagged with this token, reporting current progress, total expected steps, and descriptive status messages."
  - q: "How do progress notifications prevent MCP client timeouts?"
    a: "Host clients like Claude Desktop, Cursor, and Windsurf enforce default request timeouts (typically 60 seconds). Emitting notifications/progress packets resets client-side activity timers and informs the host that the server process is alive and actively processing work, preventing abrupt socket termination."
  - q: "What is the difference between tool polling and resource subscriptions in MCP?"
    a: "Tool polling forces the AI model to repeatedly spend reasoning cycles and tokens calling a tool to check for new data. Resource subscriptions (resources/subscribe) establish an event-driven channel where the server automatically emits notifications/resources/updated when data changes, prompting the client to re-read the URI only when necessary."
  - q: "Why does calling console.log break stdio-based MCP servers?"
    a: "In stdio transport, stdout is reserved strictly for valid JSON-RPC framing. Printing raw log statements to stdout injects unformatted text into the JSON stream, causing the client JSON parser to crash. Developers must use stderr for local debugging or notifications/message for structured protocol logging."
  - q: "How does an MCP server handle request cancellation?"
    a: "When a user interrupts an operation, the client emits a notifications/cancelled message containing the original requestId. Production servers map active request IDs to AbortController instances in Node.js or asyncio Tasks in Python, cleanly terminating spawned child processes and database transactions."
---

> **TL;DR:** When an MCP tool takes more than a few seconds to run (such as querying a data warehouse, running end-to-end tests, or scraping batches of web pages), AI host clients frequently freeze or hit 60-second connection timeouts. The Model Context Protocol solves this with event-driven notifications: `notifications/progress` reports real-time execution steps via progress tokens, `resources/subscribe` streams live cache updates without burning model tokens on polling, `logging/setLevel` routes structured logs cleanly, and `notifications/cancelled` enables graceful process abortion. Here is how to implement all four patterns in production.

When developers first start [building MCP servers](/build-mcp-server), they usually write synchronous tools that return results in 200 milliseconds. A tool checks a weather API, reads a local config file, or converts markdown to HTML.

However, real-world engineering workflows are rarely instantaneous. Production tools often execute tasks such as:

1. Indexing a 100,000-line code repository for vector search.
2. Running a comprehensive Playwright browser test suite across multiple viewports.
3. Executing heavy analytical queries across Snowflake or BigQuery.
4. Performing batch image processing or video encoding.

If you run these operations inside a naive MCP tool handler, two problems occur immediately:

- **The UI Freeze:** The user sits in front of Claude Desktop, Cursor, or Zed staring at a generic spinner for 45 seconds with zero feedback on whether the tool is working or deadlocked.
- **The Hard Timeout:** Many MCP host clients enforce a strict 60-second JSON-RPC roundtrip timeout. If your handler takes 61 seconds, the client forcibly terminates the transport connection, leaving orphaned child processes running in the background.

To build responsive, reliable tools, you need to use the protocol's asynchronous notification primitives.

---

## The 60-Second Black Box Problem

Under standard synchronous execution, communication between the host client and the server is a strict request-response pair:

```
[Host Client] ────── tools/call (id: 1) ──────► [MCP Server]
      │                                                │
   (Waits...)                                 (Executes long task)
      │                                                │
[Host Client] ◄───── tool result (id: 1) ───── [MCP Server]
```

If the server encounters a network hiccup or a slow database query, the client has no visibility into what is happening.

The Model Context Protocol specification solves this by defining **JSON-RPC Notifications**. Unlike requests, notifications do not include an `id` field and do not expect a response from the receiver. They flow asynchronously in either direction across the established transport (whether `stdio` or `Server-Sent Events`).

```
[Host Client] ──────── tools/call (id: 1, _meta: { progressToken: 42 }) ────────► [MCP Server]
      │                                                                                │
      │ ◄── notifications/progress (token: 42, progress: 10, total: 100, msg: "Init") ─┤
      │                                                                                │
      │ ◄── notifications/progress (token: 42, progress: 50, total: 100, msg: "Fetch")─┤
      │                                                                                │
      │ ◄── notifications/progress (token: 42, progress: 95, total: 100, msg: "Parse")─┤
      │                                                                                │
[Host Client] ◄─────────────────────── tool result (id: 1) ────────────────────────────┘
```

By streaming intermediate status updates, the server satisfies client keep-alive checks, gives the user immediate visual progress indicators, and enables graceful error recovery.

---

## The JSON-RPC Notification Model

The MCP specification defines several core notification types that every production server author should understand:

| Notification Method | Direction | Purpose | Protocol Reference |
| :--- | :--- | :--- | :--- |
| `notifications/progress` | Server → Client | Reports progress for an active request using a client-supplied token | Tools & Requests |
| `notifications/message` | Server → Client | Emits structured log events at specified RFC 5424 severity levels | Logging Capability |
| `notifications/resources/updated` | Server → Client | Alerts the client that a subscribed resource URI has changed | Resource Subscriptions |
| `notifications/resources/list_changed` | Server → Client | Announces that the catalog of available resources was modified | Dynamic Resources |
| `notifications/tools/list_changed` | Server → Client | Informs the client that tools were dynamically added or removed | Dynamic Tools |
| `notifications/prompts/list_changed` | Server → Client | Informs the client of changes to prompt templates | Dynamic Prompts |
| `notifications/cancelled` | Client → Server | Notifies the server that a pending request was aborted by user/host | Request Lifecycle |

---

## Implementing Progress Notifications Step-by-Step

Let us break down how progress reporting functions on the wire and in code.

### 1. The Wire Protocol

When a client initiates a request where it wants progress tracking, it injects a `progressToken` inside the optional `_meta` parameter:

```json
{
  "jsonrpc": "2.0",
  "id": "req-9812",
  "method": "tools/call",
  "params": {
    "name": "run_database_migration",
    "arguments": {
      "targetVersion": "2026.08.01"
    },
    "_meta": {
      "progressToken": "token-xyz-1001"
    }
  }
}
```

The `progressToken` can be either an integer or a string. As the server executes the migration steps, it sends progress updates back to the client:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "token-xyz-1001",
    "progress": 3,
    "total": 10,
    "message": "Applying migration 003_add_indices.sql"
  }
}
```

Key fields in `notifications/progress`:
- `progressToken` (required): The exact token provided by the client.
- `progress` (required): Current completion counter or percentage.
- `total` (optional): Total steps or maximum counter. If omitted, the client renders an indeterminate activity indicator.
- `message` (optional): Human-readable status update for client UIs.

### 2. TypeScript Implementation

Here is a complete, production-ready TypeScript implementation using the official `@modelcontextprotocol/sdk`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'batch-processor-mcp',
  version: '1.0.0',
});

server.tool(
  'process_document_batch',
  'Processes a large batch of documents with real-time progress reporting',
  {
    documents: z.array(z.string()).describe('List of document IDs to process'),
    batchSize: z.number().default(5).describe('Number of documents to process in parallel'),
  },
  async ({ documents, batchSize }, extra) => {
    const progressToken = extra._meta?.progressToken;
    const totalDocs = documents.length;

    // Helper to send progress updates safely
    const reportProgress = async (current: number, statusMessage: string) => {
      if (progressToken !== undefined) {
        await extra.sendNotification?.('notifications/progress', {
          progressToken,
          progress: current,
          total: totalDocs,
          message: statusMessage,
        });
      }
    };

    const results: Array<{ id: string; status: string }> = [];

    for (let i = 0; i < totalDocs; i += batchSize) {
      const chunk = documents.slice(i, i + batchSize);
      
      await reportProgress(
        i,
        `Processing chunk ${Math.floor(i / batchSize) + 1} of ${Math.ceil(totalDocs / batchSize)}`
      );

      // Simulate asynchronous batch processing work
      await new Promise((resolve) => setTimeout(resolve, 800));

      for (const docId of chunk) {
        results.push({ id: docId, status: 'indexed' });
      }
    }

    // Report 100% completion before returning final response
    await reportProgress(totalDocs, 'Batch processing complete');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              totalProcessed: results.length,
              status: 'success',
              results,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
```

### 3. Python Implementation with FastMCP

In Python, FastMCP provides an ergonomic `Context` object that handles progress token checking and notification dispatch automatically:

```python
import asyncio
from mcp.server.fastmcp import FastMCP, Context

mcp = FastMCP("analytics-pipeline")

@mcp.tool()
async def run_data_export(table_name: str, partitions: int, ctx: Context) -> str:
    """Exports large data tables with live progress telemetry."""
    
    ctx.info(f"Initiating export for table {table_name} across {partitions} partitions")
    
    for partition_index in range(1, partitions + 1):
        # Report progress through the context wrapper
        await ctx.report_progress(
            progress=partition_index,
            total=partitions,
            message=f"Exporting partition {partition_index}/{partitions} to cloud storage"
        )
        
        # Simulate partition serialization and upload
        await asyncio.sleep(0.5)
        
    ctx.info(f"Export for {table_name} completed successfully")
    return f"Export complete: {partitions} partitions archived."

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

---

## Live Resource Subscriptions and Change Feeds

While tools are ideal for taking actions, [MCP resources](/blog/mcp-resources-and-prompts-guide) represent readable data assets.

In many architectures, developers mistakenly implement "polling tools" (such as `check_deployment_status` or `poll_build_queue`) where the AI model is expected to execute a tool every 5 seconds to look for updates. This burns context tokens rapidly, triggers [tool overload](/blog/mcp-tool-overload-context-budgets), and incurs high model inference costs.

The correct protocol primitive is **Resource Subscriptions**.

### The Subscription Sequence Flow

```
[Host Client] ───────── resources/subscribe ("db://tables/orders") ─────────► [MCP Server]
      │                                                                             │
[Host Client] ◄──────────────────── { "result": {} } ───────────────────────────────┤
      │                                                                             │
      │                                                                    (Row inserted in DB)
      │                                                                             │
[Host Client] ◄── notifications/resources/updated ("db://tables/orders") ───────────┤
      │                                                                             │
[Host Client] ─────────── resources/read ("db://tables/orders") ────────────► [MCP Server]
      │                                                                             │
[Host Client] ◄────────────── { contents: [ ...fresh data... ] } ───────────────────┘
```

### TypeScript Resource Subscription Implementation

Servers declare subscription capabilities during the protocol handshake by specifying `capabilities.resources.subscribe = true`.

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// In-memory set of active client resource subscriptions
const activeSubscriptions = new Set<string>();

const server = new Server(
  { name: 'live-metrics-server', version: '1.0.0' },
  {
    capabilities: {
      resources: {
        subscribe: true,
        listChanged: true,
      },
    },
  }
);

// Dynamic metric store
let currentMetrics = { cpuUsage: 24.5, activeConnections: 142, updatedAt: new Date().toISOString() };

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'metrics://system/live',
      name: 'Real-time System Metrics',
      mimeType: 'application/json',
      description: 'Stream of live system CPU and connection telemetry',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === 'metrics://system/live') {
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'application/json',
          text: JSON.stringify(currentMetrics, null, 2),
        },
      ],
    };
  }
  throw new Error(`Resource not found: ${request.params.uri}`);
});

// Handle subscription registration
server.setRequestHandler(SubscribeRequestSchema, async (request) => {
  activeSubscriptions.add(request.params.uri);
  return {};
});

// Handle unsubscription cleanup
server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
  activeSubscriptions.delete(request.params.uri);
  return {};
});

// Function to trigger change notifications when metrics change
export async function updateSystemMetrics(newMetrics: typeof currentMetrics) {
  currentMetrics = { ...newMetrics, updatedAt: new Date().toISOString() };
  const targetUri = 'metrics://system/live';

  if (activeSubscriptions.has(targetUri)) {
    await server.notification({
      method: 'notifications/resources/updated',
      params: { uri: targetUri },
    });
  }
}
```

---

## Structured Logging Without Corrupting Stdio Streams

One of the most frequent errors when debugging local MCP servers is the [stdio stream corruption issue](/blog/mcp-server-not-connecting-troubleshooting-guide). 

Because `stdio` transports multiplex JSON-RPC payloads directly over standard input and output streams, any call to `console.log()` or `print()` injects raw characters into the pipe, breaking JSON parsing in host applications.

MCP resolves this by providing a dedicated, typed logging subsystem based on RFC 5424 severity standards:

```
debug (7) ─► info (6) ─► notice (5) ─► warning (4) ─► error (3) ─► critical (2) ─► alert (1) ─► emergency (0)
```

### Logging Protocol Implementation

When a client wants to configure logging verbosity, it calls `logging/setLevel`:

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "logging/setLevel",
  "params": {
    "level": "info"
  }
}
```

The server responds to this level preference and emits typed log messages:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "warning",
    "logger": "database.connection_pool",
    "data": {
      "availableConnections": 2,
      "poolCapacity": 50,
      "warning": "Connection pool nearing exhaustion"
    }
  }
}
```

### TypeScript Structured Logger Pattern

```typescript
type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
};

class McpLogger {
  private currentLevel: LogLevel = 'info';

  constructor(private server: Server) {}

  public setLevel(level: LogLevel) {
    this.currentLevel = level;
  }

  public async log(level: LogLevel, loggerName: string, data: unknown) {
    if (LOG_LEVEL_PRIORITIES[level] <= LOG_LEVEL_PRIORITIES[this.currentLevel]) {
      await this.server.notification({
        method: 'notifications/message',
        params: {
          level,
          logger: loggerName,
          data,
        },
      });
    }
  }

  public info(logger: string, data: unknown) {
    return this.log('info', logger, data);
  }

  public warn(logger: string, data: unknown) {
    return this.log('warning', logger, data);
  }

  public error(logger: string, data: unknown) {
    return this.log('error', logger, data);
  }
}
```

Using this pattern, logs are displayed cleanly inside the host client's developer inspection panel without corrupting transport sockets.

---

## Graceful Request Cancellation and Abort Handling

What happens when a developer asks Claude or Cursor to analyze a massive repository, realizes they selected the wrong branch, and clicks the "Stop" button in the chat interface?

Without cancellation handling, your server continues grinding in the background, consuming CPU, locking SQLite databases, and running expensive third-party API queries.

The MCP specification defines `notifications/cancelled` to communicate user cancellations down to running tools:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": "req-9812",
    "reason": "User cancelled the operation in UI"
  }
}
```

### Wiring Cancellation to Node.js AbortControllers

Here is how to wire MCP cancellation into standard JavaScript `AbortSignal` pipelines:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  CancelledNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Map of active in-flight request IDs to their respective AbortControllers
const activeRequestControllers = new Map<string | number, AbortController>();

const server = new Server(
  { name: 'cancellation-aware-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Register cancellation listener
server.setNotificationHandler(CancelledNotificationSchema, async (notification) => {
  const { requestId, reason } = notification.params;
  const controller = activeRequestControllers.get(requestId);

  if (controller) {
    console.error(`Aborting active request ${requestId}. Reason: ${reason || 'User cancelled'}`);
    controller.abort();
    activeRequestControllers.delete(requestId);
  }
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const requestId = request.params._meta?.progressToken || Date.now();
  const abortController = new AbortController();
  activeRequestControllers.set(requestId, abortController);

  try {
    if (request.params.name === 'fetch_remote_dataset') {
      const response = await fetch('https://api.example.com/large-archive.tar.gz', {
        signal: abortController.signal,
      });

      const buffer = await response.arrayBuffer();
      return {
        content: [{ type: 'text', text: `Downloaded ${buffer.byteLength} bytes.` }],
      };
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Operation was cancelled by client.' }],
      };
    }
    throw error;
  } finally {
    activeRequestControllers.delete(requestId);
  }
});
```

When the client cancels the operation, `abortController.abort()` immediately terminates the outbound `fetch` socket, saving network bandwidth and releasing system memory.

---

## Protocol Primitives Decision Matrix

Choosing the right primitive ensures clean architecture, optimal token usage, and great responsiveness:

| Capability | Flow Controller | Primary Use Case | Context Window Cost |
| :--- | :--- | :--- | :--- |
| **Tools (`tools/call`)** | AI Model | Explicit deterministic actions with parameters | High (Schemas are weighed on every prompt) |
| **Progress (`notifications/progress`)** | Server | Real-time status for long operations (>2 sec) | Zero (Out-of-band notification) |
| **Resources (`resources/read`)** | Host App / User | Attaching documents, configs, and static data | Low (Read on-demand by URI) |
| **Subscriptions (`resources/subscribe`)** | Server Event | Streaming database, file, or sensor updates | Zero (Updates trigger cache invalidation) |
| **Prompts (`prompts/get`)** | User (Slash Cmd) | Standardized workflow templates and routines | Zero until explicitly invoked by user |
| **Sampling (`sampling/createMessage`)** | Server | Requesting LLM sub-agent reasoning from host | Variable (Scoped to delegated prompt) |

---

## Video Walkthroughs and Official Specifications

For an architectural walkthrough of how Model Context Protocol connects LLM clients to external tools and services, watch IBM Technology's engineering deep dive:

<iframe src="https://www.youtube-nocookie.com/embed/kFf37B8UsFE" title="Model Context Protocol (MCP) Explained with Real Examples - IBM Technology" width="100%" height="400" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

To explore additional low-level implementation details and reference codebases:

- **Anthropic Engineering Discussion:** Watch [Why we built and donated the Model Context Protocol (Anthropic)](https://www.youtube.com/watch?v=PLyCki2K0Lg) featuring MCP co-creator David Soria Parra.
- **Official Model Context Protocol Specification:** Review the complete [Model Context Protocol Specification](https://modelcontextprotocol.io/docs/concepts/architecture) for formal schema definitions of JSON-RPC notifications and lifecycle hooks.
- **Anthropic MCP GitHub Repository:** Inspect the open-source [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and [Python SDK](https://github.com/modelcontextprotocol/python-sdk).
- **Architecture Blueprints:** Read our companion guides on [Architecting Production MCP Servers](/blog/architecting-production-mcp-servers), [How MCP Sampling Works](/blog/how-mcp-sampling-works-guide), and [Securing Remote MCP Servers](/blog/securing-remote-mcp-servers-authentication-guide).

---

## Production Implementation Checklist

Before shipping an MCP server that handles long-running tasks or streaming data to users:

- [ ] **Progress Tokens Inspected:** Check `extra._meta.progressToken` on heavy tools and emit `notifications/progress` every 1 to 2 seconds.
- [ ] **Stdio Cleanliness:** Ensure no library code writes unformatted strings to `stdout`. Direct all local debugging to `stderr` or `notifications/message`.
- [ ] **Cancellation Handled:** Store active request IDs and map them to `AbortController` instances or background worker kill switches.
- [ ] **Subscriptions vs Polling:** If clients need fresh state from a changing resource, expose `resources/subscribe` rather than forcing the model into repeated tool calls.
- [ ] **Safe Fallbacks:** Always handle clients that do not support optional capabilities gracefully (e.g. continue tool execution if `progressToken` is omitted).

Implementing these real-time primitives transforms your MCP server from an error-prone proof-of-concept into a responsive, enterprise-ready service. Browse our curated directory of production-tested tools on the [AllMCPs Server Directory](/browse) or start building your own with our [MCP Server Starter Guide](/build-mcp-server).
