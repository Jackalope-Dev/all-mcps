import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getAuthorizedAdminEmail } from '../../../../lib/accessAuth';

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['approve', 'reject']),
});

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
    
    const { id, action } = result.data;
    
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
    } else if (action === 'reject') {
      const deleteResult = await db.delete(servers)
        .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
        .returning();
        
      if (deleteResult.length === 0) {
         return NextResponse.json({ error: "Server not found or not in pending state." }, { status: 400 });
      }
    }
    
    return NextResponse.json({ success: true, message: `Server successfully ${action}d.` });
  } catch (error) {
    console.error("Admin action error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
