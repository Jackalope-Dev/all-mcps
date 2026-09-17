---
name: mcp-registry
description: Query schemas, installation configs, and category listings for MCP servers.
version: 1.0.0
---

# MCP Server Registry Skill

This skill allows agents to retrieve installation instructions, Claude Desktop configuration snippets, and category trees from AllMCPs.com.

## Endpoints

- **Category Index**: `GET https://allmcps.com/api/v1/search?limit=100`
- **Server Schema & Config**: `GET https://allmcps.com/api/v1/mcp/{serverId}/markdown`
