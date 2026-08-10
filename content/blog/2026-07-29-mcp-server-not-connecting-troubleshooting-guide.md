---
title: "MCP Server Not Connecting? A Troubleshooting Guide for Every Client"
excerpt: "The most common reasons an MCP server fails to connect, shows zero tools, or crashes on startup — and exactly how to fix each one, across Claude Desktop, Claude Code, Cursor, and other MCP clients."
tags: ["MCP", "Guides"]
faq:
  - q: "Why does my MCP server show up in the client but with zero tools?"
    a: "This almost always means the server process started but crashed or errored before it could respond to the tools/list request — usually from a missing environment variable, an unhandled exception in the server's startup code, or the server writing non-JSON text to stdout and corrupting the message stream. Check the client's MCP log for the specific server, not just the general app log."
  - q: "Why do I get 'spawn npx ENOENT' when adding an MCP server?"
    a: "The client can't find npx on the PATH it uses to launch subprocesses. GUI apps on macOS and Windows often start with a minimal PATH that doesn't include the one your terminal has (from nvm, fnm, Homebrew, etc.). Fix it by using the absolute path to npx/node in the command field, or by launching the client from a terminal so it inherits your shell's environment."
  - q: "Do I need to restart my MCP client after editing the config file?"
    a: "Yes, for almost every client. MCP servers are typically only launched or reloaded on startup, so config edits made while the app is running are silently ignored until you fully quit and reopen it — not just close the window."
  - q: "Why did my MCP server work yesterday and fail today with no config changes?"
    a: "Common causes are an expired or rotated API token the server depends on, an upstream dependency (a database, a remote API) being unreachable, a package manager cache serving a broken version after an unrelated npx/uvx cache clear, or an OS update changing which Node/Python version is first on the PATH."
---

> **TL;DR:** Nearly every "MCP server won't connect" problem falls into one of five buckets: a malformed config file, a PATH issue that makes the launch command unfindable, a server that crashes before it can respond, output on stdout corrupting the JSON-RPC stream, or a client that hasn't been restarted since the config changed. This guide walks through each failure mode with the exact error text to look for and the fix, plus where to find logs for the major MCP clients.

## Start by finding the actual error, not the symptom

"It's not working" can mean several different things to an MCP client, and each one points at a different layer of the stack:

- The server never appears in the tool list at all.
- The server appears but shows **0 tools**.
- The server appears, then flips to a **disconnected** or **error** state a few seconds after startup.
- Individual tool calls fail even though the server connected fine.

Before changing anything, find the client's MCP-specific log file rather than relying on the UI status dot — the UI usually just says "error" or "disconnected," while the log contains the actual stderr output or exception from the server process. A few common locations:

- **Claude Desktop (macOS):** `~/Library/Logs/Claude/mcp*.log` — one file per server, plus `mcp.log` for the client-side connection log.
- **Claude Desktop (Windows):** `%APPDATA%\Claude\logs\mcp*.log`
- **Claude Code:** run with `claude --debug` for verbose MCP connection output in the terminal, or check `~/.claude/logs/`.
- **Cursor:** the MCP panel in Settings shows a per-server status and a small log viewer inline — click the server entry to expand it.

Once you have the real error text, it almost always maps directly to one of the sections below.

## The config file itself is invalid

`mcpServers` config blocks are hand-edited JSON, and a single stray comma is enough to make the whole file fail to parse — which typically means **none** of your servers load, not just the one you just edited. Trailing commas, missing closing braces, and smart quotes pasted in from a doc or webpage are the usual culprits.

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/projects"],
    }
  }
}
```

That trailing comma after the `args` array is invalid JSON and will silently break the entire config in most parsers. Run the file through a JSON linter, or paste it into a dedicated [MCP config validator](/tools/config-validator) that understands the `mcpServers` shape specifically — a generic JSON linter will catch syntax errors but won't flag things like a missing `command` field or an args array that isn't actually an array of strings. If you're building the config from scratch, a [config generator](/tools/config-generator) avoids the hand-editing step entirely.

Also double-check you edited the **file the client actually reads**. It's easy to edit a config in the wrong directory, or to have a stale copy open in an editor that autosaves over your changes after you've already fixed the real file.

## "spawn npx ENOENT" and other PATH errors

This is the single most common MCP setup failure, and it's an environment issue, not a config issue. GUI applications on macOS and Windows are frequently launched by the OS with a minimal `PATH` — one that doesn't include whatever your terminal's shell profile (`.zshrc`, `.bashrc`, nvm/fnm init scripts) adds. Your terminal can find `npx` just fine; the app that spawns the MCP server subprocess can't, because it never sourced your shell profile.

The error surfaces as something like:

```
Error: spawn npx ENOENT
```

or, for Python-based servers launched with `uvx`:

```
Error: spawn uvx ENOENT
```

Two reliable fixes:

1. **Use an absolute path** to the binary instead of relying on PATH resolution. Run `which npx` (macOS/Linux) or `where npx` (Windows) in your terminal, then use that full path as the `command` value in your config.
2. **Launch the client from a terminal**, if that's supported (`open -a Claude` on macOS still won't inherit shell env the same way — this trick is more reliable for terminal-based clients like Claude Code than for GUI apps).

If you manage Node versions with nvm, fnm, or volta, this is worth checking first — it's the root cause behind a large share of "it works on my machine but not in the app" reports.

## The server connects, then immediately disconnects

If a server shows connected briefly and then drops, the process is almost always crashing on startup — usually before it finishes the MCP handshake. Check the server's stderr log for an uncaught exception, and look specifically for:

- A missing required environment variable (an API key or database URL the server expects but the config didn't set via an `env` block).
- A version mismatch between the server's SDK and the protocol version the client speaks — older servers built against early MCP SDK versions can fail the `initialize` handshake against a newer client.
- The working directory the process actually launches in not being what you assumed — a server that reads a relative-path config file may behave differently launched by your client than launched by hand from your project folder.

Reproduce it directly: copy the exact `command` and `args` from your config and run them by hand in a terminal. If it crashes there too, you'll see the full stack trace instead of a truncated client-side error, which usually makes the fix obvious.

## Corrupted JSON-RPC stream (stdio servers only)

Stdio-transport servers communicate over stdin/stdout, which means **stdout is a reserved channel for protocol messages only**. If the server (or a library it imports) writes anything else to stdout — a stray `console.log`, a startup banner from a dependency, a warning printed by an unrelated package — it corrupts the JSON-RPC stream and the client can't parse subsequent messages. This usually shows up as intermittent, hard-to-reproduce parse errors rather than a clean failure.

The fix is strict: all logging in a stdio server must go to `stderr`, never `stdout`. In Node this means using `console.error` for every diagnostic message, including ones that feel harmless like a "server started" banner. In Python, direct any `print()` debugging output to `sys.stderr` or disable it entirely before shipping.

## Remote (SSE / Streamable HTTP) servers have their own failure modes

Everything above applies to local stdio servers. Remote servers add a few more:

- **CORS and auth headers.** A browser-based MCP client enforces CORS; a desktop client typically doesn't, so a server that works from one client can fail from another purely because of missing `Access-Control-Allow-Origin` handling.
- **Session ID mismatches.** SSE transport issues a session identifier on the initial connection; if a proxy or load balancer in front of the server doesn't route follow-up POST requests to the same backend instance, the session breaks mid-conversation.
- **Expired or missing bearer tokens.** Unlike stdio, where auth is implicit via OS process ownership, remote servers need an explicit token in the config, and that token can expire independently of anything you changed locally.

## A quick checklist before you open an issue

1. Validate the config JSON itself, not just the values inside it.
2. Fully quit and restart the client — most don't hot-reload config changes.
3. Run the exact `command`/`args` by hand in a terminal to see the real crash output.
4. Confirm nothing in the server writes to stdout on a stdio transport.
5. Check the server's own repository for open issues matching your error text — a fast-moving ecosystem means today's bug might already have a fix merged since the version you installed.

If the server is listed on [AllMCPs](/browse), its listing page shows when it was last checked and whether other users have reported it as broken — a quick way to tell whether the problem is on your end or the server's before you spend an hour debugging a bug that's already been reported upstream. And if you're building a server yourself rather than just installing one, our [guide to architecting production MCP servers](/blog/2026-07-28-architecting-production-mcp-servers) covers the stdout/stderr and error-boundary conventions that prevent most of these failures in the first place.

Built by [Jackalope Digital](https://jackalope.digital). Give your AI agents superpowers.
</content>
