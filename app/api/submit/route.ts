import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../db/schema';
import { z } from 'zod';

const submitSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
});

interface Env {
  DB: D1Database;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = submitSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }
    
    const { url } = result.data;
    let name = result.data.name || '';
    let description = result.data.description || '';
    let category = result.data.category || 'Community';
    
    // 1. Auto-fill capability for GitHub URLs
    const githubMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (githubMatch) {
      const owner = githubMatch[1];
      let repo = githubMatch[2];
      if (repo.endsWith('.git')) repo = repo.slice(0, -4);
      
      try {
        const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { 'User-Agent': 'AllMCPs-Directory' }
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json() as any;
          if (!name) name = ghData.name;
          if (!description && ghData.description) description = ghData.description;
        }
      } catch (e) {
        console.error("GitHub API fetch failed", e);
      }
    }
    
    if (!name) {
      return NextResponse.json({ error: "Name could not be auto-filled, please provide it manually." }, { status: 400 });
    }
    
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // 2. Connect to Cloudflare D1
    const { env } = getCloudflareContext() as unknown as { env: Env };
    if (!env.DB) {
      throw new Error("Database binding not found");
    }
    const db = drizzle(env.DB);
    
    // 3. Insert record as 'pending_review' (Security: Cross-tenant control)
    await db.insert(servers).values({
      id,
      name,
      url,
      description: description || 'No description provided.',
      category,
      isOfficial: false,
      status: 'pending',
      createdAt: new Date(),
    }).onConflictDoNothing(); // Prevent duplicate crashes
    
    return NextResponse.json({ success: true, message: "Server submitted successfully for review!" });
  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
