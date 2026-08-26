import { NextResponse } from 'next/server';

export async function GET() {
  // Only real sitemaps go in Sitemap: lines. llms.txt is agent discovery content,
  // not a sitemap — listing it here confuses GSC and wastes crawl attention.
  // Child shards are listed explicitly so you can submit core/listings first in GSC.
  const content = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /login
Disallow: /verify-request
Disallow: /browse?
# Non-page resources — crawling these only burned budget and filled the
# "Crawled - currently not indexed" report (logo/badge images, JSON/markdown
# API responses). None are meant to rank; keep Googlebot off them so budget
# goes to real listings. (AI crawlers keep their /api allowances below.)
Disallow: /logos/
Disallow: /api/

User-agent: ClaudeBot
User-agent: PerplexityBot
User-agent: Amazonbot
Allow: /
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /data.json
Allow: /api/v1/
Allow: /api/mcp
Disallow: /admin
Disallow: /dashboard
Disallow: /login

# GPTBot, Google-Extended, and Bytespider are training-corpus crawlers first —
# allowing them here would contradict the Content-Signal ai-train=no below.
# (OpenAI/Google/ByteDance's separate retrieval agents — OAI-SearchBot,
# Google-CloudVertexBot's search use, etc. — are not blocked by this rule.)
User-agent: GPTBot
User-agent: Google-Extended
User-agent: Bytespider
Disallow: /

# Content Signals (https://contentsignals.org/ / draft-romm-aipref-contentsignals)
# ai-input=yes: answer engines may ground/cite AllMCPs in generated responses.
# ai-train=no: but the catalog should not be used as model training data.
Content-Signal: ai-train=no, search=yes, ai-input=yes

# Sitemap index (auto-generated) + named shards for prioritised submission.
# Prefer submitting /sitemap/core.xml and /sitemap/listings.xml first in GSC.
Sitemap: https://allmcps.com/sitemap.xml
Sitemap: https://allmcps.com/sitemap/core.xml
Sitemap: https://allmcps.com/sitemap/listings.xml
`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
