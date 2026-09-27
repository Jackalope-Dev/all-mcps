import { encode } from 'gpt-tokenizer';
import { type NextRequest, NextResponse } from 'next/server';
import {
  renderAlternativesMarkdown,
  renderBestIndexMarkdown,
  renderBestTopicMarkdown,
  renderBlogIndexMarkdown,
  renderBlogPostMarkdown,
  renderCategoryIndexMarkdown,
  renderCategoryMarkdown,
  renderClientIndexMarkdown,
  renderClientMarkdown,
  renderCompareMarkdown,
  renderPromptIndexMarkdown,
  renderPromptMarkdown,
} from '@/lib/agentMarkdown';

// This route is always reached via middleware.ts rewriting many different client
// paths (e.g. /blog, /pricing, /categories/{slug}) onto this SAME destination
// pathname, distinguished by the x-agent-markdown-path request header middleware
// sets on the rewrite (see middleware.ts for why — a query param on the rewrite
// target doesn't reach this handler). Force fully dynamic, uncached execution so
// Next never serves a cached response for one path in place of another.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HOME_MARKDOWN = `# AllMCPs - The Model Context Protocol Directory & Search Engine

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

async function resolveMarkdownForPath(path: string): Promise<string | null> {
  const normalized = path.replace(/\/+$/, '') || '/';

  if (normalized === '/') {
    return HOME_MARKDOWN;
  }
  if (normalized === '/blog') {
    return renderBlogIndexMarkdown();
  }
  const blogPostMatch = normalized.match(/^\/blog\/([^/]+)$/);
  if (blogPostMatch) {
    return renderBlogPostMarkdown(blogPostMatch[1]);
  }
  if (normalized === '/categories') {
    return renderCategoryIndexMarkdown();
  }
  const categoryMatch = normalized.match(/^\/categories\/([^/]+)$/);
  if (categoryMatch) {
    return renderCategoryMarkdown(categoryMatch[1]);
  }
  if (normalized === '/best') {
    return renderBestIndexMarkdown();
  }
  const bestTopicMatch = normalized.match(/^\/best\/([^/]+)$/);
  if (bestTopicMatch) {
    return renderBestTopicMarkdown(bestTopicMatch[1]);
  }
  if (normalized === '/clients') {
    return renderClientIndexMarkdown();
  }
  const clientMatch = normalized.match(/^\/clients\/([^/]+)$/);
  if (clientMatch) {
    return renderClientMarkdown(clientMatch[1]);
  }
  if (normalized === '/prompts') {
    return renderPromptIndexMarkdown();
  }
  const promptMatch = normalized.match(/^\/prompts\/([^/]+)$/);
  if (promptMatch) {
    return renderPromptMarkdown(promptMatch[1]);
  }
  const compareMatch = normalized.match(/^\/mcp\/([^/]+)\/vs\/([^/]+)$/);
  if (compareMatch) {
    return renderCompareMarkdown(compareMatch[1], compareMatch[2]);
  }
  const alternativesMatch = normalized.match(/^\/mcp\/([^/]+)\/alternatives$/);
  if (alternativesMatch) {
    return renderAlternativesMarkdown(alternativesMatch[1]);
  }

  return `# AllMCPs - Path: ${normalized}

Content requested in Markdown format for AI Agents.

- **URL**: https://allmcps.com${normalized}
- **API Catalog**: https://allmcps.com/.well-known/api-catalog
- **Documentation**: https://allmcps.com/docs/api
`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  // middleware.ts passes the target path via this header (see the comment there for
  // why a query param on the rewrite target doesn't reach this handler); the query
  // param fallback just keeps direct/manual calls to this route convenient.
  const rawPath =
    req.headers.get('x-agent-markdown-path') || searchParams.get('path') || '/';
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  const markdown = await resolveMarkdownForPath(path);

  if (markdown === null) {
    return new NextResponse(
      `# 404 - Not Found\n\nNo content found for \`${path}\`.\n`,
      {
        status: 404,
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      },
    );
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
