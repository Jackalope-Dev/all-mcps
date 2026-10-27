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
  servers,
  upvoteRecords,
  viewRecords,
} from '../../../../db/schema';
import { getAllPosts } from '../../../../lib/blog';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import {
  buildDigestBlocks,
  type DigestBlogPost,
  type DigestCandidate,
  type DigestEditorial,
  displayName,
  githubRepoKey,
  listingSummary,
  listingUseCases,
  newListingScore,
  pickDiverse,
  plainCategory,
  trendingScore,
  truncate,
} from '../../../../lib/newsletterDigest';
import { chatJson } from '../../../../lib/openai';

const WINDOW_DAYS = 7;
const NEW_COUNT = 4;
const TRENDING_COUNT = 4;
/** Candidates pulled per section before scoring. Bounded so the repo-dedupe query stays under D1's 100 bound-parameter limit. */
const POOL_SIZE = 30;
/** A listing needs this many unique viewers in the window to count as trending. */
const MIN_WEEKLY_VIEWS = 3;
/** Ingested listings score 1-4 on listing_quality; below 1.5 is mostly thin or near-empty pages. */
const MIN_NEW_QUALITY = 1.5;
/** Only feature a blog post this recent, so the slot never repeats an old post. */
const BLOG_MAX_AGE_DAYS = 14;
const NEWSLETTER_SUBSCRIBERS_LIST_ID = 'ta0zh9e3l9rcjlfpzpk80tcn';

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

/**
 * One LLM pass writes the editorial layer: which shortlisted server leads as the
 * pick, a short write-up for it, a concrete blurb per card, and the subject and
 * preview text. Fail-soft: any budget/timeout/parse error returns null and the
 * deterministic copy is used, so the send never depends on the LLM.
 */
async function generateEditorial(
  week: number,
  shortlist: DigestCandidate[],
  others: DigestCandidate[],
  blogPost: DigestBlogPost | null,
): Promise<LlmEditorial | null> {
  const describe = (c: DigestCandidate) => ({
    id: c.id,
    name: displayName(c.name).title,
    category: plainCategory(c.category),
    summary: truncate(listingSummary(c), 240),
    useCases: listingUseCases(c).slice(0, 3),
    githubStars: c.githubStars ?? undefined,
    pricing: c.pricingModel ?? undefined,
    auth: c.authType ?? undefined,
    official: c.isOfficial || undefined,
  });

  const result = await chatJson<{
    pickId?: string;
    pickWriteup?: string;
    intro?: string;
    subject?: string;
    previewText?: string;
    items?: Array<{ id: string; blurb?: string }>;
  }>({
    model: 'gpt-5.6-luna',
    temperature: 0.6,
    maxTokens: 1400,
    timeoutMs: 30_000,
    messages: [
      {
        role: 'system',
        content:
          'You are the editor of AllMCPs, a directory of Model Context Protocol (MCP) servers that give AI agents ' +
          '(Claude, Cursor, Codex, etc.) new tools. Readers are developers deciding what to plug into their agent. ' +
          'Write a weekly email that makes them want to click through and try something. ' +
          'Be concrete: name the task the server lets an agent do ("have Claude diff two Postgres schemas"), not adjectives. ' +
          'Use only facts present in the input. No hype ("game-changer", "revolutionary", "supercharge", "unlock"), no emoji, no exclamation marks. ' +
          'Return JSON with:\n' +
          '"pickId": the id from SHORTLIST most likely to be useful and interesting to the broadest set of developers;\n' +
          '"pickWriteup": 2-3 sentences (under 330 chars) on what it lets you do and who should try it — do not start with its name;\n' +
          '"intro": 1-2 sentences (under 200 chars) setting up this week\'s email;\n' +
          '"subject": email subject under 60 chars that names the pick or one concrete thing from this week; no "This week on AllMCPs";\n' +
          '"previewText": inbox preview under 100 chars that complements the subject (mention another highlight, not a repeat);\n' +
          '"items": [{id, blurb}] for EVERY listing in SHORTLIST and OTHERS — one sentence under 140 chars on what you can do with it; ' +
          'do not start with the server name or "This server". Keep every id exactly as provided.',
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

  if (!result.ok) return null;
  const data = result.data;
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const blurbs: Record<string, string> = {};
  for (const item of data.items || []) {
    const blurb = text(item?.blurb);
    if (item?.id && blurb) blurbs[item.id] = blurb;
  }
  const pickId = shortlist.some((c) => c.id === data.pickId)
    ? (data.pickId as string)
    : null;
  const subject = text(data.subject);

  return {
    pickId,
    pickWriteup: text(data.pickWriteup),
    intro: text(data.intro) || FALLBACK_INTROS[week % FALLBACK_INTROS.length],
    // A runaway subject gets clipped by every inbox; fall back rather than truncate mid-word.
    subject: subject.length <= 80 ? subject : '',
    previewText: truncate(text(data.previewText), 140),
    blurbs,
  };
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
}): Promise<string> {
  const res = await sequenzyFetch('/campaigns', {
    name: `Weekly Digest — ${new Date().toISOString().slice(0, 10)}`,
    subject: input.subject,
    previewText: input.previewText,
    blocks: input.blocks,
    targetLists: { type: 'lists', listIds: [NEWSLETTER_SUBSCRIBERS_LIST_ID] },
    // No senderProfileId/replyProfileId here on purpose: this inherits the
    // company's default sender/reply identity so it can't go stale if that
    // default ever changes (it hardcoded an old sender profile ID before).
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

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

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

    const [newPool, trendingPool] = await Promise.all([
      loadNewCandidates(db, since),
      loadTrendingCandidates(db, since),
    ]);

    if (newPool.length === 0 && trendingPool.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'No listings to feature this week.',
      });
    }

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

    const llm = await generateEditorial(
      week,
      shortlist,
      [...newRanked.slice(3), ...trendingRanked.slice(2)],
      blogPost,
    );

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
      intro: llm?.intro || FALLBACK_INTROS[week % FALLBACK_INTROS.length],
      pickWriteup: llm?.pickWriteup || '',
      blurbs: llm?.blurbs || {},
    };

    const pickTitle = pick ? displayName(pick.name).title : '';
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
    });
    await scheduleSequenzyCampaign(campaignId);

    return NextResponse.json({
      success: true,
      campaignId,
      subject,
      pick: pick?.id ?? null,
      newCount: newListings.length,
      trendingCount: trending.length,
      blogPost: blogPost?.slug ?? null,
      editorial: llm ? 'llm' : 'fallback',
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
