import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getAuthorizedAdminEmail } from '../../../../lib/accessAuth';
import { isSafeSubmissionUrl } from '../../../../lib/urlSafety';
import { computeFeaturedUntil } from '../../../../lib/featuredGrant';

import { tweetMcpServer } from '../../../../lib/twitter';

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum([
    'approve',
    'reject',
    'set_premium',
    'unset_premium',
    'edit',
    'unpublish',
    'republish',
    'delete',
    'feature',
  ]),
  fields: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().min(1).max(2000).optional(),
      category: z.string().trim().min(1).max(100).optional(),
      url: z.string().trim().min(1).optional(),
      websiteUrl: z.string().trim().optional(),
    })
    .optional(),
  days: z.number().int().min(1).max(365).optional(),
});

const MESSAGES: Record<string, string> = {
  approve: 'Listing approved.',
  reject: 'Listing rejected.',
  set_premium: 'Marked premium (dofollow).',
  unset_premium: 'Premium removed (nofollow).',
  edit: 'Listing updated.',
  unpublish: 'Listing unpublished.',
  republish: 'Listing republished.',
  delete: 'Listing permanently deleted.',
  feature: 'Featured placement granted.',
};

export async function POST(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const result = actionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }

    const { id, action, fields, days } = result.data;

    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (e) {
      throw new Error("Could not get Cloudflare context.");
    }

    if (!env || !env.DB) {
      throw new Error("Database binding not found");
    }

    const db = drizzle(env.DB as any);

    if (action === 'approve') {
      const updateResult = await db.update(servers)
        .set({ status: 'active' })
        .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
        .returning();

      if (updateResult.length === 0) {
         return NextResponse.json({ error: "Server not found or not in pending state." }, { status: 400 });
      }

      // Auto-tweet newly approved MCP server
      try {
        const approvedServer = updateResult[0];
        await tweetMcpServer({
          id: approvedServer.id,
          name: approvedServer.name,
          description: approvedServer.description,
          category: approvedServer.category,
          isNew: true,
        });
      } catch (e) {
        console.error('Failed to tweet on server approval:', e);
      }
    } else if (action === 'reject') {
      const deleteResult = await db.delete(servers)
        .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
        .returning();

      if (deleteResult.length === 0) {
         return NextResponse.json({ error: "Server not found or not in pending state." }, { status: 400 });
      }
    } else if (action === 'set_premium' || action === 'unset_premium') {
      const updateResult = await db.update(servers)
        .set({ isPremium: action === 'set_premium' })
        .where(eq(servers.id, id))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }
    } else if (action === 'edit') {
      if (!fields || Object.keys(fields).length === 0) {
        return NextResponse.json({ error: "No fields provided." }, { status: 400 });
      }

      const updates: Record<string, unknown> = {};
      if (fields.name !== undefined) updates.name = fields.name;
      if (fields.description !== undefined) updates.description = fields.description;
      if (fields.category !== undefined) updates.category = fields.category;
      if (fields.url !== undefined) {
        if (!isSafeSubmissionUrl(fields.url)) {
          return NextResponse.json({ error: "Primary URL must be a public http(s) address." }, { status: 400 });
        }
        updates.url = fields.url;
      }
      if (fields.websiteUrl !== undefined) {
        if (fields.websiteUrl && !isSafeSubmissionUrl(fields.websiteUrl)) {
          return NextResponse.json({ error: "Website URL must be a public http(s) address." }, { status: 400 });
        }
        updates.websiteUrl = fields.websiteUrl || null;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
      }

      const updateResult = await db.update(servers)
        .set(updates)
        .where(eq(servers.id, id))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }
    } else if (action === 'unpublish' || action === 'republish') {
      const fromStatus = action === 'unpublish' ? 'active' : 'removed';
      const toStatus = action === 'unpublish' ? 'removed' : 'active';

      const updateResult = await db.update(servers)
        .set({ status: toStatus })
        .where(and(eq(servers.id, id), eq(servers.status, fromStatus)))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json(
          { error: `Server not found or not currently ${fromStatus}.` },
          { status: 400 }
        );
      }
    } else if (action === 'delete') {
      const deleteResult = await db.delete(servers)
        .where(eq(servers.id, id))
        .returning();

      if (deleteResult.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }
    } else if (action === 'feature') {
      if (!days) {
        return NextResponse.json({ error: "days is required." }, { status: 400 });
      }

      const rows = await db.select({ featuredUntil: servers.featuredUntil })
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);

      if (rows.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }

      const newFeaturedUntil = computeFeaturedUntil(rows[0].featuredUntil, days);

      await db.update(servers)
        .set({ featuredUntil: newFeaturedUntil })
        .where(eq(servers.id, id));

      return NextResponse.json({
        success: true,
        message: MESSAGES.feature,
        featuredUntil: newFeaturedUntil.toISOString(),
      });
    }

    return NextResponse.json({ success: true, message: MESSAGES[action] });
  } catch (error) {
    console.error("Admin action error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
