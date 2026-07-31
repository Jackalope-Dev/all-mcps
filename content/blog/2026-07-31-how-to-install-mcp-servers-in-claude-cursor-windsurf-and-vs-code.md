---
title: "How to Install an MCP Server in Claude, Cursor, Windsurf, and VS Code"
excerpt: "One reference guide to installing Model Context Protocol servers across every major client — the universal config shape, exact file locations, and how to verify your tools loaded."
tags: ["MCP", "Guide", "Claude", "Cursor"]
faq:
  - q: "Is the MCP server config the same across clients?"
    a: "Almost. Claude Desktop, Claude Code, Cursor, and Windsurf all nest servers under an 'mcpServers' key using the same command / args / env shape, so a config that works in one usually works in another with only the file location changed. The exception is VS Code, which nests servers under a 'servers' key and adds an 'inputs' array for prompted secrets — copy a config there and you must rename 'mcpServers' to 'servers'."
  - q: "Do I have to restart my client after adding an MCP server?"
    a: "For GUI clients like Claude Desktop, yes — MCP servers are only launched at startup, so you must fully quit and reopen the app, not just close the window. Cursor and Windsurf can refresh servers from their MCP panel without a full restart, and Claude Code picks up CLI changes immediately."
  - q: "Why does my MCP server connect but show zero tools?"
    a: "The server process started but crashed or errored before it could answer the tools/list request. The usual causes are a missing environment variable, a command that is not on the client's PATH, or the server printing non-JSON text to stdout and corrupting the message stream. Open the client's per-server MCP log to see the real error."
  - q: "Where do I find MCP servers to install?"
    a: "Browse a directory like AllMCPs, which catalogs thousands of MCP servers by category and use case with per-listing install instructions. Each server's page shows the exact command and arguments to paste into your client's config."
---

> **TL;DR:** Every MCP client installs servers the same way at heart — you add a small JSON block naming a command to run, then restart or refresh the client. This guide covers the universal config shape and then the exact file location and steps for Claude Desktop, Claude Code, Cursor, Windsurf, and VS Code, plus how to confirm your tools actually loaded.

The Model Context Protocol (MCP) lets AI clients launch small helper programs — "servers" — that expose tools, resources, and prompts the model can use. Once you have installed one server, you have basically installed them all: the mechanics barely change from client to client. The friction is almost always in two places — where the config file lives, and remembering to restart — so this guide focuses on getting both right.

## What you need before you start

Most MCP servers are distributed as npm or Python packages and launched on demand, so you need one of two runtimes on your machine:

- **Node.js** (which provides `npx`) for JavaScript/TypeScript servers.
- **Python with `uv`** (which provides `uvx`) for many Python servers.

You do not usually install the server package yourself — `npx -y` or `uvx` fetches and runs it the first time your client launches it. You just need the runtime available on the same PATH your client uses, which is the single most common source of setup problems on macOS and Windows.

## The universal config shape

Nearly every client describes a server with three fields: the `command` to run, its `args`, and an optional `env` object for secrets. Here is the canonical stdio block:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"],
      "env": {}
    }
  }
}
```

Keep secrets in `env`, never inline in `args`, and give each server a short, unique name (the key). Once you understand this block, the only per-client differences are the file it goes in and how you reload it.

## Claude Desktop

Claude Desktop reads a JSON file whose fastest access is **Settings → Developer → Edit Config**, which creates the file if it does not exist. The paths are:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add your server under `mcpServers`, save, then **fully quit and reopen** Claude Desktop — closing the window is not enough, because servers launch only at startup. If a server shows zero tools, read the per-server log at `~/Library/Logs/Claude/mcp*.log` (macOS). The full walkthrough lives on the [Claude Desktop setup guide](/clients/claude-desktop).

## Claude Code

Claude Code is CLI-first, so you rarely touch a config file by hand. Add a server with:

```
claude mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/dir
```

Everything after `--` is the launch command. Use `-e KEY=value` for secrets, and `--scope project` to write a shared `.mcp.json` your team commits (or `--scope user` to make it global). Confirm it worked with `claude mcp list`, or the `/mcp` command inside a session. See the [Claude Code setup guide](/clients/claude-code) for scope details.

## Cursor

Cursor reads two files with the same `mcpServers` shape: `~/.cursor/mcp.json` for every project, and `.cursor/mcp.json` in a project root to scope servers to that repository. Add servers from **Cursor Settings → MCP → Add new MCP server**, or edit the JSON directly. Make sure the server is toggled on, and remember that MCP tools are called from the **Agent (Composer)** — not the plain chat. Committing `.cursor/mcp.json` is the easiest way to share servers with a team. Full steps are on the [Cursor setup guide](/clients/cursor).

## Windsurf

Windsurf (Codeium) keeps its config at `~/.codeium/windsurf/mcp_config.json`, again using the `mcpServers` shape. Edit it from the MCP settings inside Cascade or open the file directly, then use the **refresh** action in the MCP panel so Windsurf picks up the change without a full restart. The [Windsurf setup guide](/clients/windsurf) has the details.

## VS Code (GitHub Copilot)

VS Code is the one client that breaks the pattern. It nests servers under a **`servers`** key — not `mcpServers` — in `.vscode/mcp.json`, and supports an `inputs` array so secrets are prompted for instead of hard-coded:

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
    }
  }
}
```

Run **MCP: Add Server** from the Command Palette to scaffold it, then use the tools from **Copilot Chat in Agent mode**. If you copy a config from any other client, rename `mcpServers` to `servers`. The [VS Code setup guide](/clients/vs-code) covers the rest.

## Verifying it worked (and fixing it when it did not)

After adding a server, the checklist is the same everywhere:

1. **Did the client pick it up?** Look for the server in the client's MCP panel or tool list.
2. **Does it show tools, or zero tools?** Zero tools means the process started but errored before responding — check for a missing env var, a command not on PATH, or stray stdout output.
3. **Did you restart or refresh?** GUI clients need a full restart; panel-based clients need a refresh.

If it is still broken, the client's per-server MCP log almost always contains the real error text, which maps directly to one of those causes. For a deeper walkthrough of every failure mode, see our post on why an [MCP server won't connect](/blog/mcp-server-not-connecting-troubleshooting-guide).

## Where to find servers to install

Once you know how to install one, the fun part is deciding which to add. Browse the [AllMCPs directory](/browse) by category, or start from a ranked, use-case guide — the [best MCP servers for databases](/best/databases), [for GitHub and version control](/best/version-control), or [for web search](/best/web-search). Every listing shows the exact command and arguments to paste into the config for your client. And if you want the setup steps for a specific client in one place, the [MCP client setup guides](/clients) have you covered.
