---
title: "How Many MCP Servers Is Too Many? Tool Overload and Context Budgets"
excerpt: "Every MCP server you connect adds its full tool list to every request, whether you use it or not. A practical guide to measuring the cost, spotting overload, and trimming your setup without losing capability."
tags: ["MCP", "Developer Tools", "Guides"]
faq:
  - q: "How many MCP servers should I connect at once?"
    a: "There's no universal number, but as a rule of thumb: under roughly 20-30 tools total, most models pick correctly without much thought. Past 50-80 tools, expect measurable degradation in tool selection even on large-context models, independent of whether you hit a hard token limit. Count tools, not servers — a single server with 25 tools costs more than five servers with three tools each."
  - q: "Does a bigger context window fix tool overload?"
    a: "Only the budget half of the problem. A 200K or 1M token window means you won't run out of room from tool schemas alone, but tool selection accuracy degrades from having more similar options to choose between, not just from running low on tokens. A model with huge context and 100 overlapping tools can still call the wrong one."
  - q: "Do unused MCP tools cost anything if the model never calls them?"
    a: "Yes. Every tool's name, description, and JSON schema gets sent to the model on every single request in the session, regardless of whether it ends up calling that tool. An unused tool isn't free — it's paid for on every turn as input tokens, and it's one more option the model has to rule out before picking the right one."
  - q: "What's the fastest way to cut down an MCP setup that's gotten too big?"
    a: "Pull up your client's MCP logs or a token calculator, rank connected servers by tool count, and start with the ones you haven't actually invoked in the last week. Disconnecting five rarely-used servers usually recovers more budget than trimming descriptions on the ones you keep."
---

> **TL;DR:** Every MCP server you connect hands the model its full tool list — names, descriptions, JSON schemas — on every single request, before the model has read a word of what you actually asked. That cost is fixed and recurring, not one-time. Past a certain number of tools, two things degrade at once: your usable context budget shrinks, and the model gets measurably worse at picking the right tool out of a crowded lineup. This guide covers how to actually measure that cost, what overload looks like in practice, and how to trim a setup without losing the servers you rely on.

Somewhere between "I connected two MCP servers" and "I connected everything in the directory that looked useful," most setups quietly cross a line where they start working against you. Nobody notices the exact moment it happens, because the failure mode isn't an error message — it's the model reaching for the wrong tool, or not reaching for any tool at all, on a request that should have been trivial.

This is a different problem from the one covered in [our guide to writing MCP tool descriptions](/blog/writing-mcp-tool-descriptions-that-work). That post is about making one tool's description good. This one is about what happens when you have too many good tools competing for the same decision.

## The cost you're paying before the conversation even starts

When an MCP client connects to a server, it calls `tools/list` and gets back every tool's `name`, `description`, and `inputSchema`. That entire payload gets folded into the model's context on every request in the session — not just the first one, and not just for tools that end up getting called.

A modestly-documented tool with a couple of parameters typically runs 100-250 tokens once you count the description and schema properties. A well-documented tool with several parameters, each carrying its own description and constraints (the kind [our tool-description guide](/blog/writing-mcp-tool-descriptions-that-work) recommends), can run 300-500 tokens on its own.

Do the arithmetic on a realistic setup: seven connected servers, averaging ten tools each, at roughly 200 tokens per tool. That's 70 tools and 14,000 tokens spent before the model has processed your message — every single turn, for the entire session. On a model with a 128K context window, that's over 10% of your total budget gone to tool definitions alone, recurring on every request, not amortized across the conversation.

You can check your own numbers instead of trusting a rule of thumb — [the token calculator](/tools/token-calculator) will estimate this for a given tool count and description length, which is worth doing once for your actual stack rather than guessing.

## Two problems, not one

It's tempting to think of this purely as a budget problem — "I have plenty of context window left, so I'm fine." That's only half true, and it's the easier half.

**The budget problem** is straightforward: tool schemas eat into the space available for your actual conversation, retrieved documents, file contents, and prior turns. On a small-context model this bites fast. On a 200K+ context model it bites slower, but it still bites — long agentic sessions with many tool calls and results accumulate context quickly, and every additional turn still carries the full tool list as fixed overhead.

**The selection problem** is the one bigger context windows don't fix. Every time the model considers a request, it's silently ranking every available tool against it. Add a `search_notes` tool from one server and a `find_notes` tool from another, both plausible for the same request, and you've made the model's job harder regardless of how much room is left in the context window. This compounds with server count in a way raw token math doesn't capture — five servers that each expose a `create_task` or `send_message` tool aren't just five times the tokens, they're a lineup of near-duplicate options the model has to disambiguate with nothing but a name and a description to go on.

This is exactly the failure mode described in [writing MCP tool descriptions that work](/blog/writing-mcp-tool-descriptions-that-work): a vague or overlapping description causes a misfire. Tool overload is what happens when that risk compounds across dozens of tools instead of two or three.

## What overload actually looks like

None of this shows up as a crash. It shows up as behavior that's hard to pin on a specific cause unless you know to look for it:

- The model calls a plausible-sounding tool from the wrong server instead of the one you meant, especially when two connected servers cover adjacent ground (two calendar servers, two search servers, a generic web-fetch tool sitting next to a purpose-built API client).
- It skips tool use entirely and answers from general knowledge on a request that should have triggered a tool call, because the right tool didn't stand out from a crowded list.
- Sessions that used to run long start hitting context limits noticeably earlier, even though your actual conversation content hasn't changed.
- Latency creeps up — more tokens processed per request means more time before the first output token, on every single turn.
- Costs rise on metered API usage even on sessions where you only used two or three of your connected servers, because you paid input-token price for all of them anyway.

If any of that sounds familiar, it's worth an audit before you reach for a bigger-context model as the fix — that treats the budget symptom without touching the selection problem underneath it.

## A rough sizing guide

Treat these as starting points to calibrate against your own model and use case, not hard limits:

| Total tools connected | What to expect |
|---|---|
| Under ~20 | Selection is reliable on most models; budget impact is minor. |
| ~20-50 | Still generally fine, but overlapping tools (two servers with similar verbs) start causing occasional misfires. |
| ~50-80 | Measurable selection degradation on most models, independent of context window size. Worth auditing. |
| 80+ | Expect regular misfires and meaningfully reduced usable context, even on large-context models. |

Count *tools*, not *servers* — a single feature-rich server with 30 tools costs more than ten small servers with three tools apiece. If you're not sure how many tools a connected server actually exposes, most clients show this in their MCP or connector settings; some now surface it directly in the tool-picker UI.

## Trimming a setup without losing what you need

**Audit before you cut.** Check which servers you've actually invoked in the last week or two — most clients log tool calls somewhere, even if it's just a debug log. A server you added for one task three weeks ago and haven't touched since is pure overhead now.

**Prune duplicated coverage first.** If two connected servers both expose search, fetch, or task-creation tools, that overlap is where selection errors concentrate. Keep the one with better descriptions and disambiguating scope, and disconnect the other rather than trying to out-word your way to correct selection.

**Scope servers to the project, not the machine.** A global client config that loads every server for every session is the fastest way to end up here. Most clients support project- or workspace-level MCP configs — use them so a data-analysis project isn't also carrying six unrelated ad-tooling servers into its context on every request.

**Group servers into stacks per task, and swap rather than stack them.** If you regularly switch between, say, a research workflow and a deployment workflow, keeping both fully connected all the time means paying for both lineups on every single request even though you only ever use one at a time. [The stack builder](/stack) lets you assemble a specific combination of servers for a given workflow instead of running your entire directory of connections permanently.

**Prefer fewer, well-scoped servers over many narrow ones when tool counts are similar.** All else equal, one server with eight clearly-differentiated tools beats four servers with two tools each — not because of raw token count, which is roughly the same, but because it's easier to write eight descriptions that don't overlap than to coordinate non-overlapping descriptions across four separately-maintained servers you don't control.

**Watch for lazy-loading support in your client.** Some newer MCP clients now defer full tool schemas until a tool is actually likely to be used, exposing only lightweight names up front and fetching the full description and schema on demand — closer to how a search index works than a fixed system-prompt dump. This doesn't remove the selection problem, but it substantially reduces the fixed per-turn budget cost for large tool libraries, since only the tools relevant to the current request get fully loaded. If your client supports this, it's worth enabling before you start disconnecting servers you actually want to keep.

## The point isn't to run fewer servers — it's to run the right ones for the request in front of you

None of this is an argument for minimalism as a virtue in itself. [The MCP ecosystem exists precisely because a broad set of servers is useful](/blog/what-mcp-servers-can-do) — the problem is loading all of it, all the time, into every single request whether or not it's relevant to what you're doing right now. Treat your connected-server list the same way you'd treat any other resource with a real, recurring cost: measure it, prune what's not earning its keep, and scope the rest to the work it's actually for.
