import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSafeSubmissionUrl } from '../../../../lib/urlSafety';

const bodySchema = z.object({
  url: z.string().url(),
});

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function extractMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const propRe = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      'i'
    );
    const propRe2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
      'i'
    );
    const m = html.match(propRe) || html.match(propRe2);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return null;
}

function extractTitle(html: string): string | null {
  const og = extractMeta(html, ['og:title', 'twitter:title']);
  if (og) return og;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? decodeHtmlEntities(m[1].trim()) : null;
}

/**
 * Prefill listing fields from a public website or GitHub repo URL.
 * SSRF-hardened via isSafeSubmissionUrl; response size capped.
 */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid URL required' }, { status: 400 });
    }

    const url = parsed.data.url.trim();
    if (!isSafeSubmissionUrl(url)) {
      return NextResponse.json({ error: 'URL must be a public http(s) address' }, { status: 400 });
    }

    // GitHub repo API path
    const githubMatch = url.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (githubMatch) {
      const owner = githubMatch[1];
      let repo = githubMatch[2];
      if (repo.endsWith('.git')) repo = repo.slice(0, -4);

      const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { 'User-Agent': 'AllMCPs-Directory', Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!ghRes.ok) {
        return NextResponse.json(
          { error: `GitHub returned ${ghRes.status}. Check the repository URL.` },
          { status: 400 }
        );
      }

      const gh = (await ghRes.json()) as {
        name?: string;
        full_name?: string;
        description?: string | null;
        homepage?: string | null;
        html_url?: string;
      };

      return NextResponse.json({
        source: 'github',
        name: gh.name || repo,
        description: gh.description || '',
        url: gh.html_url || url,
        websiteUrl: gh.homepage && isSafeSubmissionUrl(gh.homepage) ? gh.homepage : '',
      });
    }

    // Generic website scrape
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'AllMCPs-Prefill/1.0 (+https://allmcps.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Site returned HTTP ${res.status}` }, { status: 400 });
    }

    const html = (await res.text()).slice(0, 400_000);
    const title = extractTitle(html);
    const description =
      extractMeta(html, ['og:description', 'description', 'twitter:description']) || '';

    let name = title || '';
    // Drop common site suffixes: "Foo — Home", "Foo | MCP Server"
    name = name.split(/\s+[|\-–—]\s+/)[0]?.trim() || name;

    return NextResponse.json({
      source: 'website',
      name,
      description: description.slice(0, 500),
      url,
      websiteUrl: url,
    });
  } catch (e) {
    console.error('Prefill error:', e);
    return NextResponse.json(
      { error: 'Could not fetch that URL. Enter details manually.' },
      { status: 500 }
    );
  }
}
