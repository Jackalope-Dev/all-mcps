---
name: mcp-search
description: Search and discover Model Context Protocol (MCP) servers across categories, tech stacks, and capabilities on AllMCPs.com.
version: 1.0.0
---

# MCP Server Discovery Skill

This skill enables AI agents to search and filter the AllMCPs directory for relevant MCP servers and tools.

## Endpoints

- **Search Endpoint**: `GET https://allmcps.com/api/v1/search?q={query}&category={category}&limit={limit}`
- **Server Details**: `GET https://allmcps.com/api/v1/servers/{id}`
- **Markdown Format**: Add header `Accept: text/markdown` or append `?format=md` to get lightweight markdown responses.

## Usage Guidelines

1. Use `GET /api/v1/search?q=...` to query servers by keyword or technology (e.g. `postgres`, `github`, `browser`).
2. Parse returned JSON or Markdown to extract server details, configuration snippets, and GitHub repository links.
