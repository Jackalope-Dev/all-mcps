import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import {
  listingSignals,
  newsletterFeatures,
  servers,
  upvoteRecords,
  viewRecords,
} from '../../../../db/schema';
import { getAllPosts } from '../../../../lib/blog';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import {
  buildDigestBlocks,
  DEFAULT_HEADLINE,
  type DigestBlogPost,
  type DigestCandidate,
  type DigestEditorial,
  githubRepoKey,
  isDigestTooThin,
  isDigestTrustworthy,
  listingSummary,
  listingTitle,
  listingUseCases,
  newListingScore,
  pickDiverse,
  plainCategory,
  trendingScore,
  truncate,
} from '../../../../lib/newsletterDigest';
import { chatJson } from '../../../../lib/openai';

const WINDOW_DAYS = 7;
// Fewer, better items: nine one-line cards read as a wall, and clicks sat at ~1%.
const NEW_COUNT = 3;
const TRENDING_COUNT = 3;
/** A listing featured in any of the last this-many weeks is left out, so trending never reruns. */
const REPEAT_WINDOW_WEEKS = 8;
/** Candidates pulled per section before scoring. Bounded so the repo-dedupe query stays under D1's 100 bound-parameter limit. */
const POOL_SIZE = 30;
/** A listing needs this many unique viewers in the window to count as trending. */
const MIN_WEEKLY_VIEWS = 3;
/** Ingested listings score 1-4 on listing_quality; below 1.5 is mostly thin or near-empty pages. */
const MIN_NEW_QUALITY = 1.5;
/** Only feature a blog post this recent, so the slot never repeats an old post. */
const BLOG_MAX_AGE_DAYS = 14;
const NEWSLETTER_SUBSCRIBERS_LIST_ID = 'ta0zh9e3l9rcjlfpzpk80tcn';
const DIGEST_REPLY_TO = 'contact@allmcps.com';

type Db = ReturnType<typeof drizzle>;

const CANDIDATE_FIELDS = {
  id: servers.id,
  name: servers.name,
  url: servers.url,
  description: servers.description,
  category: servers.category,
  logoUrl: servers.logoUrl,
  aiSummary: servers.aiSummary,
  aiUseCases: servers.aiUseCases,
  githubStars: servers.githubStars,
  npmDownloads: servers.npmDownloads,
  isOfficial: servers.isOfficial,
  toolsSource: servers.toolsSource,
  tools: servers.tools,
  pricingModel: servers.pricingModel,
  authType: servers.authType,
  installKind: servers.installKind,
  listingQuality: listingSignals.listingQuality,
  repoCreatedAt: listingSignals.repoCreatedAt,
  reviewFlagged: servers.reviewFlagged,
};

/** Listings fit to put in front of subscribers: enriched, alive, not a fork, not triaged out. */
function featurable(): SQL {
  return and(
    eq(servers.status, 'active'),
    isNotNull(servers.aiSummary),
    notInArray(servers.healthStatus, ['offline', 'archived']),
    sql`coalesce(${listingSignals.repoStatus}, '') != 'gone'`,
    isNull(listingSignals.repoForkOf),
    sql`coalesce(${listingSignals.triageVerdict}, '') != 'reject'`,
  ) as SQL;
}

async function loadNewCandidates(
  db: Db,
  since: Date,
): Promise<DigestCandidate[]> {
  const rows = await db
    .select(CANDIDATE_FIELDS)
    .from(servers)
    .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
    .where(
      and(
        featurable(),
        gte(servers.createdAt, since),
        sql`coalesce(${listingSignals.listingQuality}, 0) >= ${MIN_NEW_QUALITY}`,
      ),
    )
    .orderBy(desc(sql`coalesce(${servers.githubStars}, 0)`))
    .limit(POOL_SIZE);

  // "New" should mean a new project. Ingest sometimes adds a monorepo sub-package
  // (github.com/o/r/tree/main/...) for a repo we already list, so drop any candidate
  // whose GitHub repo is already listed from before the window, or twice in the pool.
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = githubRepoKey(r.url);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const keys = [...seen];
  if (keys.length === 0) return unique;

  const existing = await db
    .select({ url: servers.url })
    .from(servers)
    .where(
      and(
        eq(servers.status, 'active'),
        lt(servers.createdAt, since),
        // instr, not LIKE: D1 rejects LIKE patterns over 50 chars, which long
        // owner/repo URLs exceed. Over-matches (repo-foo for repo) are dropped below.
        or(
          ...keys.map(
            (k) => sql`instr(lower(${servers.url}), ${`github.com/${k}`}) > 0`,
          ),
        ),
      ),
    );
  const listedBefore = new Set(
    existing.map((r) => githubRepoKey(r.url)).filter(Boolean),
  );
  return unique.filter((r) => {
    const key = githubRepoKey(r.url);
    return !key || !listedBefore.has(key);
  });
}

async function loadTrendingCandidates(
  db: Db,
  since: Date,
): Promise<DigestCandidate[]> {
  // view_records keeps one row per (listing, hashed IP), and last_counted_at moves
  // whenever that visitor's view counts again, so rows in the window = unique viewers.
  const weekly = db
    .select({
      serverId: viewRecords.serverId,
      views: sql<number>`count(*)`.as('weekly_views'),
    })
    .from(viewRecords)
    .where(gte(viewRecords.lastCountedAt, since))
    .groupBy(viewRecords.serverId)
    .as('weekly');

  const rows = await db
    .select({ ...CANDIDATE_FIELDS, weeklyViews: weekly.views })
    .from(weekly)
    .innerJoin(servers, eq(servers.id, weekly.serverId))
    .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
    .where(
      and(
        featurable(),
        // Listings from this window belong to "New & notable".
        lt(servers.createdAt, since),
        gte(weekly.views, MIN_WEEKLY_VIEWS),
        sql`coalesce(${listingSignals.listingQuality}, 0) >= ${MIN_NEW_QUALITY}`,
      ),
    )
    .orderBy(desc(weekly.views))
    .limit(POOL_SIZE);
  if (rows.length === 0) return [];

  const upvotes = await db
    .select({
      serverId: upvoteRecords.serverId,
      n: sql<number>`count(*)`,
    })
    .from(upvoteRecords)
    .where(
      and(
        gte(upvoteRecords.createdAt, since),
        inArray(
          upvoteRecords.serverId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .groupBy(upvoteRecords.serverId);
  const upvotesById = new Map(upvotes.map((u) => [u.serverId, u.n]));

  return rows.map((r) => ({
    ...r,
    weeklyUpvotes: upvotesById.get(r.id) || 0,
  }));
}

function latestBlogPost(now: Date): DigestBlogPost | null {
  const post = getAllPosts()[0];
  if (!post) return null;
  const ageDays = (now.getTime() - Date.parse(post.date)) / 86_400_000;
  return ageDays <= BLOG_MAX_AGE_DAYS
    ? { slug: post.slug, title: post.title, excerpt: post.excerpt }
    : null;
}

function isoWeek(d: Date): number {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return (
    1 +
    Math.round(
      (date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000),
    )
  );
}

// Used when the LLM pass is unavailable; rotated weekly so the email doesn't read
// identically two Mondays in a row.
const FALLBACK_INTROS = [
  'The strongest new MCP servers from this week, plus what developers are looking at right now.',
  'A few new tools worth giving your agents this week, and the servers getting the most attention.',
  'This week’s standout additions to the directory, and what’s trending with other developers.',
  'New capabilities for your AI agents, picked from this week’s directory activity.',
];

type LlmEditorial = DigestEditorial & {
  pickId: string | null;
  subject: string;
  previewText: string;
};

type EditorialResult =
  | { ok: true; editorial: LlmEditorial }
  | { ok: false; reason: string };

function toolNames(c: DigestCandidate): string[] {
  if (!c.tools) return [];
  try {
    const parsed = JSON.parse(c.tools);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t) => (typeof t?.name === 'string' ? t.name : null))
      .filter((n): n is string => !!n)
      .slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * One LLM pass writes the editorial layer: the issue's theme and editor's note,
 * which shortlisted server leads as the pick, a write-up and paste-ready prompts
 * for it, a concrete blurb and example prompt per card, and the subject and
 * preview text. Fail-soft: any budget/timeout/parse error returns the reason and
 * the deterministic copy is used, so the send never depends on the LLM.
 */
async function generateEditorial(
  week: number,
  shortlist: DigestCandidate[],
  others: DigestCandidate[],
  blogPost: DigestBlogPost | null,
): Promise<EditorialResult> {
  const describe = (c: DigestCandidate) => ({
    id: c.id,
    name: listingTitle(c).title,
    category: plainCategory(c.category),
    summary: truncate(listingSummary(c), 240),
    useCases: listingUseCases(c).slice(0, 3),
    tools: toolNames(c),
    githubStars: c.githubStars ?? undefined,
    pricing: c.pricingModel ?? undefined,
    auth: c.authType ?? undefined,
    official: c.isOfficial || undefined,
  });

  const result = await chatJson<{
    headline?: string;
    intro?: string;
    pickId?: string;
    pickWriteup?: string;
    pickPrompts?: unknown;
    subject?: string;
    previewText?: string;
    items?: Array<{ id: string; blurb?: string; prompt?: string }>;
  }>({
    model: 'gpt-5.6-luna',
    temperature: 0.6,
    // A reasoning model spends part of this budget thinking before it writes.
    // At 1400 the JSON for ~10 listings was cut off, failed to parse, and the
    // Nov 16 and Nov 23 2026 issues went out with the fallback copy.
    maxTokens: 8000,
    timeoutMs: 90_000,
    messages: [
      {
        role: 'system',
        content:
          'You are the editor of AllMCPs, a directory of Model Context Protocol (MCP) servers that give AI agents ' +
          '(Claude, Cursor, Codex, etc.) new tools. Readers are developers deciding what to plug into their agent. ' +
          'Write a weekly email that reads like a short, opinionated briefing from someone who tried these tools, and makes readers want to try one today. ' +
          'Be concrete: name the task the server lets an agent do ("have Claude diff two Postgres schemas"), not adjectives. ' +
          'Use only facts present in the input (summary, use cases, tool names). No hype ("game-changer", "revolutionary", "supercharge", "unlock"), no emoji, no exclamation marks. ' +
          'Refer to servers by the "name" given, never by an id. ' +
          'Return JSON with:\n' +
          '"headline": the theme of this issue under 60 chars, concrete, drawn from what these servers have in common or the pick ("Give your agent a real browser"); never "This week on AllMCPs";\n' +
          '"intro": an editor\'s note of 2-3 sentences (under 320 chars) that connects this week\'s servers to a workflow a developer has, and says why it matters now;\n' +
          '"pickId": the id from SHORTLIST most likely to be useful and interesting to the broadest set of developers;\n' +
          '"pickWriteup": 2-3 sentences (under 330 chars) on what it lets you do and who should try it — do not start with its name;\n' +
          '"pickPrompts": exactly 3 prompts a reader could paste into their agent once the pick is installed, each under 110 chars, written as the user speaking to the agent, specific to the pick\'s tools;\n' +
          '"subject": email subject under 60 chars that names the pick or one concrete thing from this week; no "This week on AllMCPs";\n' +
          '"previewText": inbox preview under 100 chars that complements the subject (mention another highlight, not a repeat);\n' +
          '"items": [{id, blurb, prompt}] for EVERY listing in SHORTLIST and OTHERS — blurb: one sentence under 140 chars on what you can do with it, ' +
          'not starting with the server name or "This server"; prompt: one example prompt under 100 chars the reader could paste into their agent. Keep every id exactly as provided.',
      },
      {
        role: 'user',
        content:
          `ISO week ${week}.\n` +
          `SHORTLIST (pick candidates): ${JSON.stringify(shortlist.map(describe))}\n` +
          `OTHERS: ${JSON.stringify(others.map(describe))}\n` +
          (blogPost
            ? `New blog post this week: ${JSON.stringify({ title: blogPost.title })}\n`
            : ''),
      },
    ],
  });

  if (!result.ok) return { ok: false, reason: result.reason };
  const data = result.data;
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const blurbs: Record<string, string> = {};
  const prompts: Record<string, string> = {};
  for (const item of data.items || []) {
    if (!item?.id) continue;
    const blurb = text(item.blurb);
    const prompt = text(item.prompt);
    if (blurb) blurbs[item.id] = blurb;
    if (prompt) prompts[item.id] = prompt;
  }
  const pickId = shortlist.some((c) => c.id === data.pickId)
    ? (data.pickId as string)
    : null;
  const subject = text(data.subject);
  const headline = text(data.headline);

  return {
    ok: true,
    editorial: {
      pickId,
      headline: headline.length <= 70 ? headline : '',
      pickWriteup: text(data.pickWriteup),
      pickPrompts: Array.isArray(data.pickPrompts)
        ? data.pickPrompts.map(text).filter(Boolean).slice(0, 3)
        : [],
      intro: text(data.intro) || FALLBACK_INTROS[week % FALLBACK_INTROS.length],
      // A runaway subject gets clipped by every inbox; fall back rather than truncate mid-word.
      subject: subject.length <= 80 ? subject : '',
      previewText: truncate(text(data.previewText), 140),
      blurbs,
      prompts,
    },
  };
}

/** Listing ids featured in the last REPEAT_WINDOW_WEEKS sends. */
async function loadRecentlyFeatured(db: Db, now: Date): Promise<Set<string>> {
  const since = new Date(
    now.getTime() - REPEAT_WINDOW_WEEKS * 7 * 24 * 60 * 60 * 1000,
  );
  const rows = await db
    .select({ serverId: newsletterFeatures.serverId })
    .from(newsletterFeatures)
    .where(gte(newsletterFeatures.featuredAt, since));
  return new Set(rows.map((r) => r.serverId));
}

async function recordFeatures(
  db: Db,
  campaign: string,
  now: Date,
  slots: { id: string; slot: 'pick' | 'new' | 'trending' }[],
): Promise<void> {
  if (slots.length === 0) return;
  await db
    .insert(newsletterFeatures)
    .values(
      slots.map((s) => ({
        campaign,
        serverId: s.id,
        slot: s.slot,
        featuredAt: now,
      })),
    )
    .onConflictDoNothing();
}

async function sequenzyFetch(path: string, body: unknown): Promise<Response> {
  const key = process.env.SEQUENZY_CAMPAIGNS_API_KEY;
  if (!key) throw new Error('SEQUENZY_CAMPAIGNS_API_KEY is not configured');
  return fetch(`https://api.sequenzy.com/api/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function createSequenzyCampaign(input: {
  subject: string;
  previewText: string;
  blocks: Record<string, any>[];
  /** A test draft: no audience, so it can only be sent as a test email. */
  test: boolean;
}): Promise<string> {
  const date = new Date().toISOString().slice(0, 10);
  const res = await sequenzyFetch('/campaigns', {
    name: input.test
      ? `[TEST — do not send] Weekly Digest — ${date}`
      : `Weekly Digest — ${date}`,
    subject: input.subject,
    previewText: input.previewText,
    blocks: input.blocks,
    ...(input.test
      ? {}
      : {
          targetLists: {
            type: 'lists',
            listIds: [NEWSLETTER_SUBSCRIBERS_LIST_ID],
          },
        }),
    // No senderProfileId: the From inherits the company's default sender so it
    // can't go stale (it hardcoded an old sender profile ID before). Reply-To is
    // explicit because omitting it still left campaigns pinned to an old personal
    // reply profile; replies belong in the shared contact inbox.
    replyTo: DIGEST_REPLY_TO,
  });
  if (!res.ok) {
    throw new Error(`Sequenzy campaign creation failed: ${res.status}`);
  }
  const data = (await res.json()) as { campaign?: { id?: string } };
  const campaignId = data.campaign?.id;
  if (!campaignId) throw new Error('Sequenzy campaign creation returned no id');
  return campaignId;
}

async function scheduleSequenzyCampaign(campaignId: string): Promise<void> {
  const scheduledAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const res = await sequenzyFetch(`/campaigns/${campaignId}/schedule`, {
    scheduledAt,
  });
  if (!res.ok) {
    throw new Error(`Sequenzy campaign scheduling failed: ${res.status}`);
  }
}

/**
 * POST runs the weekly send. `?test=1` builds the same issue from live data as an
 * unscheduled draft with no audience, for a test send to the team; it records
 * nothing, so the real send next Monday is unaffected.
 */
export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const test = new URL(req.url).searchParams.get('test') === '1';

    let env: CloudflareEnv | undefined;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (_e) {
      throw new Error('Could not get Cloudflare context.');
    }
    if (!env || !(env as any).DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle((env as any).DB);
    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [newRaw, trendingRaw, recentlyFeatured] = await Promise.all([
      loadNewCandidates(db, since),
      loadTrendingCandidates(db, since),
      loadRecentlyFeatured(db, now),
    ]);
    const eligible = (c: DigestCandidate) =>
      !recentlyFeatured.has(c.id) && isDigestTrustworthy(c, now);
    const newPool = newRaw.filter(eligible);
    const trendingPool = trendingRaw.filter(eligible);

    const week = isoWeek(now);
    const campaign = `digest-${now.getUTCFullYear()}-w${String(week).padStart(2, '0')}`;
    const blogPost = latestBlogPost(now);

    // Rank once with room to spare: the top few of each section are pick candidates,
    // and whichever becomes the pick is dropped from its section below.
    const newRanked = pickDiverse(newPool, newListingScore, NEW_COUNT + 3);
    const trendingRanked = pickDiverse(
      trendingPool,
      trendingScore,
      TRENDING_COUNT + 2,
    );
    const shortlist = [...newRanked.slice(0, 3), ...trendingRanked.slice(0, 2)];

    // Decide whether the week is worth a send before paying for the LLM pass.
    const draftPick = shortlist[0] || null;
    const draftExclude = new Set(draftPick ? [draftPick.id] : []);
    if (
      isDigestTooThin({
        pick: draftPick,
        newListings: pickDiverse(
          newRanked,
          newListingScore,
          NEW_COUNT,
          draftExclude,
        ),
        trending: pickDiverse(
          trendingRanked,
          trendingScore,
          TRENDING_COUNT,
          draftExclude,
        ),
        blogPost,
      })
    ) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Too little worth featuring this week; skipped the send.',
      });
    }

    const llmResult = await generateEditorial(
      week,
      shortlist,
      [...newRanked.slice(3), ...trendingRanked.slice(2)],
      blogPost,
    );
    const llm = llmResult.ok ? llmResult.editorial : null;
    if (!llmResult.ok) {
      console.warn('newsletter_digest.editorial_fallback', {
        reason: llmResult.reason,
      });
    }

    const pick =
      shortlist.find((c) => c.id === llm?.pickId) || shortlist[0] || null;
    const exclude = new Set(pick ? [pick.id] : []);
    const newListings = pickDiverse(
      newRanked,
      newListingScore,
      NEW_COUNT,
      exclude,
    );
    const trending = pickDiverse(
      trendingRanked,
      trendingScore,
      TRENDING_COUNT,
      exclude,
    );

    const editorial: DigestEditorial = {
      headline: llm?.headline || DEFAULT_HEADLINE,
      intro: llm?.intro || FALLBACK_INTROS[week % FALLBACK_INTROS.length],
      pickWriteup: llm?.pickWriteup || '',
      pickPrompts: llm?.pickPrompts || [],
      blurbs: llm?.blurbs || {},
      prompts: llm?.prompts || {},
    };

    const pickTitle = pick ? listingTitle(pick).title : '';
    const subject =
      llm?.subject ||
      (pick
        ? `Pick of the week: ${pickTitle} + ${newListings.length} new MCP servers`
        : `This week on AllMCPs: ${newListings.length + trending.length} MCP servers worth a look`);
    const previewText =
      llm?.previewText ||
      (pick
        ? truncate(
            `${pickTitle}: ${listingSummary(pick)} Plus what's new and trending.`,
            140,
          )
        : 'The strongest new MCP servers this week, plus what developers are looking at.');

    const blocks = buildDigestBlocks({
      pick,
      newListings,
      trending,
      blogPost,
      editorial,
      campaign,
    });
    const campaignId = await createSequenzyCampaign({
      subject,
      previewText,
      blocks,
      test,
    });
    if (!test) {
      await scheduleSequenzyCampaign(campaignId);
      await recordFeatures(db, campaign, now, [
        ...(pick ? [{ id: pick.id, slot: 'pick' as const }] : []),
        ...newListings.map((c) => ({ id: c.id, slot: 'new' as const })),
        ...trending.map((c) => ({ id: c.id, slot: 'trending' as const })),
      ]);
    }

    return NextResponse.json({
      success: true,
      test,
      campaignId,
      subject,
      headline: editorial.headline,
      pick: pick?.id ?? null,
      newListings: newListings.map((c) => c.id),
      trending: trending.map((c) => c.id),
      blogPost: blogPost?.slug ?? null,
      editorial: llmResult.ok ? 'llm' : `fallback:${llmResult.reason}`,
      week,
    });
  } catch (error: any) {
    console.error('Newsletter digest cron error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
