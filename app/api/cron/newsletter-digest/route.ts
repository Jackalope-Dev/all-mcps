import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, gte, desc, notInArray, sql } from 'drizzle-orm';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';

const NEW_WINDOW_DAYS = 7;
const MAX_PER_SECTION = 6;
const NEWSLETTER_SUBSCRIBERS_LIST_ID = 'ta0zh9e3l9rcjlfpzpk80tcn';
const SENDER_PROFILE_ID = 'p1dmte08v6jd67cnlvz43396';
const REPLY_PROFILE_ID = 'nmr7hkbzz2qpkq3mgs7dmhjk';
const APP_URL = 'https://allmcps.com';

type ListingSummary = { id: string; name: string; description: string };
type SequenzyBlock = Record<string, any>;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function listingBlocks(listing: ListingSummary): SequenzyBlock[] {
  return [
    { type: 'heading', content: listing.name, level: 3 },
    { type: 'text', content: `<p>${truncate(listing.description, 140)}</p>`, variant: 'paragraph' },
    { type: 'button', text: 'View →', url: `${APP_URL}/mcp/${listing.id}`, variant: 'secondary' },
  ];
}

function buildDigestBlocks(
  newListings: ListingSummary[],
  trendingListings: ListingSummary[]
): SequenzyBlock[] {
  const blocks: SequenzyBlock[] = [{ type: 'heading', content: 'This week on AllMCPs', level: 1 }];

  if (newListings.length > 0) {
    blocks.push({ type: 'heading', content: 'New this week', level: 2 });
    for (const listing of newListings) blocks.push(...listingBlocks(listing));
  }

  if (trendingListings.length > 0) {
    blocks.push({ type: 'heading', content: 'Trending', level: 2 });
    for (const listing of trendingListings) blocks.push(...listingBlocks(listing));
  }

  blocks.push({ type: 'button', text: 'Browse the full directory →', url: `${APP_URL}/browse`, variant: 'primary' });

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
      senderProfileId: SENDER_PROFILE_ID,
      replyProfileId: REPLY_PROFILE_ID,
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
      .select({ id: servers.id, name: servers.name, description: servers.description })
      .from(servers)
      .where(and(eq(servers.status, 'active'), gte(servers.createdAt, sinceDate)))
      .orderBy(desc(servers.createdAt))
      .limit(MAX_PER_SECTION);

    const newIds = newRows.map((r) => r.id);

    const trendingRows = await db
      .select({ id: servers.id, name: servers.name, description: servers.description })
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
