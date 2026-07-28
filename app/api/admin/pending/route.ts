import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { isAdminAuthorized } from '../../../../lib/adminAuth';

export async function GET(req: Request) {
  try {
    if (!isAdminAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized. Invalid ADMIN_SECRET." }, { status: 401 });
    }

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
    const pendingServers = await db.select().from(servers).where(eq(servers.status, 'pending'));

    return NextResponse.json({
      servers: pendingServers.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Admin pending fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
