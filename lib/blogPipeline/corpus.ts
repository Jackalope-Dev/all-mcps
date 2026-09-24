/**
 * The pipeline's picture of "what the site already covers": the content_index
 * table plus the helpers that keep it current and query it.
 *
 * Sources, in order of authority:
 * 1. Code-defined hubs (/best/*, /clients/*, evergreen guides, free tools) — these
 *    own head terms, so a blog post must never compete with them.
 * 2. Published blog posts from the bundled blog manifest (the same data the
 *    /blog routes render from).
 * 3. In-flight drafts, so two drafts on the same topic can't both be written
 *    before the first one is exported and deployed.
 * 4. Anything POSTed to /api/cron/blog-corpus (kind 'external' or any other).
 */

import { eq, inArray, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { contentIndex } from '../../db/schema';
import { BEST_TOPICS } from '../bestTopics';
import blogManifest from '../blog-manifest.json';
import { MCP_CLIENTS } from '../clients';
import {
  cosineSimilarity,
  keywordOverlap,
  shingleContainment,
  shingles,
  textHash,
} from './similarity';

export type CorpusKind =
  | 'blog'
  | 'guide'
  | 'best'
  | 'client'
  | 'tool'
  | 'draft'
  | 'external';

export type CorpusDoc = {
  url: string;
  kind: CorpusKind | string;
  title: string;
  primaryKeyword?: string | null;
  excerpt?: string | null;
};

export type CorpusEntry = CorpusDoc & { embedding: number[] | null };

/**
 * Evergreen pages that are not generated from data. Primary keywords are the
 * head terms each page is built to rank for — keep in sync when a guide is
 * added (AGENTS.md "Also keep in sync when adding a new evergreen guide").
 */
export const STATIC_CORPUS: CorpusDoc[] = [
  {
    url: '/what-is-mcp',
    kind: 'guide',
    title: 'What is Model Context Protocol? (MCP Guide)',
    primaryKeyword: 'what is model context protocol',
  },
  {
    url: '/guide',
    kind: 'guide',
    title: 'LLM Agents Setup & Configuration Guide',
    primaryKeyword: 'mcp setup configuration guide',
  },
  {
    url: '/build-mcp-server',
    kind: 'guide',
    title: 'How to Build an MCP Server (Developer Guide)',
    primaryKeyword: 'how to build an mcp server',
  },
  {
    url: '/deploy-mcp-server',
    kind: 'guide',
    title: 'Deploying & Hosting Remote MCP Servers Guide',
    primaryKeyword: 'deploy remote mcp server hosting',
  },
  {
    url: '/mcp-security',
    kind: 'guide',
    title: 'MCP Security Best Practices: A Complete Guide',
    primaryKeyword: 'mcp security best practices',
  },
  {
    url: '/mcp-troubleshooting',
    kind: 'guide',
    title: 'MCP Troubleshooting: Connection & Timeout Fixes',
    primaryKeyword: 'mcp troubleshooting connection timeout',
  },
  {
    url: '/mcp-protocol-versioning',
    kind: 'guide',
    title: 'MCP Protocol Versioning Explained',
    primaryKeyword: 'mcp protocol version',
  },
  {
    url: '/mcp-transports',
    kind: 'guide',
    title: 'MCP Transports Explained: stdio vs Streamable HTTP',
    primaryKeyword: 'mcp transports stdio streamable http',
  },
  {
    url: '/mcp-for-seo',
    kind: 'guide',
    title: 'Using MCP for SEO & AEO Automation',
    primaryKeyword: 'mcp for seo aeo automation',
  },
  {
    url: '/state-of-mcp',
    kind: 'guide',
    title: 'State of MCP: Ecosystem Statistics',
    primaryKeyword: 'mcp ecosystem statistics',
  },
  {
    url: '/tools/openapi-to-mcp',
    kind: 'tool',
    title: 'OpenAPI to MCP Code Generator',
    primaryKeyword: 'openapi to mcp generator',
  },
  {
    url: '/tools/protocol-inspector',
    kind: 'tool',
    title: 'MCP Protocol Inspector & Response Debugger',
    primaryKeyword: 'mcp inspector debugger',
  },
  {
    url: '/tools/config-generator',
    kind: 'tool',
    title: 'MCP Config Generator for Claude, Cursor & VS Code',
    primaryKeyword: 'mcp config generator',
  },
  {
    url: '/tools/config-validator',
    kind: 'tool',
    title: 'MCP Config Validator',
    primaryKeyword: 'mcp config validator json',
  },
  {
    url: '/tools/token-calculator',
    kind: 'tool',
    title: 'MCP Token Cost Calculator',
    primaryKeyword: 'mcp token cost calculator',
  },
  {
    url: '/tools/config-auditor',
    kind: 'tool',
    title: 'MCP Config Auditor & Merger',
    primaryKeyword: 'mcp config merge audit',
  },
  {
    url: '/tools/playground',
    kind: 'tool',
    title: 'Interactive MCP Server Playground',
    primaryKeyword: 'mcp server playground',
  },
];

type ManifestPost = {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  date: string;
  content: string;
};

/** Published posts as bundled into the Worker (future-dated posts excluded). */
export function publishedPosts(): ManifestPost[] {
  const today = new Date().toISOString().slice(0, 10);
  return (blogManifest as ManifestPost[]).filter((p) => p.date <= today);
}

/** Every code-known page the pipeline must respect, derived from live data modules. */
export function codeCorpus(): CorpusDoc[] {
  const docs: CorpusDoc[] = [...STATIC_CORPUS];
  for (const t of BEST_TOPICS) {
    docs.push({
      url: `/best/${t.slug}`,
      kind: 'best',
      title: `Best ${t.title} MCP Servers`,
      primaryKeyword: `best ${t.title.toLowerCase()} mcp server`,
      excerpt: t.lead,
    });
  }
  for (const c of MCP_CLIENTS) {
    docs.push({
      url: `/clients/${c.slug}`,
      kind: 'client',
      title: `How to Add MCP Servers to ${c.name}`,
      primaryKeyword: `${c.name.toLowerCase()} mcp setup`,
      excerpt: c.lead,
    });
  }
  for (const p of publishedPosts()) {
    docs.push({
      url: `/blog/${p.slug}`,
      kind: 'blog',
      title: p.title,
      // Posts predate the pipeline and carry no explicit keyword; the title is
      // the best available proxy for the query it targets.
      primaryKeyword: p.title,
      excerpt: p.excerpt,
    });
  }
  return docs;
}

/** The text embedded for a doc — title, keyword and excerpt carry its query intent. */
export function embeddingText(doc: CorpusDoc): string {
  return [doc.title, doc.primaryKeyword, doc.excerpt]
    .filter(Boolean)
    .join('. ')
    .slice(0, 1500);
}

const EMBED_MODEL = '@cf/baai/bge-small-en-v1.5';
const EMBED_BATCH = 20;

/** Batch-embed with Workers AI. Returns null entries on failure (fail-soft). */
export async function embedTexts(
  ai: Ai | undefined,
  texts: string[],
): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = texts.map(() => null);
  if (!ai || texts.length === 0) return out;
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    try {
      const res = (await (ai as any).run(EMBED_MODEL, { text: batch })) as {
        data?: number[][];
      };
      batch.forEach((_, j) => {
        const vec = res?.data?.[j];
        if (Array.isArray(vec)) out[i + j] = vec;
      });
    } catch (error) {
      console.error('[blogPipeline] embedding batch failed', error);
    }
  }
  return out;
}

function roundVector(vec: number[]): number[] {
  return vec.map((v) => Math.round(v * 1e5) / 1e5);
}

/**
 * Upsert docs into content_index, embedding only rows whose text changed.
 * Returns how many rows were (re-)embedded.
 */
export async function upsertCorpusDocs(
  db: DrizzleD1Database,
  ai: Ai | undefined,
  docs: CorpusDoc[],
): Promise<number> {
  if (docs.length === 0) return 0;
  const existing = new Map<string, string>();
  for (let i = 0; i < docs.length; i += 80) {
    const urls = docs.slice(i, i + 80).map((d) => d.url);
    const rows = await db
      .select({
        url: contentIndex.url,
        hash: contentIndex.contentHash,
        hasEmbedding: sql<number>`${contentIndex.embedding} IS NOT NULL`,
      })
      .from(contentIndex)
      .where(inArray(contentIndex.url, urls));
    for (const r of rows) if (r.hasEmbedding) existing.set(r.url, r.hash);
  }

  const changed = docs.filter(
    (d) => existing.get(d.url) !== textHash(`${d.kind}|${embeddingText(d)}`),
  );
  if (changed.length === 0) return 0;

  const vectors = await embedTexts(ai, changed.map(embeddingText));
  const now = new Date();
  for (let i = 0; i < changed.length; i++) {
    const d = changed[i];
    const vec = vectors[i];
    const row = {
      url: d.url,
      kind: d.kind,
      title: d.title.slice(0, 300),
      primaryKeyword: d.primaryKeyword?.slice(0, 200) ?? null,
      excerpt: d.excerpt?.slice(0, 600) ?? null,
      embedding: vec ? JSON.stringify(roundVector(vec)) : null,
      // Unembedded rows keep an empty hash so the next sync retries them.
      contentHash: vec ? textHash(`${d.kind}|${embeddingText(d)}`) : '',
      updatedAt: now,
    };
    await db
      .insert(contentIndex)
      .values(row)
      .onConflictDoUpdate({ target: contentIndex.url, set: row });
  }
  return changed.length;
}

/** Sync code-known pages; removes blog rows whose post no longer exists. */
export async function syncCodeCorpus(
  db: DrizzleD1Database,
  ai: Ai | undefined,
): Promise<{ embedded: number; removed: number }> {
  const docs = codeCorpus();
  const embedded = await upsertCorpusDocs(db, ai, docs);
  const known = new Set(docs.map((d) => d.url));
  const stale = (
    await db
      .select({ url: contentIndex.url })
      .from(contentIndex)
      .where(
        inArray(contentIndex.kind, ['blog', 'guide', 'best', 'client', 'tool']),
      )
  )
    .map((r) => r.url)
    .filter((u) => !known.has(u));
  for (const url of stale) {
    await db.delete(contentIndex).where(eq(contentIndex.url, url));
  }
  return { embedded, removed: stale.length };
}

export async function loadCorpus(
  db: DrizzleD1Database,
): Promise<CorpusEntry[]> {
  const rows = await db.select().from(contentIndex);
  return rows.map((r) => {
    let embedding: number[] | null = null;
    if (r.embedding) {
      try {
        const parsed = JSON.parse(r.embedding);
        if (Array.isArray(parsed)) embedding = parsed;
      } catch {
        embedding = null;
      }
    }
    return {
      url: r.url,
      kind: r.kind,
      title: r.title,
      primaryKeyword: r.primaryKeyword,
      excerpt: r.excerpt,
      embedding,
    };
  });
}

/**
 * Cannibalization thresholds. Every page on this site is about MCP, so bge-small
 * cosine between any two of our pages rarely drops below ~0.6; these sit well
 * above that baseline. Scores are stored on each topic/draft review so the
 * thresholds can be tuned from real data.
 */
export const THRESHOLDS = {
  /** Topic vs existing page: same query intent → block the topic. */
  topicBlockCosine: 0.9,
  /** Topic keyword tokens vs existing keyword tokens → block. */
  topicBlockKeyword: 0.75,
  /** Close neighbour: allowed, but the writer must differentiate and link to it. */
  topicNeighbourCosine: 0.8,
  /** Finished draft vs existing page → reject as duplicate. */
  draftRejectCosine: 0.93,
  /** Fraction of the draft's 8-word shingles found in one existing post → reject. */
  draftRejectShingle: 0.08,
};

export type SimilarityHit = {
  url: string;
  title: string;
  kind: string;
  cosine: number;
  keyword: number;
};

/** Rank corpus entries by similarity to a query vector/keyword. */
export function rankSimilar(
  corpus: CorpusEntry[],
  queryVec: number[] | null,
  queryKeyword: string,
  opts: { excludeUrls?: Set<string> } = {},
): SimilarityHit[] {
  const hits: SimilarityHit[] = [];
  for (const e of corpus) {
    if (opts.excludeUrls?.has(e.url)) continue;
    const cosine =
      queryVec && e.embedding ? cosineSimilarity(queryVec, e.embedding) : 0;
    const keyword = Math.max(
      keywordOverlap(queryKeyword, e.primaryKeyword || ''),
      keywordOverlap(queryKeyword, e.title),
    );
    hits.push({ url: e.url, title: e.title, kind: e.kind, cosine, keyword });
  }
  return hits.sort(
    (a, b) => Math.max(b.cosine, b.keyword) - Math.max(a.cosine, a.keyword),
  );
}

export type TopicVerdict =
  | { ok: true; neighbours: SimilarityHit[] }
  | { ok: false; reason: string; conflict: SimilarityHit };

/** Decide whether a topic would cannibalize an existing page. */
export function judgeTopic(hits: SimilarityHit[]): TopicVerdict {
  for (const h of hits) {
    if (h.cosine >= THRESHOLDS.topicBlockCosine)
      return {
        ok: false,
        reason: `semantic overlap ${h.cosine.toFixed(3)} with ${h.url}`,
        conflict: h,
      };
    if (h.keyword >= THRESHOLDS.topicBlockKeyword)
      return {
        ok: false,
        reason: `keyword overlap ${h.keyword.toFixed(2)} with ${h.url}`,
        conflict: h,
      };
  }
  const neighbours = hits
    .filter(
      (h) =>
        h.cosine >= THRESHOLDS.topicNeighbourCosine ||
        h.keyword >= THRESHOLDS.topicBlockKeyword / 2,
    )
    .slice(0, 4);
  return { ok: true, neighbours };
}

/** Highest 8-word shingle containment of the draft body in any published post. */
export function maxShingleOverlap(content: string): {
  url: string | null;
  containment: number;
} {
  const cand = shingles(content);
  let best = { url: null as string | null, containment: 0 };
  for (const p of publishedPosts()) {
    const c = shingleContainment(cand, shingles(p.content));
    if (c > best.containment) best = { url: `/blog/${p.slug}`, containment: c };
  }
  return best;
}
