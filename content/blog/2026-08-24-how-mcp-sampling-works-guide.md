---
title: "MCP Sampling Explained: How to Build AI-Powered MCP Servers Without API Keys"
excerpt: "MCP servers don't have to be dumb pipes. With MCP sampling, your server can request LLM reasoning directly through the host client — without bundling API keys, managing token billing, or leaking secrets. Here is how sampling works with TypeScript and Python implementations."
tags: ["MCP", "Developer Tools", "Architecture", "Guides"]
faq:
  - q: "What is MCP sampling (sampling/createMessage)?"
    a: "MCP sampling is a bidirectional protocol capability where an MCP server requests an LLM completion back from the host client (such as Claude Desktop, Cursor, Zed, or Claude Code) via a JSON-RPC method named sampling/createMessage. This allows the server to leverage LLM intelligence — for summarizing data, structuring queries, or multi-step reasoning — using the client's existing authenticated model session without needing its own OpenAI, Anthropic, or cloud API keys."
  - q: "How does an MCP server request sampling without hardcoding a specific AI model?"
    a: "The MCP specification uses modelPreferences instead of hardcoded model identifiers. When calling sampling/createMessage, the server supplies hints (e.g. preferred model families) along with priority weights between 0.0 and 1.0 for costPriority, speedPriority, and intelligencePriority. The host client evaluates these weights against available models and selects the optimal engine for the job."
  - q: "What is the includeContext parameter in MCP sampling?"
    a: "includeContext instructs the host client whether to attach MCP resource context to the sampling prompt. It accepts three values: 'none' (sends only the messages provided in the sampling request), 'thisServer' (attaches resources managed by the requesting MCP server), or 'allServers' (attaches resources across all MCP servers currently attached to the client). In most server-side tasks, setting this to 'none' is recommended to avoid unnecessary context consumption and unexpected token costs."
  - q: "Why should I use MCP sampling instead of making direct OpenAI or Anthropic API calls inside my server?"
    a: "Calling external LLM APIs directly inside an MCP server forces you or your end users to supply, store, and rotate API keys, configure environment variables, and manage rate limits and billing. Sampling delegates all model access, authentication, billing, and user consent to the host client. Additionally, sampling respects user-level privacy boundaries and ensures compliance with client-level AI provider agreements."
  - q: "What happens if an MCP client does not support sampling?"
    a: "Sampling is an optional client capability declared during protocol initialization. If a client connects without declaring capabilities.sampling, any sampling/createMessage request will fail with a MethodNotFound or capability error. Production MCP servers must always inspect client capabilities or use try/catch blocks to provide graceful deterministic fallbacks when sampling is unavailable."
---

> **TL;DR:** Most developers assume Model Context Protocol (MCP) servers are strictly passive conduits that execute deterministic code when called by a client. But MCP is bidirectional: the protocol defines a capability called **sampling** (`sampling/createMessage`), allowing a server to ask the *client* to run an LLM completion. This lets you build servers that perform internal reasoning, summarize vast datasets down to concise payloads, and translate natural language into structured API calls — all without requiring end users to provide OpenAI or Anthropic API keys or manage separate billing.

When developers first start [building MCP servers](/build-mcp-server), they typically follow a predictable pattern: an LLM decides to call a tool, the server executes a local function or REST request, and the server returns the raw output back into the conversation context.

For straightforward tasks like checking the weather or looking up a GitHub commit, this deterministic model works well. But for complex workflows — such as parsing gigabytes of server logs, extracting insights from unstructured documents, or synthesizing SQL queries from messy inputs — the passive approach breaks down fast.

Historically, server authors solved this in one of two suboptimal ways:

1. **Context Window Dumping:** Returning megabytes of raw text directly into the chat session, triggering [MCP tool overload](/blog/mcp-tool-overload-context-budgets) and burning thousands of tokens.
2. **Hardcoded API Keys:** Requiring every user who installs the server to provide an `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in their `claude_desktop_config.json`, turning installation into a credential management headache.

MCP sampling eliminates both compromises. By tapping into the host client's existing model connection, your server can run intermediate AI reasoning inside its tool handlers cleanly and securely.

---

## How MCP Sampling Works Under the Hood

To understand sampling, you have to look at the flow of control in standard MCP communication versus sampled communication.

In standard MCP tool execution:

```
[Host Client / LLM] ──( tools/call )──► [MCP Server]
[Host Client / LLM] ◄──( tool result )─── [MCP Server]
```

With MCP sampling, the server temporarily reverses the relationship mid-execution:

```
[Host Client] ──( 1. tools/call: "triage_incident" )──► [MCP Server]
                                                            │
                                                     (fetches 50MB logs)
                                                            │
[Host Client] ◄──( 2. sampling/createMessage )───────────────┤
      │                                                     │
(Runs fast model to                                         │
 summarize errors)                                          │
      │                                                     │
[Host Client] ──( 3. returns summary text )───────────────► │
                                                            │
                                                  (runs diagnostic tool)
                                                            │
[Host Client] ◄──( 4. final structured result )─────────────┘
```

During step 2, the server sends a standard JSON-RPC request back across the transport (whether stdio, SSE, or Streamable HTTP) asking the client to generate a completion based on messages and parameters supplied by the server.

### 1. Capability Negotiation

Sampling is an optional client-side capability. When a client establishes an MCP connection, it sends an `initialize` request detailing what it supports:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "sampling": {},
      "roots": { "listChanged": true }
    },
    "clientInfo": {
      "name": "Claude Desktop",
      "version": "1.4.0"
    }
  }
}
```

If `capabilities.sampling` is absent, the server knows the client cannot process LLM completion requests.

### 2. The Wire Format: `sampling/createMessage`

When the server wants an LLM completion, it dispatches `sampling/createMessage`:

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "sampling/createMessage",
  "params": {
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "Filter these 100 log lines and extract only root-cause errors as JSON:\n[...log dump...]"
        }
      }
    ],
    "systemPrompt": "You are an automated log parsing sub-agent. Return only valid JSON.",
    "modelPreferences": {
      "speedPriority": 0.8,
      "intelligencePriority": 0.4,
      "costPriority": 0.9,
      "hints": [{ "name": "claude-3-5-haiku" }, { "name": "gpt-4o-mini" }]
    },
    "includeContext": "none",
    "temperature": 0.1,
    "maxTokens": 1000
  }
}
```

The client responds with the generated completion:

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": {
    "role": "assistant",
    "content": {
      "type": "text",
      "text": "{\"status\":\"error\",\"code\":500,\"culprit\":\"Database connection pool exhausted\"}"
    },
    "model": "claude-3-5-haiku-20241022",
    "stopReason": "endTurn"
  }
}
```

---

## Model Preferences: Hints Over Hardcoded Models

One of the cleanest design choices in the [Model Context Protocol specification](/what-is-mcp) is how model selection is decoupled.

An MCP server should never assume a specific backend provider or hardcode model identifiers like `gpt-4o-2024-08-06`. The user might be running Claude Desktop with Anthropic models, Cursor with custom OpenAI endpoints, or a local instance of Ollama/vLLM through a private client.

Instead, the protocol provides `modelPreferences`:

| Property | Type | Description |
|---|---|---|
| `hints` | `Array<{ name: string }>` | Optional strings suggesting model families (e.g. `claude-3-5-sonnet`, `gemini-1.5-flash`). Clients can match or ignore them. |
| `costPriority` | `number` (0.0 to 1.0) | How strongly the server prefers a cheap model over an expensive one. |
| `speedPriority` | `number` (0.0 to 1.0) | How strongly the server prioritizes low latency / fast time-to-first-token. |
| `intelligencePriority` | `number` (0.0 to 1.0) | How strongly the server requires advanced reasoning or deep comprehension capabilities. |

For example, if your server is performing routine regex-like string extraction from Markdown tables, you configure high `speedPriority` and high `costPriority`:

```json
"modelPreferences": {
  "speedPriority": 0.9,
  "costPriority": 0.9,
  "intelligencePriority": 0.2
}
```

The client can then route the request to a fast, cost-effective model (like Haiku, Flash, or an 8B open-weights model) rather than spending expensive frontier-tier tokens.

---

## TypeScript Implementation Guide

Let's build a practical TypeScript MCP server that fetches a massive remote document, uses client sampling to extract key metrics, and returns a lean response.

Using the modern `@modelcontextprotocol/server` package:

```ts
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

const server = new McpServer({
  name: 'smart-analyzer',
  version: '1.0.0',
});

server.registerTool(
  'summarize_repo_health',
  {
    repoUrl: z.string().url().describe('GitHub repository URL to audit'),
  },
  async ({ repoUrl }, extra) => {
    // 1. Fetch raw repository activity (simulated large payload)
    const rawData = await fetchRepoMetrics(repoUrl);

    // 2. Check if the connected client supports sampling
    const clientCapabilities = extra.connection?.clientCapabilities;
    const canSample = Boolean(clientCapabilities?.sampling);

    if (!canSample) {
      // Graceful fallback: return deterministic raw data or truncated string
      return {
        content: [
          {
            type: 'text',
            text: `[Client does not support sampling] Raw Metrics:\n${rawData.slice(0, 1000)}...`,
          },
        ],
      };
    }

    try {
      // 3. Request an LLM completion from the host client
      const sampleResult = await extra.server.request(
        {
          method: 'sampling/createMessage',
          params: {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Analyze these raw commit & issue logs and output a concise 3-bullet executive summary:\n\n${rawData}`,
                },
              },
            ],
            systemPrompt: 'You are a staff software engineer performing repository due diligence. Be brutally concise.',
            maxTokens: 300,
            temperature: 0.2,
            modelPreferences: {
              speedPriority: 0.7,
              intelligencePriority: 0.6,
              costPriority: 0.8,
              hints: [{ name: 'claude-3-5-haiku' }, { name: 'gpt-4o-mini' }],
            },
            includeContext: 'none',
          },
        },
        // Validates return schema against protocol standard
        z.object({
          role: z.literal('assistant'),
          content: z.object({
            type: z.literal('text'),
            text: z.string(),
          }),
          model: z.string(),
          stopReason: z.string().optional(),
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: `### Repository Health: ${repoUrl}\n*(Processed via ${sampleResult.model})*\n\n${sampleResult.content.text}`,
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Sampling failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  }
);

async function fetchRepoMetrics(url: string): Promise<string> {
  // In a real server, fetch from GitHub REST/GraphQL API
  return `Commit count: 4,892. Open issues: 312. Stale PRs: 48. Build pass rate: 94.2%. Average resolution time: 6.4 days.`;
}

// Connect via standard stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Python FastMCP Implementation Guide

In the Python ecosystem, the `FastMCP` framework provides an ergonomic `@mcp.tool` interface with a first-class `Context` object that handles sampling requests seamlessly.

```python
from fastmcp import FastMCP, Context
import httpx

mcp = FastMCP("log-triage-server")

@mcp.tool()
async def triage_server_logs(service_name: str, ctx: Context) -> str:
    """Fetches recent production logs and uses sampling to extract root causes."""
    
    # 1. Fetch raw logs from telemetry backend
    raw_logs = f"""
    [2026-08-24 14:02:11] WARN [auth-service] Token verification took 1240ms
    [2026-08-24 14:02:14] ERROR [db-pool] Connection pool timeout: limit 50 reached
    [2026-08-24 14:02:15] CRITICAL [gateway] HTTP 504 Gateway Timeout for /api/v1/checkout
    [2026-08-24 14:02:19] ERROR [checkout] Failed to persist order 9821: connection closed
    """
    
    # 2. Sample the client LLM directly via FastMCP Context
    try:
        sample_response = await ctx.sample(
            messages=[
                {
                    "role": "user",
                    "content": {
                        "type": "text",
                        "text": f"Identify the primary root cause and impacted endpoints from these logs:\n{raw_logs}"
                    }
                }
            ],
            system_prompt="You are an SRE incident commander. Format the answer as a structured Markdown table.",
            max_tokens=400,
            temperature=0.0
        )
        
        # 3. Return the synthesized intelligence
        return f"## Incident Triage Report: {service_name}\n\n{sample_response.content.text}"

    except Exception as e:
        # Fall back gracefully if sampling is rejected or unsupported by the client
        return f"Warning: Sampling failed ({str(e)}). Returning raw log stream:\n{raw_logs}"

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

FastMCP abstracts the JSON-RPC negotiation and schema validation into `ctx.sample()`, making intelligent tool execution as simple as calling an internal async function.

---

## Four Real-World Architectural Patterns for Sampling

Why bother doing LLM generation inside an MCP server instead of letting the primary client model do everything? Here are four high-impact architectural patterns:

### 1. Token Budget Compression (Preventing Tool Overload)

Suppose you are building an MCP server that searches Jira, Slack, or GitHub. A single search query often returns 20 results totaling 40,000 tokens of raw JSON.

If you return that full payload in the tool result, you eat 20% to 50% of the active context window. Subsequent turns in the conversation will continue paying for those 40,000 tokens over and over.

With sampling, the server can internally request a fast, cheap model (e.g. `gpt-4o-mini` or `claude-3-5-haiku`) to filter out irrelevant fields, compress the 20 results down to the 3 most relevant snippets, and return only 400 tokens to the main agent.

```
Raw API Data (40,000 tokens) ──► [Server Internal Sampling] ──► Lean Result (400 tokens)
```

### 2. Natural Language to Structured Query Translation

If your MCP server interfaces with a complex SQL database, GraphQL backend, or Elasticsearch cluster, expecting the primary agent to get every column name and filter syntax right on the first try often results in tool invocation errors.

With sampling, your server can expose a simple tool like `query_analytics(natural_language_goal: string)`. Inside the tool handler:

1. The server reads its own database schema.
2. The server calls `sampling/createMessage` to generate the exact SQL query based on the schema and the user's intent.
3. The server executes the SQL safely against the read-only replica.
4. The server returns the final table to the client.

The main client model never has to wrestle with raw table definitions or dialect quirks.

### 3. Self-Correcting Internal Execution Loops

When an MCP tool fails (for example, an API returns a schema validation error or an HTTP 400 Bad Request), standard servers simply return the error string and make the outer agent retry on the next turn.

With sampling, the tool handler can implement an internal retry loop:

```
[Call External API] ──(Fails with 400)──► [Sample Client LLM to Fix Payload] ──► [Retry API Call] ──► [Success]
```

The tool heals itself before ever returning to the host, keeping the outer conversation clean and reducing end-user latency.

### 4. Zero-Key Multi-Tenant Plugins

If you distribute a public MCP server (for example, via npm, PyPI, or the [AllMCPS Registry](/mcp-registry-vs-directory-publish-official-registry)), requiring users to supply OpenAI or Anthropic API keys creates friction, credential exposure risks, and support tickets.

By relying on sampling, your server becomes a zero-dependency, zero-key plugin. Anyone running an MCP-compliant client can install and run your AI-augmented server out of the box with zero configuration.

---

## Security, Privacy, and Human-in-the-Loop Boundaries

Because sampling allows a server to request computation from the client, MCP clients implement explicit security boundaries to protect users.

### The Human-in-the-Loop Approval Modal

When an MCP server issues `sampling/createMessage`, most modern clients do not silently execute the request. Depending on the client's security settings, the UI may present a notification or confirmation dialog:

> *"The MCP Server 'log-triage-server' is requesting an LLM completion using Claude 3.5 Haiku. Allow this request?"*

This prevents malicious or poorly designed servers from running infinite loops that drain user credits or burn API rate limits.

### Context Leakage and `includeContext`

The `includeContext` parameter in `sampling/createMessage` controls what context the client provides to the sampled model:

- `"none"`: Only the exact messages passed in the sampling request are visible. *(Recommended default)*
- `"thisServer"`: The client attaches [MCP resources](/blog/mcp-resources-and-prompts-guide) exposed by the requesting server.
- `"allServers"`: The client attaches resources from all active servers connected to the session.

Setting `includeContext: "allServers"` should be done with caution. If your server is querying an external or third-party service, you do not want it to accidentally ingest sensitive data from other connected servers (such as local filesystem or password manager MCPs).

### Preventing Infinite Recursion

Consider what happens if an MCP server's sampling request prompts the client, and the client's internal reasoning decides to call the *same* MCP tool again. Without safeguards, this can trigger an infinite recursive loop.

To prevent this:
- **Clients disable tool use during sampling:** When a client resolves `sampling/createMessage`, it typically disables tool calling for that sub-completion, treating it strictly as a text/image generation step.
- **Servers enforce depth caps:** Servers should maintain internal execution counters and abort if an internal loop exceeds 2–3 iterations.

---

## Sampling vs. Tools vs. Prompts vs. Resources

To see where sampling fits into the broader protocol, compare it to the other primitives covered in our [MCP Resources and Prompts Guide](/blog/mcp-resources-and-prompts-guide):

| Primitive | Who Initiates? | Who Controls Execution? | Primary Purpose |
|---|---|---|---|
| **Tools** | Host Model | Server | Expose deterministic actions & external side effects. |
| **Resources** | Host Application | Host Client | Expose read-only documents, files, and state via URIs. |
| **Prompts** | User (Slash Commands) | User | Reusable prompt templates & workflows triggered on demand. |
| **Sampling** | MCP Server | Host Client | Lets the server request LLM completions back from the host. |

---

## Best Practices for Building Sampled MCP Servers

1. **Always Check Client Capabilities:** Never assume the client supports sampling. Check `capabilities.sampling` during initialization or wrap sampling calls in fallback handlers.
2. **Prioritize Speed and Cost:** For most server-side tasks (summarization, extraction, parsing), set `speedPriority: 0.8` and `costPriority: 0.8`. Save heavy frontier intelligence for the top-level chat.
3. **Use Strict System Prompts:** Instruct the sampled model to return structured formats (e.g. JSON or Markdown) and explicitly forbid conversational filler ("Sure! Here is your summary...").
4. **Cap `maxTokens` Aggressively:** Always specify a realistic `maxTokens` limit (e.g., 200–500 tokens). This prevents runaway token generation if the model hallucinates.
5. **Keep Prompts Focused:** Do not attempt to replicate the user's entire conversation history inside a sampling call. Pass only the minimal input needed to complete the task.

---

## Summary & Next Steps

MCP sampling transforms servers from simple API wrappers into intelligent sub-agents that can process, refine, and structure data autonomously.

By leveraging the host client's model access through `sampling/createMessage`, you can build powerful, context-efficient tools that deliver a superior developer experience without requiring API keys or extra configuration.

To dive deeper into building production-ready servers, explore these related guides:

- [MCP Resources and Prompts: The Primitives Most Servers Skip](/blog/mcp-resources-and-prompts-guide)
- [How Many MCP Servers Is Too Many? Tool Overload and Context Budgets](/blog/mcp-tool-overload-context-budgets)
- [Architecting Production MCP Servers](/blog/architecting-production-mcp-servers)
- [Securing Remote MCP Servers: Authentication & Authorization](/blog/securing-remote-mcp-servers-authentication-guide)
- [Testing and Debugging MCP Servers](/blog/testing-and-debugging-mcp-servers)
