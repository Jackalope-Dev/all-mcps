---
title: "MCP Elicitation: How Servers Ask the User for Input Mid-Task"
excerpt: "Sampling lets an MCP server ask the client for LLM reasoning. Elicitation is the other half — a server pausing mid-tool-call to ask the human for a missing value, a confirmation, or a choice. Here is how elicitation/create works, with current TypeScript and Python code."
tags: ["MCP", "Developer Tools", "Architecture", "Guides"]
faq:
  - q: "What is MCP elicitation (elicitation/create)?"
    a: "Elicitation is a client capability defined in the Model Context Protocol that lets a server pause during tool execution and request structured input directly from the user. The server sends an elicitation/create JSON-RPC request containing a human-readable message and a restricted JSON Schema describing the fields it needs. The host client renders a form, the user fills it in, and the client returns the values so the tool can finish. It is the human-facing counterpart to sampling, which requests model reasoning rather than user input."
  - q: "How is elicitation different from just adding more tool parameters?"
    a: "Tool parameters are filled by the model before the tool runs, from whatever is already in the conversation. Elicitation happens during the run, and the answer comes from the person, not the model. Use parameters for inputs the model can reasonably infer from context; use elicitation for things only the user knows or should decide — a target environment, a confirmation before a destructive action, which of three ambiguous matches they meant — that you cannot safely let the model guess."
  - q: "What kind of data can an elicitation schema request?"
    a: "Only a flat object of primitive properties: strings (optionally with format hints like email, uri, date, or date-time), numbers and integers (with optional minimum and maximum), booleans, and single-select enums with human-readable labels. Nested objects and arrays are deliberately not allowed. This keeps the request trivial for any client to render as a simple form and easy for the user to review before sending."
  - q: "Can an MCP server use elicitation to ask for a password or API key?"
    a: "No. The specification explicitly prohibits using elicitation to request secrets — passwords, API keys, access tokens, or other credentials. Clients are expected to make the requesting server's identity clear, let the user edit or reject any field, and provide distinct decline and cancel actions. Credential collection belongs in the client's own auth flow or OAuth, never in a server-driven form."
  - q: "What happens if the client does not support elicitation?"
    a: "Elicitation is an optional capability declared during initialization. If capabilities.elicitation is absent, an elicitation/create request fails with a method-not-found or capability error. Servers must check for the capability or wrap the call in a fallback — typically returning a normal tool result that tells the model which values are missing so it can ask the user in chat and re-invoke the tool."
---

> **TL;DR:** MCP is bidirectional in two directions, not one. [Sampling](/blog/how-mcp-sampling-works-guide) lets a server ask the client for LLM reasoning mid-tool-call. **Elicitation** (`elicitation/create`) is the other half: a server pausing mid-execution to ask the *human* for a value it does not have — a missing parameter, a yes/no confirmation before something destructive, a pick-one out of several matches. The server sends a short message plus a restricted JSON Schema, the client renders a form, and the user's answer comes back as `accept`, `decline`, or `cancel`. This guide covers the wire format, the schema restrictions, current TypeScript and Python implementations, the three-state response you have to handle, and the security rules that make elicitation safe to ship.

When developers first start [building MCP servers](/build-mcp-server), the mental model is a clean one-shot exchange: the model fills in every parameter from the conversation, calls the tool, the tool runs to completion, and a result comes back. That works right up until the tool needs something the conversation never contained.

A `deploy_service` tool needs to know *which* environment. A `delete_records` tool should really confirm before it wipes 4,000 rows. A `book_meeting` tool found three people named "Chris" and has no idea which one you meant. Historically, server authors handled this by either letting the model guess (occasionally catastrophic) or by returning an error string and hoping the outer agent asks the user the right follow-up question (unreliable, and it burns a full conversation turn).

Elicitation, added to the protocol in the 2025-06-18 revision, gives servers a first-class way to ask.

---

## Where Elicitation Sits Among the Primitives

MCP defines a small set of primitives, and the useful way to tell them apart is by *who initiates* and *who answers*:

| Primitive | Initiated by | Answered by | Purpose |
| :--- | :--- | :--- | :--- |
| **Tools** (`tools/call`) | Host model | Server | Model-chosen deterministic actions and side effects |
| **Resources** (`resources/read`) | Host application | Server | Read-only data exposed by URI |
| **Prompts** (`prompts/get`) | User (slash command) | Server | Reusable, explicitly-triggered workflows |
| **Sampling** (`sampling/createMessage`) | Server | Host client (LLM) | Server requests a model completion |
| **Elicitation** (`elicitation/create`) | Server | Host client (**user**) | Server requests structured human input |

Sampling and elicitation are mirror images. Both are server-initiated requests that flow *backwards* across the transport during tool execution. Sampling asks the client's model to think; elicitation asks the client's user to type. If you have read the [sampling guide](/blog/how-mcp-sampling-works-guide), elicitation will feel immediately familiar — it is the same control inversion, pointed at a person instead of a model.

---

## The Wire Protocol

### 1. Capability Negotiation

Elicitation is an optional **client** capability. During `initialize`, a client that can render elicitation forms advertises it:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "elicitation": {},
      "sampling": {}
    },
    "clientInfo": { "name": "Claude Desktop", "version": "1.6.0" }
  }
}
```

If `capabilities.elicitation` is missing, the server must not send `elicitation/create` — it will error.

### 2. The Request

Mid-tool-execution, the server sends:

```json
{
  "jsonrpc": "2.0",
  "id": 77,
  "method": "elicitation/create",
  "params": {
    "message": "Which environment should this deploy target?",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "environment": {
          "type": "string",
          "enum": ["staging", "production"],
          "enumNames": ["Staging", "Production (live traffic)"],
          "description": "Deployment target"
        },
        "runMigrations": {
          "type": "boolean",
          "description": "Apply pending database migrations first",
          "default": false
        }
      },
      "required": ["environment"]
    }
  }
}
```

### 3. The Response

The client renders a form, the user acts, and one of three responses comes back:

```json
{
  "jsonrpc": "2.0",
  "id": 77,
  "result": {
    "action": "accept",
    "content": {
      "environment": "staging",
      "runMigrations": true
    }
  }
}
```

The `action` field is the part you must not ignore:

| `action` | Meaning | What your tool should do |
| :--- | :--- | :--- |
| `accept` | User submitted the form | Read `content`, continue execution |
| `decline` | User explicitly said no | Abort cleanly, return a "declined by user" result |
| `cancel` | User dismissed the dialog without deciding | Abort cleanly, treat as "no answer" — do **not** proceed with defaults |

Collapsing `decline` and `cancel` into "falsy, so use defaults" is the most common elicitation bug. A user who closes a confirmation dialog has not authorized the action.

---

## Schema Restrictions: Flat and Primitive Only

The `requestedSchema` is intentionally a small subset of JSON Schema. It must be a single `type: "object"` whose properties are all primitives:

- **String** — optional `format` of `email`, `uri`, `date`, or `date-time`; optional `minLength` / `maxLength`.
- **Number / integer** — optional `minimum` / `maximum`.
- **Boolean** — optional `default`.
- **Enum** — `type: "string"` plus `enum`, and optionally `enumNames` for human-readable labels.

No nested objects. No arrays. No `oneOf`/`anyOf` gymnastics. The reasoning is deliberate: every client, from a polished desktop app to a terminal REPL, must be able to render the request as a plain form without a schema engine, and the user must be able to read the whole request at a glance before answering. If you need structured or repeated data, collect it one primitive field at a time across multiple elicitation calls, or take it as a tool parameter instead.

---

## TypeScript Implementation

Using the official `@modelcontextprotocol/sdk`, the high-level server exposes `server.elicitInput()`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'deploy-mcp', version: '1.0.0' });

server.tool(
  'deploy_service',
  'Deploys the current build. Confirms the target environment with the user first.',
  { service: z.string().describe('Service name to deploy') },
  async ({ service }, extra) => {
    // Only elicit if the connected client supports it
    const canElicit = Boolean(extra.clientCapabilities?.elicitation);

    if (!canElicit) {
      return {
        content: [{
          type: 'text',
          text: `This client cannot show a confirmation form. Ask the user which environment ` +
                `(staging or production) to deploy "${service}" to, then call deploy_service again ` +
                `with an "environment" argument.`,
        }],
      };
    }

    const answer = await server.elicitInput({
      message: `Deploy "${service}" — which environment?`,
      requestedSchema: {
        type: 'object',
        properties: {
          environment: {
            type: 'string',
            enum: ['staging', 'production'],
            description: 'Deployment target',
          },
          confirm: {
            type: 'boolean',
            description: 'I understand production serves live traffic',
            default: false,
          },
        },
        required: ['environment'],
      },
    });

    if (answer.action !== 'accept') {
      return {
        content: [{ type: 'text', text: `Deployment ${answer.action === 'decline' ? 'declined' : 'cancelled'} by user.` }],
      };
    }

    const { environment, confirm } = answer.content as { environment: string; confirm?: boolean };

    if (environment === 'production' && !confirm) {
      return { content: [{ type: 'text', text: 'Production deploy not confirmed. Nothing was deployed.' }] };
    }

    const result = await runDeploy(service, environment);
    return { content: [{ type: 'text', text: `Deployed ${service} to ${environment}: ${result.url}` }] };
  },
);

async function runDeploy(service: string, env: string) {
  return { url: `https://${env}.example.com/${service}` };
}

await server.connect(new StdioServerTransport());
```

For the low-level `Server` class, send the request directly with `ElicitRequestSchema` from `@modelcontextprotocol/sdk/types.js` and validate the returned `content` against your own Zod schema before trusting it — the user (or a buggy client) can return fields that do not match what you asked for.

---

## Python Implementation with FastMCP

FastMCP wraps the round trip in `ctx.elicit()`, which returns a small result object you pattern-match on:

```python
from dataclasses import dataclass
from mcp.server.fastmcp import FastMCP, Context
from mcp.server.elicitation import (
    AcceptedElicitation,
    DeclinedElicitation,
    CancelledElicitation,
)

mcp = FastMCP("records-admin")


@dataclass
class DeleteConfirmation:
    confirm: bool
    reason: str


@mcp.tool()
async def delete_stale_records(table: str, older_than_days: int, ctx: Context) -> str:
    """Deletes rows older than a cutoff. Confirms with the user before deleting."""
    candidates = await count_matching(table, older_than_days)

    if candidates == 0:
        return f"No rows in {table} older than {older_than_days} days. Nothing to do."

    result = await ctx.elicit(
        message=f"This will permanently delete {candidates} rows from {table}. Continue?",
        schema=DeleteConfirmation,
    )

    match result:
        case AcceptedElicitation(data=data) if data.confirm:
            deleted = await run_delete(table, older_than_days)
            return f"Deleted {deleted} rows from {table}. Reason logged: {data.reason!r}"
        case AcceptedElicitation():
            return "Confirmation checkbox not ticked. No rows deleted."
        case DeclinedElicitation():
            return "User declined. No rows deleted."
        case CancelledElicitation():
            return "Prompt dismissed. No rows deleted."


if __name__ == "__main__":
    mcp.run(transport="stdio")
```

FastMCP derives the `requestedSchema` from the dataclass (or a Pydantic model) and enforces the primitive-only rule at definition time, so an accidental nested field fails fast instead of at runtime.

---

## Four Patterns Where Elicitation Earns Its Place

### 1. Filling a Genuinely Unknowable Parameter

The model cannot know your AWS account ID, your preferred region, or which of your six Slack workspaces you meant. Rather than declaring those as tool parameters the model will hallucinate, expose the tool with just the arguments the model *can* infer and elicit the rest on first use.

### 2. Confirmation Before Irreversible Actions

Any tool that deletes, sends, charges, publishes, or overwrites should gate the side effect behind an `accept`. This is more reliable than a `dryRun` parameter (which the model may set to `false` on its own) and clearer than trusting the client's generic tool-approval modal to convey stakes.

### 3. Disambiguation

Search returned five matches. Instead of guessing or dumping all five back into context and asking the model to re-call the tool with a more specific query, elicit a single-select enum of the candidates and finish the job in one turn.

### 4. Progressive Onboarding Without a Config File

A newly installed server that needs a project name, a default branch, and a notification preference can collect all three with one elicitation call the first time any tool runs, then cache them — no `claude_desktop_config.json` editing, no environment variables. Pair this with [sampling](/blog/how-mcp-sampling-works-guide) and you get capable servers that need zero manual setup.

---

## Security and Trust Boundaries

Because elicitation puts a server-authored form in front of the user, the spec is strict about what servers may do and what clients must provide.

**Servers must not request secrets.** No passwords, API keys, tokens, or credentials — ever. That data belongs in the client's OAuth flow or its own credential store, covered in [securing remote MCP servers](/blog/securing-remote-mcp-servers-authentication-guide). A server-drawn form asking for a password is indistinguishable from a phishing attempt, and compliant clients are encouraged to flag it.

**Clients must make the request attributable.** The UI has to show *which* server is asking, present the raw `message` without letting the server inject markup or scripts, and offer distinct "decline" and "cancel" actions alongside "submit."

**Clients must let the user edit every field.** Defaults are suggestions. The user can change any value or reject the request wholesale, and your tool has to handle receiving something other than what it proposed.

**Validate the response.** Treat `content` as untrusted input. Check types, ranges, and enum membership before acting on it, exactly as you would for a tool parameter arriving from the model.

---

## Handling Clients That Don't Support It

As of late 2026, elicitation support is uneven across the client ecosystem — further along than it was at release, but not universal. Never assume it is there:

```typescript
if (!extra.clientCapabilities?.elicitation) {
  // Fallback: return a normal result that tells the model what to collect
  return {
    content: [{
      type: 'text',
      text: 'Missing required input. Ask the user for: target environment (staging|production). ' +
            'Then call this tool again with that value as the "environment" argument.',
    }],
  };
}
```

The fallback costs an extra conversation turn and leans on the model to ask a clean question, but it degrades gracefully instead of failing. Design your tools so the same values can arrive *either* as parameters *or* via elicitation — that way one code path serves both kinds of client.

---

## Video Walkthrough and Specifications

For an architectural overview of how MCP connects host clients to servers and where the bidirectional primitives fit, watch IBM Technology's engineering breakdown:

<iframe src="https://www.youtube-nocookie.com/embed/kFf37B8UsFE" title="Model Context Protocol (MCP) Explained with Real Examples - IBM Technology" width="100%" height="400" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

Reference material:

- **Official specification:** the [MCP Elicitation spec](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation) defines the schema subset, the three response actions, and the security requirements.
- **SDKs:** the [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and [Python SDK](https://github.com/modelcontextprotocol/python-sdk) both ship elicitation helpers and matching example servers.
- **Companion guides:** [MCP Sampling Explained](/blog/how-mcp-sampling-works-guide), [MCP Progress Notifications and Subscriptions](/blog/mcp-progress-notifications-subscriptions-guide), [MCP Resources and Prompts](/blog/mcp-resources-and-prompts-guide), and [Architecting Production MCP Servers](/blog/architecting-production-mcp-servers).

---

## Implementation Checklist

Before shipping a server that uses elicitation:

- [ ] **Capability checked:** inspect `capabilities.elicitation` and provide a text fallback when it is absent.
- [ ] **Three actions handled:** `accept`, `decline`, and `cancel` each have distinct, safe behavior — no branch treats a dismissal as consent.
- [ ] **Schema is flat and primitive:** no nested objects or arrays; enums carry `enumNames` where labels help.
- [ ] **No secrets requested:** nothing in any `requestedSchema` asks for a credential.
- [ ] **Response validated:** `content` is type- and range-checked before use.
- [ ] **Dual input path:** the same values can arrive as tool parameters, so non-elicitation clients still work.

Elicitation closes the loop that sampling opened: a server can now ask the model to reason *and* ask the person to decide, all without leaving a tool call. Browse production-tested servers in the [AllMCPs directory](/browse), or start your own with the [MCP Server Starter Guide](/build-mcp-server).
