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
# ai-input=yes: answer engines may ground/cite AllMCPs in generated responses.
# ai-train=no: but the catalog should not be used as model training data.
Content-Signal: ai-train=no, search=yes, ai-input=yes

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
