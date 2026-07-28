import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const claimSchema = z.object({
  id: z.string().min(1)
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = claimSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }
    
    const { id } = result.data;
    
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
    
    // 1. Get the exact server URL from the database
    const dbServers = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    const server = dbServers[0];
    
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    if (server.isOfficial) {
      return NextResponse.json({ success: true, message: "Already verified!" });
    }
    
    // 2. Extract GitHub details
    const githubMatch = server.url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!githubMatch) {
      return NextResponse.json({ error: "Cannot verify non-GitHub URLs yet." }, { status: 400 });
    }
    
    const owner = githubMatch[1];
    let repo = githubMatch[2];
    if (repo.endsWith('.git')) repo = repo.slice(0, -4);
    
    // 3. Fetch README (Try main then master)
    let readmeText = '';
    const branches = ['main', 'master'];
    let fetched = false;
    
    for (const branch of branches) {
      try {
        const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`);
        if (res.ok) {
          readmeText = await res.text();
          fetched = true;
          break;
        }
      } catch (e) {
        // ignore and try next
      }
    }
    
    if (!fetched) {
       return NextResponse.json({ error: "Could not fetch README from GitHub. Ensure it exists on main or master." }, { status: 400 });
    }
    
    // 4. Check for the badge
    const expectedBadge = `[![AllMCPs Verified](https://img.shields.io/badge/AllMCPs-Verified-blue)](https://allmcps.com/mcp/${id})`;
    
    // We do a simple includes check, removing whitespace in case they formatted it weirdly
    const normalizedReadme = readmeText.replace(/\s+/g, '');
    const normalizedBadge = expectedBadge.replace(/\s+/g, '');
    
    if (!normalizedReadme.includes(normalizedBadge)) {
      return NextResponse.json({ error: "Verification badge not found in README." }, { status: 400 });
    }
    
    // 5. Success! Update database
    await db.update(servers).set({ isOfficial: true }).where(eq(servers.id, id));
    
    return NextResponse.json({ success: true, message: "Successfully verified! Your profile is now official." });
  } catch (error) {
    console.error("Claim error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
