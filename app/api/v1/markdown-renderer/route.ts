import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'gpt-tokenizer';
import {
  renderBlogPostMarkdown,
  renderBlogIndexMarkdown,
  renderCategoryMarkdown,
  renderCategoryIndexMarkdown,
} from '@/lib/agentMarkdown';

// This route is always reached via middleware.ts rewriting many different client
// paths (e.g. /blog, /pricing, /categories/{slug}) onto this SAME destination
// pathname, distinguished only by the `path` query param. Route Handlers are
// cached by Next by default, and that cache is keyed by pathname — without this,
// every rewrite target collapses onto whichever response was cached first,
// regardless of `path`. Force fully dynamic, uncached execution per request.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  // middleware.ts passes the target path via this header (see the comment there for
  // why a query param on the rewrite target doesn't reach this handler); the query
  // param fallback just keeps direct/manual calls to this route convenient.
  const path = req.headers.get('x-agent-markdown-path') || searchParams.get('path') || '/';

  const blogPostMatch = path.match(/^\/blog\/([^/]+)\/?$/);
  const categoryMatch = path.match(/^\/categories\/([^/]+)\/?$/);

  let markdown: string | null;

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
  } else if (path === '/blog' || path === '/blog/') {
    markdown = await renderBlogIndexMarkdown();
  } else if (blogPostMatch) {
    markdown = await renderBlogPostMarkdown(blogPostMatch[1]);
  } else if (path === '/categories' || path === '/categories/') {
    markdown = await renderCategoryIndexMarkdown();
  } else if (categoryMatch) {
    markdown = await renderCategoryMarkdown(categoryMatch[1]);
  } else {
    markdown = `# AllMCPs - Path: ${path}

Content requested in Markdown format for AI Agents.

- **URL**: https://allmcps.com${path}
- **API Catalog**: https://allmcps.com/.well-known/api-catalog
- **Documentation**: https://allmcps.com/docs/api
`;
  }

  if (markdown === null) {
    return new NextResponse(`# 404 - Not Found\n\nNo content found for \`${path}\`.\n`, {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
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
