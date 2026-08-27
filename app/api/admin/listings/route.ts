import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  like,
  ne,
  or,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '@/db/schema';
import { getAuthorizedAdminEmail } from '@/lib/adminAuth';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

export async function GET(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const search = (url.searchParams.get('search') || '').trim();
    const status = url.searchParams.get('status') || 'all';
    const premium = url.searchParams.get('premium');
    const featured = url.searchParams.get('featured');
    const health = url.searchParams.get('health');
    const category = url.searchParams.get('category');
    const aiEnriched = url.searchParams.get('aiEnriched');
    const hasTools = url.searchParams.get('hasTools');
    const hasToolsError = url.searchParams.get('hasToolsError');
    const categorySponsor = url.searchParams.get('categorySponsor');
    const pricingModel = url.searchParams.get('pricingModel');
    const authType = url.searchParams.get('authType');
    const maintenanceStatus = url.searchParams.get('maintenanceStatus');
    const sortBy = url.searchParams.get('sort') || 'createdAt';
    const sortOrder = url.searchParams.get('order') || 'desc';

    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT),
    );

    let env: CloudflareEnv | undefined;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (e) {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env?.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);

    const conditions = [];
    if (status !== 'all') {
      conditions.push(eq(servers.status, status));
    }
    if (search) {
      conditions.push(
        or(like(servers.name, `%${search}%`), like(servers.url, `%${search}%`)),
      );
    }
    if (premium === 'true' || premium === 'false') {
      conditions.push(eq(servers.isPremium, premium === 'true'));
    }
    if (featured === 'true') {
      conditions.push(
        or(eq(servers.isPremium, true), gt(servers.featuredUntil, new Date())),
      );
    }
    if (categorySponsor === 'true') {
      conditions.push(gt(servers.categorySponsorUntil, new Date()));
    }
    if (health === 'unhealthy') {
      conditions.push(ne(servers.healthStatus, 'healthy'));
    } else if (health) {
      conditions.push(eq(servers.healthStatus, health));
    }
    if (category) {
      conditions.push(eq(servers.category, category));
    }
    if (pricingModel) {
      conditions.push(eq(servers.pricingModel, pricingModel));
    }
    if (authType) {
      conditions.push(eq(servers.authType, authType));
    }
    if (maintenanceStatus) {
      conditions.push(eq(servers.maintenanceStatus, maintenanceStatus));
    }
    if (aiEnriched === 'true') {
      conditions.push(isNotNull(servers.aiSummary));
    } else if (aiEnriched === 'false') {
      conditions.push(isNull(servers.aiSummary));
    }
    if (hasTools === 'true') {
      conditions.push(isNotNull(servers.tools));
    } else if (hasTools === 'false') {
      conditions.push(isNull(servers.tools));
    }
    if (hasToolsError === 'true') {
      conditions.push(isNotNull(servers.toolsError));
    } else if (hasToolsError === 'false') {
      conditions.push(isNull(servers.toolsError));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let orderByClause: SQL;
    const isAsc = sortOrder === 'asc';
    if (sortBy === 'name')
      orderByClause = isAsc ? asc(servers.name) : desc(servers.name);
    else if (sortBy === 'views')
      orderByClause = isAsc ? asc(servers.views) : desc(servers.views);
    else if (sortBy === 'upvotes')
      orderByClause = isAsc ? asc(servers.upvotes) : desc(servers.upvotes);
    else if (sortBy === 'stars')
      orderByClause = isAsc
        ? asc(servers.githubStars)
        : desc(servers.githubStars);
    else
      orderByClause = isAsc ? asc(servers.createdAt) : desc(servers.createdAt);

    const [items, totalRows] = await Promise.all([
      db
        .select({
          id: servers.id,
          name: servers.name,
          url: servers.url,
          websiteUrl: servers.websiteUrl,
          submitterEmail: servers.submitterEmail,
          description: servers.description,
          category: servers.category,
          createdAt: servers.createdAt,
          isPremium: servers.isPremium,
          isOfficial: servers.isOfficial,
          websiteVerified: servers.websiteVerified,
          reciprocalBadgeOk: servers.reciprocalBadgeOk,
          status: servers.status,
          healthStatus: servers.healthStatus,
          featuredUntil: servers.featuredUntil,
          categorySponsorUntil: servers.categorySponsorUntil,
          aiSummary: servers.aiSummary,
          tools: servers.tools,
          toolsError: servers.toolsError,
          toolsCheckedAt: servers.toolsCheckedAt,
          githubStars: servers.githubStars,
          npmDownloads: servers.npmDownloads,
          views: servers.views,
          upvotes: servers.upvotes,
          copies: servers.copies,
          ownerUserId: servers.ownerUserId,
          tags: servers.tags,
          pricingModel: servers.pricingModel,
          pricingNotes: servers.pricingNotes,
          authType: servers.authType,
          license: servers.license,
          compatibleClients: servers.compatibleClients,
          maintenanceStatus: servers.maintenanceStatus,
          supportUrl: servers.supportUrl,
          suggestedInstallCommand: servers.suggestedInstallCommand,
          suggestedInstallArgs: servers.suggestedInstallArgs,
        })
        .from(servers)
        .where(where)
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(servers).where(where),
    ]);

    return NextResponse.json({
      items: items.map((s: (typeof items)[number]) => ({
        ...s,
        createdAt:
          s.createdAt instanceof Date
            ? s.createdAt.toISOString()
            : String(s.createdAt),
        featuredUntil:
          s.featuredUntil instanceof Date
            ? s.featuredUntil.toISOString()
            : s.featuredUntil,
        categorySponsorUntil:
          s.categorySponsorUntil instanceof Date
            ? s.categorySponsorUntil.toISOString()
            : s.categorySponsorUntil,
        toolsCheckedAt:
          s.toolsCheckedAt instanceof Date
            ? s.toolsCheckedAt.toISOString()
            : s.toolsCheckedAt,
      })),
      total: totalRows[0]?.total ?? 0,
    });
  } catch (error) {
    console.error('Admin listings error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
