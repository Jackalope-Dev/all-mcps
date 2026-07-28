import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const metricSchema = z.object({
  metric: z.enum(["view", "copy", "upvote"])
});

export const runtime = 'edge';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = metricSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }
    
    const { metric } = result.data;
    
    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (e) {
      return NextResponse.json({ error: "Could not get Cloudflare context." }, { status: 500 });
    }

    if (!env || !env.DB) {
      return NextResponse.json({ error: "Database binding not found" }, { status: 500 });
    }
    
    const db = drizzle(env.DB as any);
    
    let updateQuery;
    
    switch (metric) {
      case "view":
        updateQuery = { views: sql`${servers.views} + 1` };
        break;
      case "copy":
        updateQuery = { copies: sql`${servers.copies} + 1` };
        break;
      case "upvote":
        updateQuery = { upvotes: sql`${servers.upvotes} + 1` };
        break;
    }
    
    await db.update(servers)
      .set(updateQuery)
      .where(eq(servers.id, id));
      
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Metric update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
