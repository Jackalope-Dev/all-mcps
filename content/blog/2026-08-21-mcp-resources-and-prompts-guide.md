---
title: "MCP Resources and Prompts: The Primitives Most Servers Skip"
excerpt: "Tools get all the attention, but MCP defines two other primitives — resources and prompts — with a completely different control model. Here's what they actually do, real TypeScript and Python code, and why most servers never implement them."
tags: ["MCP", "Developer Tools", "Guides"]
faq:
  - q: "What's the actual difference between an MCP tool, a resource, and a prompt?"
    a: "The difference is who decides to use it. A tool is model-controlled — the LLM reads the description and schema and decides on its own whether to call it, the same way it decides between any two functions. A resource is application-controlled — the host app decides how to surface it (a file picker, an auto-attach heuristic) and the model never chooses to invoke resources/read on its own. A prompt is user-controlled — it's meant to be triggered explicitly by a person, typically as a slash command, not selected autonomously by the model at all."
  - q: "Do I need to implement resources and prompts, or are tools enough?"
    a: "Tools alone are a complete, valid MCP server — most published servers are tools-only, and there's nothing wrong with that if everything you expose is genuinely an action. Resources and prompts earn their keep in specific cases: resources when you have readable data a user should be able to browse, select, or auto-attach without the model burning a tool call to fetch it; prompts when you have a workflow you want a person to trigger deliberately and consistently, the way a slash command works. If neither case applies to your server, skipping them is the right call, not an oversight."
  - q: "Why don't more MCP servers implement resources and prompts?"
    a: "Two reasons. First, host application support has historically lagged tool support — a resource picker UI or a slash-command menu is more work for a client to build than just forwarding a tools/list call, so plenty of clients render resources and prompts inconsistently or not at all, which weakens the incentive to implement them. Second, most server authors default to modeling everything as a tool because tutorials and SDK quickstarts lead with tools first, so a server that should expose a config file as a resource ends up with a get_config tool instead — it works, but it costs a tool-selection decision and a context budget for something that was never really an action."
  - q: "Does adding resources or prompts inflate my server's context cost the way adding more tools does?"
    a: "No, and that's one of the strongest arguments for using them correctly. Every tool's name, description, and schema is sent to the model on every request as a candidate it has to weigh, which is the mechanism behind MCP tool overload. Resources and prompts aren't part of that model-facing decision surface at all — the host application lists and reads them outside of the model's tool-selection loop, so moving something out of a tool and into a resource can reduce context pressure instead of adding to it."
---

> **TL;DR:** MCP defines three primitives, not one. Tools are functions the *model* decides to call. Resources are readable data the *application* decides how to surface — files, records, config, anything the user should be able to browse or attach without spending a tool call. Prompts are reusable templates the *user* decides to trigger, typically as a slash command, not something the model reaches for on its own. Nearly every MCP server in the wild implements tools only, which is fine when everything you expose is genuinely an action — but a lot of servers model read-only data and workflow templates as tools out of habit, not because tools were the right fit. This guide covers what resources and prompts actually do, with current TypeScript and Python code, and when reaching for one of them beats bolting on another tool.

Open almost any MCP server's source and you'll find a list of tool definitions and nothing else. That's not a coincidence — every quickstart, every SDK tutorial, and most of this site's own [build guide](/build-mcp-server) leads with tools first, because tools are the primitive that maps most directly onto "the AI does a thing." But the [Model Context Protocol spec](/what-is-mcp) actually defines three server-side primitives, and the other two — resources and prompts — solve problems tools solve badly: exposing readable data without spending a model decision on it, and giving a person a repeatable, explicitly-triggered workflow instead of hoping the model reaches for the right tool at the right time.

## Three primitives, three different controllers

The detail that gets lost when everyone defaults to tools is that each MCP primitive has a different party deciding when it's used:

- **Tools are model-controlled.** The LLM reads `name`, `description`, and `inputSchema` for every connected tool and autonomously decides whether and how to call one. This is the mechanism [tool description quality](/blog/writing-mcp-tool-descriptions-that-work) and [tool overload](/blog/mcp-tool-overload-context-budgets) are both about — it's a selection problem, and every tool you add is one more option in that selection.
- **Resources are application-controlled.** The host decides how to surface them — a file tree, a searchable picker, an auto-attach heuristic based on what's open — and the spec is explicit that "the protocol itself does not mandate any specific user interaction model." Critically, the model doesn't autonomously call `resources/read` the way it calls a tool; the host reads a resource and hands the content to the model as context.
- **Prompts are user-controlled.** They're meant to be discovered and invoked deliberately by a person, most commonly as a slash command in the client's UI. The spec's own framing is direct: prompts exist "with the intention of the user being able to explicitly select them for use."

That three-way split matters more than it looks. A tool competes for the model's attention on every single request, whether it gets called or not. A resource or a prompt doesn't — it sits outside the model's tool-selection loop entirely, which is exactly why converting a "get_config" tool into a `config://app` resource can shrink your server's footprint instead of growing it.

## Resources: read-only context with a URI, not a function call

A resource is identified by a URI and read with `resources/read` — no arguments, no side effects, just content. Servers declare support with a `resources` capability during initialization, optionally advertising `subscribe` (clients can watch a specific resource for changes) and `listChanged` (the server announces when the available set changes):

```json
{
  "capabilities": {
    "resources": { "subscribe": true, "listChanged": true }
  }
}
```

Registering one in the current TypeScript SDK (`@modelcontextprotocol/server` — the package the SDK split into for v2, replacing the old monolithic `@modelcontextprotocol/sdk`) looks like this:

```ts
import { McpServer } from '@modelcontextprotocol/server';

const server = new McpServer({ name: 'workspace', version: '1.0.0' });

server.registerResource(
  'config',
  'config://app',
  {
    title: 'Application Config',
    description: 'Application configuration data',
    mimeType: 'text/plain',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, text: 'log_level=info\nregion=eu-west-1' }],
  })
);
```

That's a fixed, single-URI resource. Most real data isn't a fixed URI — it's a family of records — so the SDK also supports `ResourceTemplate` for parameterized, RFC 6570 URI patterns:

```ts
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';

server.registerResource(
  'user-profile',
  new ResourceTemplate('users://{userId}/profile', { list: undefined }),
  {
    title: 'User Profile',
    description: 'Profile data for one user',
    mimeType: 'application/json',
  },
  async (uri, { userId }) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ userId, plan: 'pro' }) }],
  })
);
```

`list: undefined` means the instances are unbounded and won't be enumerated in `resources/list` — the resource is readable by URI but not browsable. Give the template a `list` callback instead when the set is enumerable (a fixed roster of teams, a bounded set of reports) and you want it to show up in a picker.

The same shape exists in Python's FastMCP with a decorator instead of a registration call:

```python
from fastmcp import FastMCP

mcp = FastMCP("workspace")

@mcp.resource("config://app")
def app_config() -> str:
    """Application configuration data."""
    return "log_level=info\nregion=eu-west-1"
```

Two details worth knowing that don't show up in most quickstarts:

- **Annotations** (`audience`, `priority`, `lastModified`) let a resource hint to the client who it's for and how important it is — `audience: ["user"]` marks something meant for display, not model consumption; `priority` from 0 to 1 signals how essential it is to include when context is tight.
- **A tool result can link to a resource instead of embedding it.** Tool and prompt content both support a `resource_link` type alongside `text`, `image`, and `audio` — so a search tool can return a list of matches as lightweight links, and the client (or a follow-up `resources/read`) fetches full content only for the ones that matter, instead of dumping every result's full text into the response.

## Prompts: a template with a UI, not an API surface

A prompt is a named, parameterized message template. `prompts/list` advertises what's available and its arguments; `prompts/get` fills in the arguments and returns the actual messages to send the model. Because prompts are user-triggered rather than model-selected, most clients expose them as slash commands rather than anything the model reasons about.

```ts
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const server = new McpServer({ name: 'review', version: '1.0.0' });

server.registerPrompt(
  'review-code',
  {
    title: 'Code Review',
    description: 'Review code for best practices and potential issues',
    argsSchema: z.object({
      code: z.string().describe('The code to review'),
    }),
  },
  ({ code }) => ({
    messages: [
      { role: 'user' as const, content: { type: 'text' as const, text: `Review this code:\n\n${code}` } },
    ],
  })
);
```

The Zod schema does three jobs at once: it's what `prompts/list` advertises as the argument spec (including the `.describe()` text, which clients show next to the input field), it's what the SDK validates `prompts/get` arguments against before your callback ever runs, and it's what infers the callback's TypeScript types. A missing required argument never reaches your handler — it comes back as a `-32602 Invalid params` protocol error, not a result your code has to check for.

Prompts can seed more than one message, including an `assistant`-role message that becomes the start of the model's reply:

```ts
server.registerPrompt(
  'explain-error',
  { description: 'Explain a compiler error and suggest the smallest fix', argsSchema: z.object({ error: z.string() }) },
  ({ error }) => ({
    messages: [
      { role: 'user' as const, content: { type: 'text' as const, text: `Explain this compiler error:\n\n${error}` } },
      { role: 'assistant' as const, content: { type: 'text' as const, text: 'The one-line cause:' } },
    ],
  })
);
```

And they can embed a resource directly in a message — pulling in server-managed reference material (docs, a schema, a sample file) without a separate round trip:

```json
{
  "type": "resource",
  "resource": { "uri": "resource://style-guide", "mimeType": "text/plain", "text": "..." }
}
```

FastMCP's equivalent is, again, a decorator:

```python
@mcp.prompt()
def review_code(code: str) -> str:
    """Review code for best practices and potential issues."""
    return f"Review this code:\n\n{code}"
```

## When to reach for one instead of another tool

A rough test that holds up in practice: if the thing you're exposing has no side effects and the model doesn't need to *decide* to fetch it — it's just data a user should be able to see, browse, or attach — it's a resource, not a `get_x` tool. If it's a workflow you want run the same way every time, triggered deliberately by a person rather than inferred from conversation, it's a prompt, not something you're hoping the model figures out from a long system message. Tools are for the remaining case: something the model has to actively decide to invoke as part of getting a task done, usually because it takes an argument only the model can determine from context, or because it has a real side effect.

Getting this right isn't just tidiness. A `get_config` tool sits in the model's tool list on every request, competing for selection against every other tool your server (and every other connected server) exposes. The same data as a `config://app` resource costs nothing in that selection loop — the host reads it when it's relevant, and the model never has to rule it out against a dozen look-alike tools.

## What changed most recently, and why your code might look different

The [2026-07-28 spec revision](/what-is-mcp) added cache hints to list operations — `resources/list`, `prompts/list`, `tools/list`, and `resources/read` responses now carry `ttlMs` and `cacheScope`, so a client can avoid re-listing on every turn — and consolidated change notifications behind a single `subscriptions/listen` stream that clients opt into per notification type, replacing the older per-notification wiring. Neither change alters the core request/response shapes above; they mostly make well-behaved clients cheaper to build.

Separately, if you're looking at TypeScript SDK examples that import from `@modelcontextprotocol/sdk/server/mcp.js` and yours don't compile, that's a version difference, not a mistake — the SDK's v2 line split the old monolithic `@modelcontextprotocol/sdk` package into scoped packages (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`, framework adapters, and a `server-legacy` package for v1 compatibility), each with its own `exports` map instead of arbitrary deep imports.

## A short checklist before you add either one

- [ ] Is this genuinely read-only, with no side effect a user needs to approve? If yes, it's a resource candidate, not a tool.
- [ ] Does the value come from a *person* triggering a consistent workflow, rather than the model inferring one mid-conversation? That's a prompt candidate.
- [ ] Did you declare the matching capability (`resources`, `prompts`) during initialization? Clients won't call `resources/list` or `prompts/list` on a server that never advertised support.
- [ ] For enumerable resource templates, did you add a `list` callback? Without one, the resource is readable but invisible in any picker UI.
- [ ] Have you tested against a client that actually renders resources and prompts, not just tools? See [testing and debugging MCP servers](/blog/testing-and-debugging-mcp-servers) for the harness side of this — client-rendering gaps won't show up in a unit test.

Tools will keep being the primitive most servers reach for first, and for anything genuinely action-shaped, that's correct. But the next time a server design has a `list_reports` tool sitting next to a `get_report` tool, it's worth asking whether that pair was ever really two actions — or one resource that got modeled as two function calls because nobody reached for the other primitive.
