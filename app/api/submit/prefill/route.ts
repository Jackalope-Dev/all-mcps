import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  DEFAULT_SUBMIT_CATEGORY,
  DIRECTORY_CATEGORIES,
} from '../../../../lib/categories';
import { chatJson } from '../../../../lib/openai';
import {
  AUTH_TYPES,
  isAuthType,
  isMaintenanceStatus,
  isPricingModel,
  MAINTENANCE_STATUSES,
  PRICING_MODELS,
} from '../../../../lib/serverEnums';
import { findExistingListingByUrl } from '../../../../lib/urlDedup';
import { isSafeSubmissionUrl } from '../../../../lib/urlSafety';

const bodySchema = z.object({
  url: z.string().url(),
});

type PrefillEnrichment = {
  name?: string;
  description?: string;
  category?: string;
  pricingModel?: string;
  authType?: string;
  license?: string;
  maintenanceStatus?: string;
};

/**
 * Optional LLM polish for name/description/category + soft-infer enums.
 * Soft-fails on budget/4xx so prefill never depends on OpenAI availability.
 */
async function enrichWithLlm(input: {
  name: string;
  description: string;
  url: string;
  readmeSnippet?: string;
}): Promise<PrefillEnrichment | null> {
  const categories = DIRECTORY_CATEGORIES.slice(0, 40).join('\n');
  const result = await chatJson<{
    name?: string;
    description?: string;
    category?: string;
    pricingModel?: string;
    authType?: string;
    license?: string;
    maintenanceStatus?: string;
  }>({
    model: 'gpt-5.6-luna',
    maxTokens: 500,
    timeoutMs: 12_000,
    messages: [
      {
        role: 'system',
        content:
          'You clean MCP server listing fields for a directory. Return JSON only with keys: name, description, category, pricingModel, authType, license, maintenanceStatus. description max 280 chars, plain text. category must match the allowed list when possible. pricingModel one of: free|freemium|paid|byok (omit if unsure). authType one of: none|api_key|oauth|other (omit if unsure). license short string like MIT or Apache-2.0 (omit if unsure). maintenanceStatus one of: active|stable|experimental|archived (omit if unsure).',
      },
      {
        role: 'user',
        content: `URL: ${input.url}\nName: ${input.name}\nDescription: ${input.description}\n${
          input.readmeSnippet
            ? `README excerpt:\n${input.readmeSnippet.slice(0, 2500)}\n`
            : ''
        }\nAllowed categories (prefer exact match):\n${categories}\nDefault category if unsure: ${DEFAULT_SUBMIT_CATEGORY}\nAllowed pricingModel: ${PRICING_MODELS.join(
          ', ',
        )}\nAllowed authType: ${AUTH_TYPES.join(', ')}\nAllowed maintenanceStatus: ${MAINTENANCE_STATUSES.join(
          ', ',
        )}`,
      },
    ],
  });

  if (!result.ok) {
    // Budget / rate / auth — silent fallthrough; deterministic scrape still wins.
    return null;
  }

  const data = result.data;
  const out: PrefillEnrichment = {};
  if (typeof data.name === 'string' && data.name.trim())
    out.name = data.name.trim().slice(0, 120);
  if (typeof data.description === 'string' && data.description.trim()) {
    out.description = data.description.trim().slice(0, 500);
  }
  if (typeof data.category === 'string') {
    const match = DIRECTORY_CATEGORIES.find(
      (c) => c.toLowerCase() === data.category!.trim().toLowerCase(),
    );
    if (match) out.category = match;
  }
  if (isPricingModel(data.pricingModel)) out.pricingModel = data.pricingModel;
  if (isAuthType(data.authType)) out.authType = data.authType;
  if (isMaintenanceStatus(data.maintenanceStatus))
    out.maintenanceStatus = data.maintenanceStatus;
  if (typeof data.license === 'string' && data.license.trim()) {
    out.license = data.license.trim().slice(0, 60);
  }
  return Object.keys(out).length ? out : null;
}

function decodeHtmlEntities(input: string): string {
  // &amp; goes last: decoding it first would turn a literal "&amp;lt;" into
  // "&lt;" and then into "<", unescaping the text twice.
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

function extractMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const propRe = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      'i',
    );
    const propRe2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
      'i',
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
      return NextResponse.json(
        { error: 'Valid URL required' },
        { status: 400 },
      );
    }

    const url = parsed.data.url.trim();
    if (!isSafeSubmissionUrl(url)) {
      return NextResponse.json(
        { error: 'URL must be a public http(s) address' },
        { status: 400 },
      );
    }

    // Catch duplicates before spending a GitHub/LLM call on them — matches
    // against any existing listing regardless of status, so resubmitting a
    // 'removed' (dead-link) listing's URL surfaces a claim CTA instead of
    // silently piling up a second row for the same server.
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const ctx = await getCloudflareContext();
      if (ctx?.env && (ctx.env as any).DB) {
        const db = drizzle((ctx.env as any).DB);
        const existing = await findExistingListingByUrl(db, url);
        if (existing) {
          return NextResponse.json({ duplicate: true, existing });
        }
      }
    } catch (e) {
      console.error('Duplicate check failed (continuing without it):', e);
    }

    // GitHub repo API path
    const githubMatch = url.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (githubMatch) {
      const owner = githubMatch[1];
      let repo = githubMatch[2];
      if (repo.endsWith('.git')) repo = repo.slice(0, -4);

      const ghRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            'User-Agent': 'AllMCPs-Directory',
            Accept: 'application/vnd.github+json',
          },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!ghRes.ok) {
        return NextResponse.json(
          {
            error: `GitHub returned ${ghRes.status}. Check the repository URL.`,
          },
          { status: 400 },
        );
      }

      const gh = (await ghRes.json()) as {
        name?: string;
        full_name?: string;
        description?: string | null;
        homepage?: string | null;
        html_url?: string;
      };

      const base = {
        source: 'github' as const,
        name: gh.name || repo,
        description: gh.description || '',
        url: gh.html_url || url,
        websiteUrl:
          gh.homepage && isSafeSubmissionUrl(gh.homepage) ? gh.homepage : '',
      };

      // Best-effort README snippet for pricing/auth/license inference (soft-fail).
      let readmeSnippet = '';
      try {
        const readmeRes = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`,
          {
            headers: { 'User-Agent': 'AllMCPs-Directory' },
            signal: AbortSignal.timeout(6000),
          },
        );
        if (readmeRes.ok)
          readmeSnippet = (await readmeRes.text()).slice(0, 4000);
      } catch {
        /* ignore */
      }

      const enriched = await enrichWithLlm({
        name: base.name,
        description: base.description,
        url: base.url,
        readmeSnippet,
      });
      return NextResponse.json({
        ...base,
        ...(enriched || {}),
        llmEnriched: Boolean(enriched),
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
      return NextResponse.json(
        { error: `Site returned HTTP ${res.status}` },
        { status: 400 },
      );
    }

    const html = (await res.text()).slice(0, 400_000);
    const title = extractTitle(html);
    const description =
      extractMeta(html, [
        'og:description',
        'description',
        'twitter:description',
      ]) || '';

    let name = title || '';
    // Drop common site suffixes: "Foo — Home", "Foo | MCP Server"
    name = name.split(/\s+[|\-–—]\s+/)[0]?.trim() || name;

    const base = {
      source: 'website' as const,
      name,
      description: description.slice(0, 500),
      url,
      websiteUrl: url,
    };
    const enriched = await enrichWithLlm({
      name: base.name,
      description: base.description,
      url: base.url,
      readmeSnippet: html.replace(/<[^>]+>/g, ' ').slice(0, 2500),
    });
    return NextResponse.json({
      ...base,
      ...(enriched || {}),
      llmEnriched: Boolean(enriched),
    });
  } catch (e) {
    console.error('Prefill error:', e);
    return NextResponse.json(
      { error: 'Could not fetch that URL. Enter details manually.' },
      { status: 500 },
    );
  }
}
