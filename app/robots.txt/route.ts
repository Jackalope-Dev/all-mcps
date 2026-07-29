import { NextResponse } from 'next/server';

export async function GET() {
  const content = `User-agent: *
Allow: /
Disallow: /admin

User-agent: GPTBot
User-agent: ClaudeBot
User-agent: PerplexityBot
User-agent: Google-Extended
User-agent: Amazonbot
User-agent: Bytespider
Allow: /
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /api/v1/
Allow: /api/mcp
Disallow: /admin

# Content Signals (https://contentsignals.org/ / draft-romm-aipref-contentsignals)
Content-Signal: ai-train=no, search=yes, ai-input=no

Sitemap: https://allmcps.com/sitemap.xml
Sitemap: https://allmcps.com/llms.txt
`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
