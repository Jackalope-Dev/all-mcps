/**
 * Blog content pipeline orchestration — driven by /api/cron/blog-pipeline.
 *
 * One run advances a small state machine as far as its time budget allows,
 * so a timeout or budget wall mid-way never loses finished work:
 *
 *   seeds/ideation → blog_topics(queued)
 *        │ cannibalization check (lexical + semantic vs content_index)
 *        ├─ overlap → topic 'blocked' (reason stored)
 *        ▼
 *   write → blog_drafts('review') ─► review ─► 'ready' ─► pull-blog-drafts.mjs
 *                                     │  ▲                (human reads the diff,
 *                                     ▼  │                 commits, deploys)
 *                                 'revise' (≤ MAX_ITERATIONS passes)
 *                                     └─► 'needs_human' | 'rejected'
 *
 * Why drafts stop at 'ready' instead of auto-publishing: posts are statically
 * built from content/blog, deploys are run by hand, and mass-published
 * unreviewed AI content is exactly what search engines' scaled-content policies
 * target. The pipeline does the research, dedupe, writing and editing; a human
 * spends two minutes reading the diff before it ships.
 */

import { and, asc, count, desc, eq, gte, inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { blogDrafts, blogTopics, contentIndex, servers } from '../../db/schema';
import { chatJson } from '../openai';
import { queryVectorIndex } from '../vectorSearch';
import {
  type CorpusEntry,
  codeCorpus,
  embedTexts,
  judgeTopic,
  loadCorpus,
  maxShingleOverlap,
  publishedPosts,
  rankSimilar,
  syncCodeCorpus,
  THRESHOLDS,
  upsertCorpusDocs,
} from './corpus';
import {
  ideationSystemPrompt,
  ideationUserPrompt,
  type LinkCandidate,
  type ReviewResult,
  reviewerSystemPrompt,
  reviewerUserPrompt,
  reviserUserPrompt,
  type WriterBrief,
  writerSystemPrompt,
  writerUserPrompt,
} from './prompts';
import { BLOG_SEEDS } from './seeds';
import { normalizeKeyword, slugify } from './similarity';
import {
  type DraftFields,
  stripUnknownInternalLinks,
  validateDraft,
} from './validate';

const MODEL = 'gpt-5.6-luna';
/** Drafts waiting for a human (ready) or still in the loop — stop writing new ones past this. */
export const BACKLOG_CAP = 6;
/** New drafts per UTC day. */
const DAILY_DRAFT_CAP = 2;
/** Write + revise passes before a draft goes to a human instead. */
const MAX_ITERATIONS = 3;
/** Ideate when fewer topics than this are queued. */
const MIN_QUEUED_TOPICS = 5;
const IDEATION_BATCH = 8;
/** Every review dimension must reach this (1-5). */
const MIN_REVIEW_SCORE = 4;

/** Hub pages always valid as internal links. */
const HUB_PATHS = [
  '/',
  '/browse',
  '/categories',
  '/best',
  '/clients',
  '/guides',
  '/tools',
  '/blog',
  '/submit',
  '/compare',
  '/prompts',
  '/trust',
  '/docs/api',
];

export type PipelineEnv = {
  AI?: Ai;
  VECTOR_INDEX?: VectorizeIndex;
};

export type PipelineStep = { step: string; detail: string };

type Brief = WriterBrief;

type StoredReview = {
  brief: Brief;
  issues?: string[];
  review?: ReviewResult | null;
  similarity?: {
    maxCosine: number;
    maxCosineUrl: string | null;
    shingle: number;
    shingleUrl: string | null;
  };
  topicNeighbours?: { url: string; cosine: number; keyword: number }[];
};

class BudgetError extends Error {}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newId(): string {
  return crypto.randomUUID();
}

/** Insert any new seeds. Existing keywords keep their status. */
export async function ensureSeeds(db: DrizzleD1Database): Promise<number> {
  let inserted = 0;
  for (const seed of BLOG_SEEDS) {
    const res = await db
      .insert(blogTopics)
      .values({
        id: newId(),
        keyword: normalizeKeyword(seed.keyword),
        secondaryKeywords: JSON.stringify(seed.secondaryKeywords),
        intent: seed.intent,
        angle: seed.angle,
        cluster: seed.cluster,
        source: 'seed',
        priority: seed.priority,
      })
      .onConflictDoNothing()
      .returning({ id: blogTopics.id });
    inserted += res.length;
  }
  return inserted;
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Coerce the writer's JSON into DraftFields; null when unusable. */
export function clampDraft(raw: Record<string, unknown>): DraftFields | null {
  const title = str(raw.title, 120);
  const content = str(raw.content, 40_000).replace(/\r\n/g, '\n');
  if (!title || content.length < 500) return null;
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .filter((t): t is string => typeof t === 'string' && !!t.trim())
        .map((t) => t.trim().slice(0, 40))
        .slice(0, 6)
    : [];
  const faq = Array.isArray(raw.faq)
    ? raw.faq
        .map((f) => ({
          q: str((f as Record<string, unknown>)?.q, 200),
          a: str((f as Record<string, unknown>)?.a, 800),
        }))
        .filter((f) => f.q && f.a)
        .slice(0, 6)
    : [];
  return {
    title,
    slug: slugify(str(raw.slug, 120) || title),
    excerpt: str(raw.excerpt, 300).replace(/\s+/g, ' '),
    primaryKeyword: str(raw.primaryKeyword, 120),
    tags,
    faq,
    content,
  };
}

async function callJson<T>(
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<T | null> {
  const res = await chatJson<T>({
    model: MODEL,
    maxTokens,
    timeoutMs,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  if (res.ok) return res.data;
  if (
    res.reason === 'budget_or_rate_limit' ||
    res.reason === 'auth' ||
    res.reason === 'not_configured'
  ) {
    throw new BudgetError(res.reason);
  }
  console.warn('[blogPipeline] LLM call failed', res.reason, res.message);
  return null;
}

async function embedOne(
  env: PipelineEnv,
  text: string,
): Promise<number[] | null> {
  const [v] = await embedTexts(env.AI, [text]);
  return v;
}

/** Listings semantically related to the topic, as link candidates. */
async function relatedListings(
  db: DrizzleD1Database,
  env: PipelineEnv,
  query: string,
): Promise<LinkCandidate[]> {
  if (!env.VECTOR_INDEX || !env.AI) return [];
  const hits = await queryVectorIndex(query, env as CloudflareEnv, 12);
  const ids = hits.map((h) => h.id).slice(0, 12);
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: servers.id, name: servers.name, summary: servers.aiSummary })
    .from(servers)
    .where(and(inArray(servers.id, ids), eq(servers.status, 'active')));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .slice(0, 8)
    .map((r) => ({
      url: `/mcp/${r.id}`,
      title: r.summary ? `${r.name}: ${r.summary}` : r.name,
    }));
}

/** Paths an internal link may point to. Listing paths are verified against D1. */
async function buildKnownPaths(
  db: DrizzleD1Database,
  corpus: CorpusEntry[],
  content: string,
): Promise<Set<string>> {
  const known = new Set<string>(HUB_PATHS);
  for (const e of corpus) if (e.kind !== 'draft') known.add(e.url);
  const ids = [
    ...new Set(
      [
        ...content.matchAll(
          /\]\((?:https?:\/\/(?:www\.)?allmcps\.com)?\/mcp\/([^)\s/#?]+)/g,
        ),
      ].map((m) => decodeURIComponent(m[1])),
    ),
  ].slice(0, 60);
  if (ids.length > 0) {
    const rows = await db
      .select({ id: servers.id })
      .from(servers)
      .where(and(inArray(servers.id, ids), eq(servers.status, 'active')));
    for (const r of rows) known.add(`/mcp/${r.id}`);
  }
  return known;
}

/** Claim the next viable topic, blocking any that would cannibalize existing pages. */
async function claimTopic(
  db: DrizzleD1Database,
  env: PipelineEnv,
  corpus: CorpusEntry[],
  steps: PipelineStep[],
): Promise<{
  topic: typeof blogTopics.$inferSelect;
  brief: Brief;
  neighbours: { url: string; cosine: number; keyword: number }[];
} | null> {
  const candidates = await db
    .select()
    .from(blogTopics)
    .where(eq(blogTopics.status, 'queued'))
    .orderBy(desc(blogTopics.priority), asc(blogTopics.createdAt))
    .limit(6);

  for (const topic of candidates) {
    const secondary = parseJsonArray<string>(topic.secondaryKeywords);
    const queryText = `${topic.keyword}. ${secondary.join(', ')}. ${topic.angle}`;
    const vec = await embedOne(env, queryText);
    const hits = rankSimilar(corpus, vec, topic.keyword);
    // Secondary keywords can cannibalize too — check each lexically.
    const secondaryHits = secondary.flatMap((k) =>
      rankSimilar(corpus, null, k).slice(0, 1),
    );
    const verdict = judgeTopic(
      [...hits, ...secondaryHits].sort(
        (a, b) => Math.max(b.cosine, b.keyword) - Math.max(a.cosine, a.keyword),
      ),
    );
    if (!verdict.ok) {
      await db
        .update(blogTopics)
        .set({ status: 'blocked', blockedReason: verdict.reason })
        .where(eq(blogTopics.id, topic.id));
      steps.push({
        step: 'topic_blocked',
        detail: `${topic.keyword}: ${verdict.reason}`,
      });
      continue;
    }

    const neighbourUrls = new Set(verdict.neighbours.map((n) => n.url));
    const linkCandidates = hits
      .filter(
        (h) => h.kind !== 'draft' && !neighbourUrls.has(h.url) && h.cosine > 0,
      )
      .slice(0, 14)
      .map((h) => ({ url: h.url, title: h.title }));
    const listings = await relatedListings(db, env, queryText);
    const existingTags = [
      ...new Set(publishedPosts().flatMap((p) => p.tags)),
    ].sort();

    await db
      .update(blogTopics)
      .set({
        status: 'claimed',
        claimedAt: new Date(),
        attempts: topic.attempts + 1,
      })
      .where(eq(blogTopics.id, topic.id));

    return {
      topic,
      neighbours: verdict.neighbours.map((n) => ({
        url: n.url,
        cosine: Number(n.cosine.toFixed(3)),
        keyword: Number(n.keyword.toFixed(2)),
      })),
      brief: {
        keyword: topic.keyword,
        secondaryKeywords: secondary,
        intent: topic.intent,
        angle: topic.angle,
        neighbours: verdict.neighbours
          .filter((n) => n.kind !== 'draft')
          .map((n) => ({ url: n.url, title: n.title })),
        linkCandidates,
        listings,
        existingTags,
        today: today(),
      },
    };
  }
  return null;
}

async function uniqueSlug(
  db: DrizzleD1Database,
  slug: string,
  selfId?: string,
): Promise<string> {
  const published = new Set(publishedPosts().map((p) => p.slug));
  let candidate = slug;
  for (let i = 2; i < 20; i++) {
    const clash = await db
      .select({ id: blogDrafts.id })
      .from(blogDrafts)
      .where(eq(blogDrafts.slug, candidate))
      .limit(1);
    const takenByOther = clash.length > 0 && clash[0].id !== selfId;
    if (!published.has(candidate) && !takenByOther) return candidate;
    candidate = `${slug}-${i}`;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

async function writeNewDraft(
  db: DrizzleD1Database,
  env: PipelineEnv,
  corpus: CorpusEntry[],
  steps: PipelineStep[],
): Promise<boolean> {
  const claimed = await claimTopic(db, env, corpus, steps);
  if (!claimed) {
    steps.push({ step: 'write_skipped', detail: 'no viable queued topic' });
    return false;
  }
  const { topic, brief, neighbours } = claimed;

  const raw = await callJson<Record<string, unknown>>(
    writerSystemPrompt(),
    writerUserPrompt(brief),
    9000,
    240_000,
  );
  const draft = raw ? clampDraft(raw) : null;
  if (!draft) {
    // Release the topic for a later run; three strikes blocks it.
    await db
      .update(blogTopics)
      .set({
        status: topic.attempts + 1 >= 3 ? 'blocked' : 'queued',
        blockedReason: topic.attempts + 1 >= 3 ? 'writer failed 3 times' : null,
      })
      .where(eq(blogTopics.id, topic.id));
    steps.push({ step: 'write_failed', detail: topic.keyword });
    return false;
  }
  if (!draft.primaryKeyword) draft.primaryKeyword = topic.keyword;
  draft.slug = await uniqueSlug(db, draft.slug);

  const id = newId();
  const stored: StoredReview = { brief, topicNeighbours: neighbours };
  await db.insert(blogDrafts).values({
    id,
    topicId: topic.id,
    slug: draft.slug,
    title: draft.title,
    excerpt: draft.excerpt,
    primaryKeyword: draft.primaryKeyword,
    tags: JSON.stringify(draft.tags),
    faq: JSON.stringify(draft.faq),
    content: draft.content,
    status: 'review',
    iterations: 1,
    review: JSON.stringify(stored),
    model: MODEL,
  });
  await db
    .update(blogTopics)
    .set({ status: 'drafted' })
    .where(eq(blogTopics.id, topic.id));
  // Register immediately so the next topic can't target the same intent.
  await upsertCorpusDocs(db, env.AI, [
    {
      url: `/blog/${draft.slug}`,
      kind: 'draft',
      title: draft.title,
      primaryKeyword: draft.primaryKeyword,
      excerpt: draft.excerpt,
    },
  ]);
  steps.push({ step: 'drafted', detail: `${draft.slug} (${topic.keyword})` });
  return true;
}

function draftFieldsFromRow(row: typeof blogDrafts.$inferSelect): DraftFields {
  return {
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    primaryKeyword: row.primaryKeyword,
    tags: parseJsonArray<string>(row.tags),
    faq: parseJsonArray<{ q: string; a: string }>(row.faq),
    content: row.content,
  };
}

function reviewPasses(review: ReviewResult | null): boolean {
  if (!review?.scores) return false;
  const scores = Object.values(review.scores);
  return (
    scores.length === 5 &&
    scores.every((s) => typeof s === 'number' && s >= MIN_REVIEW_SCORE) &&
    (review.blockingIssues?.length ?? 0) === 0
  );
}

function normalizeReview(raw: unknown): ReviewResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  const s = r.scores || {};
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0;
  const list = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string').slice(0, 12)
      : [];
  return {
    scores: {
      accuracy: num(s.accuracy),
      originality: num(s.originality),
      depth: num(s.depth),
      actionability: num(s.actionability),
      searchIntent: num(s.searchIntent),
    },
    blockingIssues: list(r.blockingIssues),
    suggestions: list(r.suggestions),
  };
}

async function reviewDraft(
  db: DrizzleD1Database,
  env: PipelineEnv,
  corpus: CorpusEntry[],
  row: typeof blogDrafts.$inferSelect,
  steps: PipelineStep[],
): Promise<void> {
  const stored = JSON.parse(row.review || '{}') as StoredReview;
  const draft = draftFieldsFromRow(row);
  const selfUrl = `/blog/${row.slug}`;

  // 1. Link hygiene: drop links to pages that don't exist, keep the anchor text.
  const known = await buildKnownPaths(db, corpus, draft.content);
  const isKnown = (p: string) => known.has(p);
  const stripped = stripUnknownInternalLinks(draft.content, isKnown);
  draft.content = stripped.content;

  // 2. Duplicate-content checks against everything already on the site.
  const headings = (draft.content.match(/^##\s+.+$/gm) || []).join('. ');
  const vec = await embedOne(
    env,
    `${draft.title}. ${draft.primaryKeyword}. ${draft.excerpt}. ${headings}`,
  );
  const hits = rankSimilar(corpus, vec, draft.primaryKeyword, {
    excludeUrls: new Set([selfUrl]),
  });
  const top = hits.reduce((best, h) => (h.cosine > best.cosine ? h : best), {
    cosine: 0,
    url: null as string | null,
  } as {
    cosine: number;
    url: string | null;
  });
  const shingle = maxShingleOverlap(draft.content);
  const similarity = {
    maxCosine: Number(top.cosine.toFixed(3)),
    maxCosineUrl: top.url,
    shingle: Number(shingle.containment.toFixed(3)),
    shingleUrl: shingle.url,
  };

  if (top.cosine >= THRESHOLDS.draftRejectCosine) {
    await db
      .update(blogDrafts)
      .set({
        status: 'rejected',
        content: draft.content,
        review: JSON.stringify({
          ...stored,
          similarity,
          issues: [`Duplicate of ${top.url} (cosine ${similarity.maxCosine})`],
        }),
        updatedAt: new Date(),
      })
      .where(eq(blogDrafts.id, row.id));
    await db.delete(contentIndex).where(eq(contentIndex.url, selfUrl));
    steps.push({
      step: 'rejected_duplicate',
      detail: `${row.slug} ~ ${top.url}`,
    });
    return;
  }

  // 3. Deterministic checks + LLM editorial review.
  const validation = validateDraft(draft, isKnown);
  const issues = [...validation.issues];
  if (shingle.containment >= THRESHOLDS.draftRejectShingle)
    issues.push(
      `Passages repeat ${shingle.url} nearly word for word (${(shingle.containment * 100).toFixed(1)}% of 8-word sequences). Rewrite them in new words or replace them with a link.`,
    );
  if (stripped.removed.length > 0)
    issues.push(
      `Links to non-existent pages were removed (${[...new Set(stripped.removed)].join(', ')}); use only URLs from the provided lists.`,
    );

  const reviewRaw = await callJson<unknown>(
    reviewerSystemPrompt(),
    reviewerUserPrompt(row.primaryKeyword, stored.brief?.angle ?? '', draft),
    2500,
    120_000,
  );
  const review = normalizeReview(reviewRaw);
  if (!review) {
    steps.push({ step: 'review_failed', detail: row.slug });
    return; // stays in 'review'; retried next run
  }
  issues.push(...review.blockingIssues);
  for (const [dim, score] of Object.entries(review.scores)) {
    if (score < MIN_REVIEW_SCORE)
      issues.push(
        `Editor scored ${dim} ${score}/5 — raise it to at least ${MIN_REVIEW_SCORE}.`,
      );
  }

  const passed = issues.length === 0 && reviewPasses(review);
  let status: string;
  let backlinks: string | null = row.backlinkSuggestions;
  if (passed) {
    status = 'ready';
    backlinks = JSON.stringify(
      hits
        .filter(
          (h) => (h.kind === 'blog' || h.kind === 'guide') && h.cosine > 0,
        )
        .slice(0, 3)
        .map((h) => ({
          url: h.url,
          title: h.title,
          anchor: draft.primaryKeyword,
        })),
    );
  } else if (row.iterations >= MAX_ITERATIONS) {
    status = 'needs_human';
  } else {
    status = 'revise';
  }

  await db
    .update(blogDrafts)
    .set({
      status,
      content: draft.content,
      review: JSON.stringify({ ...stored, similarity, issues, review }),
      backlinkSuggestions: backlinks,
      updatedAt: new Date(),
    })
    .where(eq(blogDrafts.id, row.id));
  steps.push({
    step: `reviewed_${status}`,
    detail: `${row.slug} (${issues.length} issues, pass ${row.iterations})`,
  });
}

async function reviseDraft(
  db: DrizzleD1Database,
  row: typeof blogDrafts.$inferSelect,
  steps: PipelineStep[],
): Promise<void> {
  const stored = JSON.parse(row.review || '{}') as StoredReview;
  const current = draftFieldsFromRow(row);
  const raw = await callJson<Record<string, unknown>>(
    writerSystemPrompt(),
    reviserUserPrompt(
      stored.brief,
      JSON.stringify(current),
      stored.issues ?? [],
    ),
    9000,
    240_000,
  );
  const next = raw ? clampDraft(raw) : null;
  if (!next) {
    steps.push({ step: 'revise_failed', detail: row.slug });
    return;
  }
  // Keep the slug stable across revisions — it is already registered in content_index.
  await db
    .update(blogDrafts)
    .set({
      title: next.title,
      excerpt: next.excerpt,
      primaryKeyword: next.primaryKeyword || row.primaryKeyword,
      tags: JSON.stringify(next.tags),
      faq: JSON.stringify(next.faq),
      content: next.content,
      status: 'review',
      iterations: row.iterations + 1,
      updatedAt: new Date(),
    })
    .where(eq(blogDrafts.id, row.id));
  steps.push({
    step: 'revised',
    detail: `${row.slug} → pass ${row.iterations + 1}`,
  });
}

async function ideate(
  db: DrizzleD1Database,
  corpus: CorpusEntry[],
  steps: PipelineStep[],
): Promise<void> {
  const queued = await db
    .select({ keyword: blogTopics.keyword })
    .from(blogTopics)
    .where(inArray(blogTopics.status, ['queued', 'claimed', 'drafted']));
  const existing = [
    ...corpus.map((c) => c.title),
    ...queued.map((q) => q.keyword),
  ];
  const clusters = [...new Set(BLOG_SEEDS.map((s) => s.cluster)), 'ecosystem'];
  const raw = await callJson<{ topics?: unknown }>(
    ideationSystemPrompt(),
    ideationUserPrompt(existing, clusters, IDEATION_BATCH, today()),
    3000,
    120_000,
  );
  const ideas = Array.isArray(raw?.topics) ? raw.topics : [];
  let added = 0;
  for (const idea of ideas.slice(0, IDEATION_BATCH)) {
    const i = idea as Record<string, unknown>;
    const keyword = normalizeKeyword(str(i.keyword, 120));
    const angle = str(i.angle, 400);
    if (!keyword || keyword.split(' ').length < 2 || !angle) continue;
    // Cheap lexical pre-filter; the full semantic check runs at claim time.
    const lexical = rankSimilar(corpus, null, keyword)[0];
    if (lexical && lexical.keyword >= THRESHOLDS.topicBlockKeyword) continue;
    const intent = [
      'informational',
      'comparison',
      'how-to',
      'troubleshooting',
    ].includes(String(i.intent))
      ? String(i.intent)
      : 'informational';
    const res = await db
      .insert(blogTopics)
      .values({
        id: newId(),
        keyword,
        secondaryKeywords: JSON.stringify(
          Array.isArray(i.secondaryKeywords)
            ? i.secondaryKeywords
                .filter((k): k is string => typeof k === 'string')
                .slice(0, 4)
            : [],
        ),
        intent,
        angle,
        cluster: str(i.cluster, 40) || 'concepts',
        source: 'ideation',
        priority: 50,
      })
      .onConflictDoNothing()
      .returning({ id: blogTopics.id });
    added += res.length;
  }
  steps.push({ step: 'ideated', detail: `${added} new topics` });
}

/**
 * Advance the pipeline until `deadline` (epoch ms). Order: finish in-flight
 * drafts first (they already cost tokens), then write, then refill the queue.
 */
export async function runBlogPipeline(
  db: DrizzleD1Database,
  env: PipelineEnv,
  deadline: number,
): Promise<{ steps: PipelineStep[]; stoppedFor?: string }> {
  const steps: PipelineStep[] = [];
  const timeLeft = () => deadline - Date.now();

  try {
    const seeded = await ensureSeeds(db);
    if (seeded > 0) steps.push({ step: 'seeded', detail: `${seeded} topics` });
    const sync = await syncCodeCorpus(db, env.AI);
    steps.push({
      step: 'corpus_synced',
      detail: `${sync.embedded} embedded, ${sync.removed} removed, ${codeCorpus().length} code pages`,
    });
    let corpus = await loadCorpus(db);

    // Each LLM step can take up to ~4 min; don't start one with less left.
    const STEP_BUDGET_MS = 4 * 60_000;
    while (timeLeft() > STEP_BUDGET_MS) {
      const [inFlight] = await db
        .select()
        .from(blogDrafts)
        .where(inArray(blogDrafts.status, ['review', 'revise']))
        .orderBy(asc(blogDrafts.updatedAt))
        .limit(1);
      if (inFlight) {
        if (inFlight.status === 'review')
          await reviewDraft(db, env, corpus, inFlight, steps);
        else await reviseDraft(db, inFlight, steps);
        continue;
      }

      const [{ backlog }] = await db
        .select({ backlog: count() })
        .from(blogDrafts)
        .where(inArray(blogDrafts.status, ['ready', 'review', 'revise']));
      if (backlog >= BACKLOG_CAP) {
        steps.push({
          step: 'paused',
          detail: `${backlog} drafts awaiting export (cap ${BACKLOG_CAP}) — run scripts/pull-blog-drafts.mjs`,
        });
        break;
      }
      const dayStart = new Date(`${today()}T00:00:00Z`);
      const [{ todayCount }] = await db
        .select({ todayCount: count() })
        .from(blogDrafts)
        .where(gte(blogDrafts.createdAt, dayStart));
      if (todayCount >= DAILY_DRAFT_CAP) {
        steps.push({ step: 'daily_cap', detail: `${todayCount} drafts today` });
        break;
      }

      const [{ queuedCount }] = await db
        .select({ queuedCount: count() })
        .from(blogTopics)
        .where(eq(blogTopics.status, 'queued'));
      if (queuedCount < MIN_QUEUED_TOPICS) {
        await ideate(db, corpus, steps);
        if (timeLeft() <= STEP_BUDGET_MS) break;
      }

      const wrote = await writeNewDraft(db, env, corpus, steps);
      if (!wrote) break;
      corpus = await loadCorpus(db);
    }
  } catch (error) {
    if (error instanceof BudgetError) {
      return { steps, stoppedFor: `openai:${error.message}` };
    }
    throw error;
  }
  return { steps };
}

/** Rows for the export script / admin view. */
export async function listDrafts(
  db: DrizzleD1Database,
  statuses: string[],
): Promise<(typeof blogDrafts.$inferSelect)[]> {
  return db
    .select()
    .from(blogDrafts)
    .where(inArray(blogDrafts.status, statuses))
    .orderBy(asc(blogDrafts.createdAt));
}

/** Mark drafts exported (after the script wrote the markdown file) or rejected. */
export async function setDraftStatus(
  db: DrizzleD1Database,
  id: string,
  status: 'exported' | 'rejected' | 'review',
): Promise<boolean> {
  const res = await db
    .update(blogDrafts)
    .set({
      status,
      updatedAt: new Date(),
      ...(status === 'exported' ? { exportedAt: new Date() } : {}),
      // Re-queue for another review loop with a fresh iteration budget.
      ...(status === 'review' ? { iterations: 1 } : {}),
    })
    .where(eq(blogDrafts.id, id))
    .returning({ id: blogDrafts.id, slug: blogDrafts.slug });
  // A rejected draft must stop blocking its topic's intent in content_index.
  if (status === 'rejected' && res[0]) {
    await db
      .delete(contentIndex)
      .where(
        and(
          eq(contentIndex.url, `/blog/${res[0].slug}`),
          eq(contentIndex.kind, 'draft'),
        ),
      );
  }
  return res.length > 0;
}
