import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, gte, desc, notInArray, sql } from 'drizzle-orm';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { cleanListingDescription } from '../../../../lib/description';

const NEW_WINDOW_DAYS = 7;
const MAX_PER_SECTION = 6;
const NEWSLETTER_SUBSCRIBERS_LIST_ID = 'ta0zh9e3l9rcjlfpzpk80tcn';
const APP_URL = 'https://allmcps.com';

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
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    text = text.slice(0, installIdx).replace(/[\s.;:,(\-–—]+$/, '').trim();
  }

  return text;
}

// Solid-color counterparts of DirectoryGrid.tsx's getGradient() palette (the darker
// stop of each gradient, for contrast with white text) — CSS gradients aren't
// reliably supported in email clients, but using the same hash keeps a given
// listing's fallback color consistent between the site and this email.
const FALLBACK_COLORS = ['#007bff', '#0f172a', '#0369a1', '#1e3a8a', '#164e63', '#1d4ed8'];

function fallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function initialLetter(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u);
  return (match ? match[0] : 'M').toUpperCase();
}

function listingHeaderHtml(listing: ListingSummary): string {
  const name = escapeHtml(listing.name);
  const category = escapeHtml(listing.category);
  const icon = listing.logoUrl
    ? `<img src="${escapeHtml(listing.logoUrl)}" width="48" height="48" alt="" style="display:block;border-radius:8px;object-fit:cover" />`
    : `<table role="presentation" width="48" height="48" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;border-radius:8px;background-color:${fallbackColor(
        listing.name
      )};color:#ffffff;font-family:Arial,sans-serif;font-size:20px;font-weight:800">${escapeHtml(
        initialLetter(listing.name)
      )}</td></tr></table>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td width="48" valign="top" style="width:48px;padding-right:12px">${icon}</td><td valign="top"><div style="font-weight:700;font-size:16px;color:#020617;line-height:1.3;margin-bottom:4px">${name}</div><span style="display:inline-block;background-color:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:9999px;padding:2px 10px;font-size:11px;font-weight:600">${category}</span></td></tr></table>`;
}

function listingBlocks(listing: ListingSummary): SequenzyBlock[] {
  const description = truncate(cleanDescription(listing.description), 140);
  const blocks: SequenzyBlock[] = [
    { type: 'text', variant: 'paragraph', content: listingHeaderHtml(listing) },
  ];
  if (/[\p{L}\p{N}]/u.test(description)) {
    blocks.push({ type: 'text', content: `<p>${escapeHtml(description)}</p>`, variant: 'paragraph' });
  }
  blocks.push({
    type: 'button',
    text: `View ${truncate(listing.name, 30)} →`,
    url: `${APP_URL}/mcp/${listing.id}`,
    variant: 'secondary',
  });
  return blocks;
}

function buildDigestBlocks(
  newListings: ListingSummary[],
  trendingListings: ListingSummary[]
): SequenzyBlock[] {
  const blocks: SequenzyBlock[] = [
    { type: 'logo', alt: 'AllMCPs Logo', align: 'center', width: 64 },
    { type: 'heading', content: 'This week on AllMCPs', level: 1 },
    {
      type: 'text',
      variant: 'paragraph',
      content: '<p>Fresh MCP servers and community favorites, hand-picked from the directory.</p>',
    },
  ];

  if (newListings.length > 0) {
    blocks.push({ type: 'heading', content: 'New this week', level: 2 });
    for (const listing of newListings) blocks.push(...listingBlocks(listing));
  }

  if (trendingListings.length > 0) {
    blocks.push({ type: 'heading', content: 'Trending', level: 2 });
    for (const listing of trendingListings) blocks.push(...listingBlocks(listing));
  }

  blocks.push({ type: 'button', text: 'Browse the full directory →', url: `${APP_URL}/browse`, variant: 'primary' });
  blocks.push({
    type: 'footer',
    address: 'Jackalope Digital \n1500 N GRANT ST # 7225 \nDENVER, CO 80203',
    variant: 'full',
    companyName: 'AllMCPs',
    privacyPolicyUrl: 'https://allmcps.com/privacy',
  });

  return blocks;
}

async function createSequenzyCampaign(input: { subject: string; blocks: SequenzyBlock[] }): Promise<string> {
  const key = process.env.SEQUENZY_CAMPAIGNS_API_KEY;
  if (!key) throw new Error('SEQUENZY_CAMPAIGNS_API_KEY is not configured');

  const res = await fetch('https://api.sequenzy.com/api/v1/campaigns', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
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

  const res = await fetch(`https://api.sequenzy.com/api/v1/campaigns/${campaignId}/schedule`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduledAt }),
  });

  if (!res.ok) {
    throw new Error(`Sequenzy campaign scheduling failed: ${res.status}`);
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env;
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
    const sinceDate = new Date(Date.now() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const newRows = await db
      .select({
        id: servers.id,
        name: servers.name,
        description: servers.description,
        category: servers.category,
        logoUrl: servers.logoUrl,
      })
      .from(servers)
      .where(and(eq(servers.status, 'active'), gte(servers.createdAt, sinceDate)))
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
          : eq(servers.status, 'active')
      )
      .orderBy(desc(sql`(${servers.upvotes} * 5 + ${servers.copies})`))
      .limit(MAX_PER_SECTION);

    if (newRows.length === 0 && trendingRows.length === 0) {
      return NextResponse.json({ success: true, skipped: true, message: 'No listings to feature this week.' });
    }

    const subjectParts: string[] = [];
    if (newRows.length > 0) subjectParts.push(`${newRows.length} new server${newRows.length === 1 ? '' : 's'}`);
    if (trendingRows.length > 0) subjectParts.push(`${trendingRows.length} trending`);
    const subject = `This week on AllMCPs: ${subjectParts.join(', ')}`;

    const blocks = buildDigestBlocks(newRows, trendingRows);
    const campaignId = await createSequenzyCampaign({ subject, blocks });
    await scheduleSequenzyCampaign(campaignId);

    return NextResponse.json({
      success: true,
      campaignId,
      newCount: newRows.length,
      trendingCount: trendingRows.length,
    });
  } catch (error: any) {
    console.error('Newsletter digest cron error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
