---
title: "MCP Tool Annotations: readOnlyHint, destructiveHint, and What Clients Do With Them"
excerpt: "Tool annotations are four booleans and a title that tell a client whether your tool reads, writes, deletes, or reaches the outside world. Here is what each hint means, the defaults that bite servers that skip them, and why clients must treat every hint as untrusted."
tags: ["MCP", "Security", "Developer Tools", "Guides"]
faq:
  - q: "What are MCP tool annotations?"
    a: "Tool annotations are an optional annotations object on each tool definition returned by tools/list. They carry a human-readable title plus four boolean hints: readOnlyHint, destructiveHint, idempotentHint, and openWorldHint. They describe how the tool behaves rather than what it does, so a client can decide how much friction to put in front of a call, such as auto-approving a read-only lookup while asking for confirmation before a delete."
  - q: "What happens if my MCP server doesn't set any annotations?"
    a: "The client falls back to the spec defaults, and those defaults are deliberately pessimistic: readOnlyHint defaults to false, destructiveHint to true, idempotentHint to false, and openWorldHint to true. An unannotated tool is therefore treated as one that may destructively modify state, is unsafe to retry, and talks to external systems. A careful client will put the maximum amount of confirmation in front of it, which makes a harmless search tool feel as risky to the user as a delete."
  - q: "Can a client trust readOnlyHint?"
    a: "Not on its own. The specification says clients must treat annotations as untrusted unless they come from a trusted server, because a hint is just a claim the server makes about itself. A malicious or buggy server can label a destructive tool read-only. Annotations are useful for improving the experience with servers you already trust, and they should never be the only thing standing between a model and an irreversible action."
  - q: "What is the difference between destructiveHint and readOnlyHint?"
    a: "readOnlyHint answers whether the tool modifies its environment at all. destructiveHint only matters when readOnlyHint is false, and answers whether those modifications can be destructive, meaning they overwrite or delete, as opposed to purely additive, like creating a new record. A tool that appends a comment is not read-only but is also not destructive. A tool that deletes a branch is both not read-only and destructive."
  - q: "Do annotations change what the model sees?"
    a: "Not directly. Annotations are metadata for the client application, which uses them for approval prompts, retry logic, and policy. Whether a client also surfaces them to the model is up to that client. If a behavior matters for tool selection, such as a tool being slow or having side effects, state it in the tool description too, because the description is the one field every client passes to the model."
---

> **TL;DR:** Every MCP tool can carry an `annotations` object: a `title` plus four booleans that say whether the tool is read-only, destructive, idempotent, and whether it reaches systems outside its own domain. Clients use them to decide how much confirmation to put in front of a call. The defaults assume the worst, so a server that skips them makes every tool look dangerous. Clients have to treat every hint as untrusted unless the server itself is trusted. This post covers what each hint means, how to set them in the TypeScript and Python SDKs, the mistakes that make them misleading, and where annotations stop being enough.

The [guide to writing tool descriptions](/blog/writing-mcp-tool-descriptions-that-work) covered the text a model reads when deciding *which* tool to call. Annotations answer a different question, the one the client application has to answer right after that: *should this call happen without asking the user first?*

That decision used to rely on guesswork. A client saw a tool called `run_query` and had no way to know whether it ran `SELECT` or `DROP TABLE`. The safe response was to confirm everything, and a user who clicks "Allow" forty times an hour eventually stops reading the prompt at all. Annotations exist so the client can confirm only the calls that matter.

---

## The Five Fields

Annotations sit next to the name, description, and schema in each tool definition returned by `tools/list`:

```json
{
  "name": "delete_branch",
  "description": "Delete a git branch from the remote repository. Cannot be undone.",
  "inputSchema": {
    "type": "object",
    "properties": { "branch": { "type": "string" } },
    "required": ["branch"]
  },
  "annotations": {
    "title": "Delete Branch",
    "readOnlyHint": false,
    "destructiveHint": true,
    "idempotentHint": true,
    "openWorldHint": false
  }
}
```

**`title`** is a human-readable display name. It is what a client shows in a tool picker or approval dialog instead of `delete_branch`.

**`readOnlyHint`** is `true` when the tool does not modify its environment. It covers lookups, searches, reads, and anything that only observes. **Default: `false`.**

**`destructiveHint`** is `true` when the tool's modifications may be destructive, meaning they overwrite or delete, as opposed to only adding something new. It is only meaningful when `readOnlyHint` is `false`. **Default: `true`.**

**`idempotentHint`** is `true` when calling the tool repeatedly with the same arguments has no additional effect beyond the first call. Deleting a branch is idempotent because the second call finds nothing to delete. Posting a comment is not, because the second call posts a second comment. It is also only meaningful when `readOnlyHint` is `false`. **Default: `false`.**

**`openWorldHint`** is `true` when the tool interacts with an open-ended set of external entities, like a web search or a request to an arbitrary URL. It is `false` when the tool's domain is closed, like a database the server owns or a local memory store. **Default: `true`.**

## The Defaults Assume the Worst

Look at those defaults together. A tool with no annotations is presumed to modify state, destructively, in a way that is unsafe to retry, while talking to the open internet. That is the most dangerous profile a tool can have, and it is deliberate. The spec could not safely assume the opposite, because a server that forgot to annotate a delete tool would then have it auto-approved.

The practical consequence is that **skipping annotations is not neutral**. A careful client puts its maximum friction in front of every unannotated tool. Your `search_docs` tool gets the same confirmation dialog as someone else's `drop_database`, and users learn to click through both.

If your server has fifteen read-only tools and two that write, annotating the fifteen is the single cheapest improvement you can make to how it feels in use.

## Setting Annotations in the SDKs

In the TypeScript SDK, annotations go in the tool config next to the description and schema:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({ name: 'repo-tools', version: '1.0.0' });

server.registerTool(
  'list_branches',
  {
    title: 'List Branches',
    description: 'List branches in the repository, newest first.',
    inputSchema: { limit: z.number().int().max(100).default(20) },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ limit }) => ({
    content: [{ type: 'text', text: JSON.stringify(await listBranches(limit)) }],
  }),
);

server.registerTool(
  'delete_branch',
  {
    title: 'Delete Branch',
    description: 'Delete a branch from the remote. Cannot be undone.',
    inputSchema: { branch: z.string() },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ branch }) => {
    await deleteBranch(branch);
    return { content: [{ type: 'text', text: `Deleted ${branch}` }] };
  },
);
```

In the Python SDK, pass a `ToolAnnotations` object to the decorator:

```python
from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations

mcp = FastMCP("repo-tools")

@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True, openWorldHint=False))
def list_branches(limit: int = 20) -> list[str]:
    """List branches in the repository, newest first."""
    return get_branches(limit)
```

Be explicit even where a value matches the default. `destructiveHint: true` on a delete tool changes nothing at runtime, but it tells the next person editing the file that someone thought about it and decided on purpose.

## Mistakes That Make Annotations Lie

An annotation that is wrong is worse than one that is missing, because a missing one gets the cautious default and a wrong one gets trusted.

**Marking a tool read-only because its main job is reading.** A `fetch_report` tool that also writes a cache entry, bumps a view counter, or marks notifications as seen is not read-only. The question is whether the environment is different after the call, not what the tool is mostly for.

**Treating "creates" as non-destructive when it can overwrite.** `write_file` sounds additive, but if it replaces an existing file at the same path it is destructive. Only mark `destructiveHint: false` when the tool can never clobber existing data.

**One annotation for a tool with modes.** A `run_sql` tool that accepts any statement cannot honestly be read-only, since its behavior depends on its arguments. Either annotate it for the worst case or split it into `query` (read-only) and `execute` (destructive). Splitting usually improves tool selection too, as the [tool overload post](/blog/mcp-tool-overload-context-budgets) discusses.

**Forgetting `openWorldHint` on proxies.** A tool that fetches a user-supplied URL is open-world even if it only reads. That matters because content from the open world is where prompt injection comes from, and a client may want to handle those results differently.

## Why Clients Must Not Trust Them

The spec is blunt about this: clients must treat annotations as untrusted unless they come from a trusted server. An annotation is a claim a server makes about itself, and nothing in the protocol verifies it.

A malicious server can label an exfiltration tool `readOnlyHint: true` and get auto-approved by any client that takes it at face value. A buggy server can do the same by accident, which is the more common case. This is the same trust boundary the [remote server security guide](/blog/securing-remote-mcp-servers-authentication-guide) and the [MCP security overview](/mcp-security) draw around tool descriptions. Anything that comes from the server is input, not policy.

In practice, a sensible client does something like this:

- **Trusted server** (one the user or an admin explicitly vetted): use the hints to skip confirmation on read-only tools and relax retry logic on idempotent ones.
- **Untrusted or newly added server**: ignore the reassuring hints and keep the pessimistic defaults. Still honor the alarming ones, because a server that admits a tool is destructive has no reason to lie about that.

That asymmetry is the key. `destructiveHint: true` can only make a client more careful, so it is always safe to believe. `readOnlyHint: true` makes a client less careful, so it is only worth believing when the source is.

## Where Annotations Stop

Annotations are a hint layer for approval UX. They are not an authorization system, and they do not replace one:

- **The server still enforces permissions.** If a token should not be able to delete branches, the server rejects the call regardless of what any client decided about confirming it.
- **The description still carries the warning.** Annotations are metadata for the client application. Not every client passes them to the model. If a side effect should influence *whether the model picks the tool at all*, say it in the description, where every model sees it.
- **Hints are per tool, not per call.** They cannot express "destructive only when `force` is true." For anything conditional, use [elicitation](/blog/mcp-elicitation-user-input-guide) to confirm with the user at the moment the risky branch is actually taken.

## A Quick Checklist

Before you ship a server, go through `tools/list` and check each tool:

1. Does it have a `title` a non-developer would understand in an approval dialog?
2. After the call, is anything in the world different? If no, `readOnlyHint: true`.
3. If yes, can it overwrite or delete anything that existed before? That decides `destructiveHint`.
4. Is a retry with identical arguments harmless? That decides `idempotentHint`.
5. Does it touch anything outside a domain your server controls? That decides `openWorldHint`.
6. Is any tool's honest answer "it depends on the arguments"? Split it.

The [MCP Inspector](/blog/testing-and-debugging-mcp-servers) shows annotations in its tool list, which makes it an easy place to run through this list once rather than reading source. When your server's annotations are accurate and your descriptions are clear, [submit it to the directory](/submit) so people can find it.
