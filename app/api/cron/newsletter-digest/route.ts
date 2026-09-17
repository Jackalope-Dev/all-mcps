import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, desc, eq, gte, notInArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '../../../../db/schema';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import { cleanListingDescription } from '../../../../lib/description';
import { chatJson } from '../../../../lib/openai';

const NEW_WINDOW_DAYS = 7;
const MAX_PER_SECTION = 6;
const NEWSLETTER_SUBSCRIBERS_LIST_ID = 'ta0zh9e3l9rcjlfpzpk80tcn';
const APP_URL = 'https://allmcps.com';

/**
 * Logos are stored as site-relative paths (e.g. `/logos/<id>`, served from R2 by
 * app/logos/[id]/route.ts). That works in the browser but breaks in email, where an
 * `<img src="/logos/…">` resolves against the mail client's own domain and 404s — this
 * is why claimed listings (which have a logo) showed a broken image while unclaimed ones
 * fell back cleanly to the letter tile. Absolutize every relative asset URL for email.
 */
function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${APP_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

type ListingSummary = {
  id: string;
  name: string;
  description: string;
  category: string;
  logoUrl: string | null;
};
type SequenzyBlock = Record<string, any>;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const INSTALL_COMMAND_RE =
  /\b(npx|npm\s+install|pip3?\s+install|uvx|uv\s+pip|docker\s+run|go\s+install|cargo\s+install|brew\s+install)\b/i;

// Shared cleaner strips the scraped README chrome (leading badge link, platform-icon
// emoji, separator dash). On top of that, a marketing email also wants the trailing
// install-command clause ("npx -y ...", "Install: npx ...") gone — it reads as noise
// here rather than on the directory page it belongs on.
function cleanDescription(description: string): string {
  let text = cleanListingDescription(description);

  const installIdx = text.search(INSTALL_COMMAND_RE);
  if (installIdx !== -1) {
    text = text
      .slice(0, installIdx)
      .replace(/[\s.;:,(\-–—]+$/, '')
      .trim();
  }

  return text;
}

// Solid-color counterparts of DirectoryGrid.tsx's getGradient() palette (the darker
// stop of each gradient, for contrast with white text) — CSS gradients aren't
// reliably supported in email clients, but using the same hash keeps a given
// listing's fallback color consistent between the site and this email.
const FALLBACK_COLORS = [
  '#007bff',
  '#0f172a',
  '#0369a1',
  '#1e3a8a',
  '#164e63',
  '#1d4ed8',
];

function fallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function initialLetter(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u);
  return (match ? match[0] : 'M').toUpperCase();
}

function listingHeaderHtml(listing: ListingSummary): string {
  const name = escapeHtml(listing.name);
  const category = escapeHtml(listing.category);
  // Absolutize the (site-relative) logo path so it renders in email clients, and use the
  // listing name as alt text so a missing image degrades to a label rather than a blank box.
  const icon = listing.logoUrl
    ? `<img src="${escapeHtml(absoluteUrl(listing.logoUrl))}" width="48" height="48" alt="${name}" style="display:block;border-radius:8px;object-fit:cover" />`
    : `<table role="presentation" width="48" height="48" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;border-radius:8px;background-color:${fallbackColor(
        listing.name,
      )};color:#ffffff;font-family:Arial,sans-serif;font-size:20px;font-weight:800">${escapeHtml(
        initialLetter(listing.name),
      )}</td></tr></table>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td width="48" valign="top" style="width:48px;padding-right:12px">${icon}</td><td valign="top"><div style="font-weight:700;font-size:16px;color:#020617;line-height:1.3;margin-bottom:4px">${name}</div><span style="display:inline-block;background-color:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:9999px;padding:2px 10px;font-size:11px;font-weight:600">${category}</span></td></tr></table>`;
}

// Shared "card" look for a listing: light background + hairline border + radius,
// via Sequenzy's block-level `styles` object rather than hand-rolled HTML, so it
// renders through the same email-safe pipeline as every other block.
const LISTING_CARD_STYLES = {
  backgroundColor: '#f8fafc',
  borderColor: '#e2e8f0',
  borderWidth: 1,
  borderRadius: 12,
  paddingTop: 20,
  paddingBottom: 20,
  paddingLeft: 20,
  paddingRight: 20,
};

function listingBlocks(
  listing: ListingSummary,
  blurb?: string,
): SequenzyBlock[] {
  // Prefer the LLM-written editorial blurb ("why it's worth a look"); fall back to the
  // cleaned scrape so the section still reads well when the LLM is unavailable.
  const copy =
    blurb && /[\p{L}\p{N}]/u.test(blurb)
      ? truncate(blurb.trim(), 160)
      : truncate(cleanDescription(listing.description), 140);

  let content = listingHeaderHtml(listing);
  if (/[\p{L}\p{N}]/u.test(copy)) {
    content += `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#475569">${escapeHtml(copy)}</p>`;
  }
  // A plain text link, not a button — one full-width button per listing (6+ per
  // email) read as a wall of chrome. The link lives inside the card's own HTML
  // block (rather than a separate `button` block) so it sits flush under the
  // blurb instead of as a visually distinct element under it.
  content += `<a href="${escapeHtml(`${APP_URL}/mcp/${listing.id}`)}" style="display:inline-block;margin-top:14px;font-size:13px;font-weight:600;color:#2563eb;text-decoration:none">${escapeHtml(
    truncate(listing.name, 30),
  )} →</a>`;

  return [
    { type: 'text', variant: 'html', content, styles: LISTING_CARD_STYLES },
    { type: 'spacer', height: 12 },
  ];
}

// --- Weekly variety -------------------------------------------------------
// The digest goes out every Monday. To keep it from feeling like the same
// template each week, section headings, the intro line, and the subject teaser
// rotate on an ISO-week cadence — deterministic (stable within a week) but
// different week to week even if the LLM editorial pass is unavailable.

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

function rotate<T>(arr: T[], week: number): T {
  return arr[((week % arr.length) + arr.length) % arr.length];
}

const NEW_HEADINGS = [
  'New this week',
  'Fresh arrivals',
  'Just added',
  'New in the directory',
];
const TRENDING_HEADINGS = [
  'Trending',
  'Community favorites',
  'Catching on',
  'Most loved right now',
];
const FALLBACK_INTROS = [
  'Fresh MCP servers and community favorites, hand-picked from the directory.',
  'A few new tools to give your agents this week — plus what the community is loving.',
  "The latest servers to hit AllMCPs, and the ones everyone's installing.",
  'New capabilities for your AI agents, straight from this week’s directory activity.',
];
const FALLBACK_TEASERS = [
  'fresh servers to try',
  'this week’s standouts',
  'new tools for your agents',
  'what the community is loving',
];

type Editorial = {
  intro: string;
  subjectTeaser: string;
  blurbs: Record<string, string>;
};

/**
 * Ask the LLM to write an editorial intro and a one-line "why it's worth a look" blurb
 * per featured listing, so the email reads like a curated newsletter rather than a scrape
 * dump. Fail-soft: any budget/timeout/parse error returns null and the caller uses the
 * deterministic weekly-rotation fallbacks instead — the send never depends on the LLM.
 */
async function generateEditorial(
  week: number,
  newListings: ListingSummary[],
  trendingListings: ListingSummary[],
): Promise<Editorial | null> {
  const all = [...newListings, ...trendingListings];
  if (all.length === 0) return null;

  const payload = all.map((l) => ({
    id: l.id,
    name: l.name,
    category: l.category,
    about: truncate(cleanDescription(l.description) || l.description, 220),
  }));

  const result = await chatJson<{
    intro?: string;
    subjectTeaser?: string;
    items?: Array<{ id: string; blurb?: string }>;
  }>({
    model: 'gpt-5.6-luna',
    temperature: 0.6,
    maxTokens: 900,
    timeoutMs: 20_000,
    messages: [
      {
        role: 'system',
        content:
          'You are the editor of AllMCPs, a directory of Model Context Protocol (MCP) servers for AI agents. ' +
          'Write concise, energetic-but-professional copy for a weekly email digest. ' +
          'No hype clichés ("game-changer", "revolutionary"), no emoji, no marketing filler. ' +
          'Return JSON with: "intro" (1-2 sentences, under 240 chars, sets up this week\'s picks), ' +
          '"subjectTeaser" (3-6 words, no trailing punctuation, for the email subject line), and ' +
          '"items" (array of {id, blurb} for every listing you are given; blurb is ONE sentence under 130 chars ' +
          "on what the server does and who'd want it). Keep every id exactly as provided.",
      },
      {
        role: 'user',
        content:
          `Write the digest for ISO week ${week}. Featured listings (JSON):\n` +
          JSON.stringify(payload),
      },
    ],
  });

  if (!result.ok) return null;

  const blurbs: Record<string, string> = {};
  for (const item of result.data.items || []) {
    if (item?.id && typeof item.blurb === 'string' && item.blurb.trim()) {
      blurbs[item.id] = item.blurb.trim();
    }
  }

  const intro =
    typeof result.data.intro === 'string' ? result.data.intro.trim() : '';
  const subjectTeaser =
    typeof result.data.subjectTeaser === 'string'
      ? result.data.subjectTeaser.trim().replace(/[.!?]+$/, '')
      : '';

  return {
    intro: intro || rotate(FALLBACK_INTROS, week),
    subjectTeaser: subjectTeaser || rotate(FALLBACK_TEASERS, week),
    blurbs,
  };
}

function buildDigestBlocks(
  newListings: ListingSummary[],
  trendingListings: ListingSummary[],
  week: number,
  editorial: Editorial | null,
): SequenzyBlock[] {
  const intro = editorial?.intro || rotate(FALLBACK_INTROS, week);
  const blurbs = editorial?.blurbs || {};

  const blocks: SequenzyBlock[] = [
    { type: 'logo', alt: 'AllMCPs Logo', align: 'center', width: 64 },
    { type: 'heading', content: 'This week on AllMCPs', level: 1 },
    {
      type: 'text',
      variant: 'paragraph',
      content: `<p>${escapeHtml(intro)}</p>`,
    },
    { type: 'spacer', height: 8 },
  ];

  if (newListings.length > 0) {
    blocks.push({
      type: 'heading',
      content: rotate(NEW_HEADINGS, week),
      level: 2,
    });
    blocks.push({ type: 'spacer', height: 4 });
    for (const listing of newListings)
      blocks.push(...listingBlocks(listing, blurbs[listing.id]));
  }

  if (trendingListings.length > 0) {
    // Only when both sections are present — a lone section already reads clearly
    // without a rule separating it from nothing.
    if (newListings.length > 0) blocks.push({ type: 'divider' });
    blocks.push({
      type: 'heading',
      content: rotate(TRENDING_HEADINGS, week),
      level: 2,
    });
    blocks.push({ type: 'spacer', height: 4 });
    for (const listing of trendingListings)
      blocks.push(...listingBlocks(listing, blurbs[listing.id]));
  }

  blocks.push({ type: 'spacer', height: 8 });
  blocks.push({
    type: 'button',
    text: 'Browse the full directory →',
    url: `${APP_URL}/browse`,
    variant: 'primary',
  });
  blocks.push({
    type: 'footer',
    address: 'Jackalope Digital \n1500 N GRANT ST # 7225 \nDENVER, CO 80203',
    variant: 'full',
    companyName: 'AllMCPs',
    privacyPolicyUrl: 'https://allmcps.com/privacy',
  });

  return blocks;
}

async function createSequenzyCampaign(input: {
  subject: string;
  blocks: SequenzyBlock[];
}): Promise<string> {
  const key = process.env.SEQUENZY_CAMPAIGNS_API_KEY;
  if (!key) throw new Error('SEQUENZY_CAMPAIGNS_API_KEY is not configured');

  const res = await fetch('https://api.sequenzy.com/api/v1/campaigns', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Weekly Digest — ${new Date().toISOString().slice(0, 10)}`,
      subject: input.subject,
      blocks: input.blocks,
      targetLists: { type: 'lists', listIds: [NEWSLETTER_SUBSCRIBERS_LIST_ID] },
      // No senderProfileId/replyProfileId here on purpose: this inherits the
      // company's default sender/reply identity so it can't go stale if that
      // default ever changes (it hardcoded an old sender profile ID before).
    }),
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
  const key = process.env.SEQUENZY_CAMPAIGNS_API_KEY;
  if (!key) throw new Error('SEQUENZY_CAMPAIGNS_API_KEY is not configured');

  const scheduledAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const res = await fetch(
    `https://api.sequenzy.com/api/v1/campaigns/${campaignId}/schedule`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scheduledAt }),
    },
  );

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
    } catch (e) {
      throw new Error('Could not get Cloudflare context.');
    }
    if (!env || !(env as any).DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle((env as any).DB);
    const sinceDate = new Date(
      Date.now() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const newRows = await db
      .select({
        id: servers.id,
        name: servers.name,
        description: servers.description,
        category: servers.category,
        logoUrl: servers.logoUrl,
      })
      .from(servers)
      .where(
        and(eq(servers.status, 'active'), gte(servers.createdAt, sinceDate)),
      )
      .orderBy(desc(servers.createdAt))
      .limit(MAX_PER_SECTION);

    const newIds = newRows.map((r) => r.id);

    const trendingRows = await db
      .select({
        id: servers.id,
        name: servers.name,
        description: servers.description,
        category: servers.category,
        logoUrl: servers.logoUrl,
      })
      .from(servers)
      .where(
        newIds.length > 0
          ? and(eq(servers.status, 'active'), notInArray(servers.id, newIds))
          : eq(servers.status, 'active'),
      )
      .orderBy(desc(sql`(${servers.upvotes} * 5 + ${servers.copies})`))
      .limit(MAX_PER_SECTION);

    if (newRows.length === 0 && trendingRows.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'No listings to feature this week.',
      });
    }

    const week = isoWeek(new Date());

    // Editorial pass (LLM): intro + per-listing blurbs + a subject teaser. Fail-soft —
    // null here means the deterministic weekly-rotation fallbacks are used instead.
    const editorial = await generateEditorial(week, newRows, trendingRows);

    // Subject line: prefer the LLM's fresh teaser so it varies week to week; otherwise
    // fall back to the concrete "N new, M trending" summary.
    let subject: string;
    if (editorial?.subjectTeaser) {
      subject = `This week on AllMCPs: ${editorial.subjectTeaser}`;
    } else {
      const subjectParts: string[] = [];
      if (newRows.length > 0)
        subjectParts.push(
          `${newRows.length} new server${newRows.length === 1 ? '' : 's'}`,
        );
      if (trendingRows.length > 0)
        subjectParts.push(`${trendingRows.length} trending`);
      subject = `This week on AllMCPs: ${subjectParts.join(', ')}`;
    }

    const blocks = buildDigestBlocks(newRows, trendingRows, week, editorial);
    const campaignId = await createSequenzyCampaign({ subject, blocks });
    await scheduleSequenzyCampaign(campaignId);

    return NextResponse.json({
      success: true,
      campaignId,
      newCount: newRows.length,
      trendingCount: trendingRows.length,
      editorial: editorial ? 'llm' : 'fallback',
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
