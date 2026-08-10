---
title: "Writing MCP Tool Descriptions That Actually Get Picked"
excerpt: "The model never reads your code — only your tool's name, description, and schema. A practical guide to writing MCP tool descriptions that get selected correctly, with the arguments filled in right, every time."
tags: ["MCP", "Developer Tools", "Guides"]
faq:
  - q: "What makes a good MCP tool description?"
    a: "A good description states what the tool does, when to use it (and when not to), what it returns, and any constraints the model needs to respect — units, formats, side effects, and rate limits. It's written for a model deciding whether to call the tool, not for a human reading API docs."
  - q: "How long should an MCP tool description be?"
    a: "As long as it needs to be to remove ambiguity, and no longer. A single unambiguous tool in a small toolset might need one sentence. A tool that's easy to confuse with a sibling tool, or that has real side effects, needs a full paragraph covering scope and constraints. Padding a description with marketing language wastes context and adds noise the model has to filter out."
  - q: "Should parameter descriptions repeat the tool description?"
    a: "No. The tool description covers what the tool does and when to use it; each parameter description covers that one argument only — its format, units, valid range, and what happens with missing or default values. Redundant restating of the tool's purpose in every parameter just burns tokens without adding information."
  - q: "How do I test whether a tool description works?"
    a: "Build a small golden set of realistic prompts and run them against your server with the model you expect people to use. For each prompt, check three things: did it pick the right tool, did it pick it over a similar sibling tool, and did it fill in the arguments correctly. Re-run the set whenever you touch a description, not just when you touch the code."
---

> **TL;DR:** An MCP tool's description is the only interface the model actually sees — it never reads your implementation. If the description is vague, redundant with the tool name, or missing the constraints that matter, the model will pick the wrong tool, call the right tool with wrong arguments, or not call it at all. This guide covers what belongs in a tool description, what belongs in parameter descriptions instead, the mistakes that cause misfires, and how to test that your descriptions actually work before you ship.

Most MCP servers get their tool descriptions written last, in five minutes, after the actual handler code is done. That ordering is backwards. The handler code is invisible to the model — it only ever sees the tool's `name`, `description`, and JSON schema. Everything the model knows about what your tool does, when to use it, and how to call it correctly has to live in those three fields.

Get the description wrong and the failure mode isn't a stack trace — it's silent. The model picks a different tool that sounds close enough, or calls your tool with the wrong units, or skips it entirely because it couldn't tell your tool apart from three similar ones in the same server. None of that shows up in your logs as an error. It shows up as a user saying "it didn't do what I asked."

## What the model is actually deciding

Every time a model considers your tool, it's answering three questions from the description and schema alone:

1. Does this tool do what I need right now?
2. Is this the *best* tool for that, or is there a sibling tool that fits better?
3. What arguments does a correct call need?

A description that only answers question one is incomplete. If your server exposes `search_users` and `search_users_by_email`, and both descriptions just say "searches users," the model is guessing between them. The description's job is to disambiguate, not just describe.

## Anatomy of a description that works

A description that reliably gets picked and called correctly covers four things, roughly in this order:

- **What it does.** One clear sentence, active voice, no jargon the model has to decode.
- **When to use it** — and, if there's a similar tool nearby, when *not* to use it. This is the line most descriptions skip, and it's the one that prevents tool confusion.
- **What it returns.** Shape and units matter here — "returns temperature" is worse than "returns temperature in Celsius."
- **Constraints that change behavior.** Side effects ("this modifies the file on disk"), rate limits, required preconditions ("call `list_projects` first to get a valid `project_id`"), and anything that would make a call fail silently or expensively if ignored.

You don't need all four in every description. A single unambiguous read-only tool in a small toolset can get away with one sentence. A tool with side effects, or one that's easy to confuse with a neighbor, needs the full treatment.

## Descriptions vs parameter docs — different jobs

The tool description sets scope and intent. Each parameter's own `description` field covers that one argument: format, units, valid range, and what happens if it's omitted. A common mistake is restating the tool's purpose inside every parameter description — it burns context on every single tool-call the model considers, across every tool in the session, for zero added information. Put "what" and "when" in the tool description. Put "how, exactly, for this one field" in the parameter.

```json
{
  "name": "convert_currency",
  "description": "Converts an amount from one currency to another using current exchange rates. Use this for currency conversion only — for historical rate lookups, use get_exchange_rate_history instead.",
  "inputSchema": {
    "properties": {
      "amount": {
        "type": "number",
        "description": "The amount to convert, in the source currency's smallest display unit (e.g. dollars, not cents)."
      },
      "from": {
        "type": "string",
        "description": "ISO 4217 currency code, e.g. USD."
      },
      "to": {
        "type": "string",
        "description": "ISO 4217 currency code, e.g. EUR."
      }
    }
  }
}
```

Notice the tool description explicitly rules out a neighboring tool (`get_exchange_rate_history`). That one clause does more to prevent misfires than any amount of extra detail about what "conversion" means.

## The mistakes that cause misfires

- **Restating the name.** A tool named `delete_file` with the description "Deletes a file" adds nothing. Say what makes it different: does it require confirmation, is it recoverable, does it fail on directories?
- **Internal jargon.** "Invokes the v2 ingestion pipeline" means nothing to a model (or a human) without more context on what ingestion means here and when you'd want it.
- **Missing the "don't use this for" case.** If your server has two tools that could plausibly handle the same request, and only one is correct, say so directly in both descriptions.
- **Burying constraints in the README instead of the description.** The model doesn't read your README. If calling a tool without first calling another tool will fail, that precondition belongs in the description, not just your docs site.
- **Marketing language.** "Powerful, blazing-fast search across your entire workspace" tells the model nothing actionable and wastes tokens across every request in the session.

## Testing it, not just writing it

Treat descriptions as testable behavior, the same way you'd test handler logic — see our [guide to testing and debugging MCP servers](/blog/testing-and-debugging-mcp-servers) for the full pyramid. The layer that matters most for descriptions specifically is a small golden set: five to fifteen realistic prompts covering the tools people will actually reach for, including the ones that are easy to confuse with each other. Run the set, and for each prompt check whether the right tool got picked, whether it beat a similar sibling tool, and whether the arguments came out correct. Re-run it whenever a description changes — a wording tweak that looks harmless to a human can shift which tool a model reaches for.

## A pre-publish checklist

Before you publish a server, read every tool description as if you were the model, with no access to the code:

- [ ] Could I tell this tool apart from every other tool in the server using only its name and description?
- [ ] Do I know what units, formats, or IDs each parameter expects without guessing?
- [ ] Do I know what happens if I call this without a required precondition?
- [ ] Is there a sentence here that's marketing copy instead of information?

If any answer is no, the description isn't done — regardless of whether the handler code is.
