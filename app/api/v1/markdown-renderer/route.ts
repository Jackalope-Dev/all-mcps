import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'gpt-tokenizer';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const path = searchParams.get('path') || '/';

  let markdown = '';

  if (path === '/' || path === '') {
    markdown = `# AllMCPs - The Model Context Protocol Directory & Search Engine

Welcome to AllMCPs.com, the premier index of Model Context Protocol (MCP) servers, web tools, and AI agent integrations.

## Quick Links
- **API Catalog**: [https://allmcps.com/.well-known/api-catalog](file:///.well-known/api-catalog)
- **API Documentation**: [https://allmcps.com/docs/api](file:///docs/api)
- **OpenAPI Spec**: [https://allmcps.com/api/v1/openapi.json](file:///api/v1/openapi.json)
- **Agent Skills**: [https://allmcps.com/.well-known/agent-skills/index.json](file:///.well-known/agent-skills/index.json)
- **MCP Server Card**: [https://allmcps.com/.well-known/mcp/server-card.json](file:///.well-known/mcp/server-card.json)
- **Auth Metadata**: [https://allmcps.com/auth.md](file:///auth.md)

## Categories
- Developer Tools
- Databases & Storage
- Cloud & Infrastructure
- AI & LLM Utilities
- Search & Knowledge Base
- Workflow Automation

## Search API
Perform programmatic queries against our directory:
\`GET https://allmcps.com/api/v1/search?q={query}&category={category}&limit=10\`
`;
  } else {
    markdown = `# AllMCPs - Path: ${path}

Content requested in Markdown format for AI Agents.

- **URL**: https://allmcps.com${path}
- **API Catalog**: https://allmcps.com/.well-known/api-catalog
- **Documentation**: https://allmcps.com/docs/api
`;
  }

  let tokens = 0;
  try {
    tokens = encode(markdown).length;
  } catch {
    tokens = Math.ceil(markdown.length / 4);
  }

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'x-markdown-tokens': tokens.toString(),
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
