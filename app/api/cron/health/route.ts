import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { eq, asc } from 'drizzle-orm';

export const runtime = 'edge';

// Maximum servers to check per cron run (keeps us under rate limits)
const BATCH_SIZE = 50;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const secret = process.env.ADMIN_SECRET || 'dev_secret';
    
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
    
    // 1. Fetch the 50 oldest checked active servers (NULL lastCheckedAt comes first)
    const batch = await db.select()
      .from(servers)
      .where(eq(servers.status, 'active'))
      .orderBy(asc(servers.lastCheckedAt))
      .limit(BATCH_SIZE);
      
    if (batch.length === 0) {
      return NextResponse.json({ success: true, message: "No active servers to check." });
    }
    
    let processed = 0;
    
    // 2. Process sequentially to avoid bursting rate limits
    for (const server of batch) {
      const now = new Date();
      let isVerifiedActive = false;
      let healthStatus = 'unknown';
      let isOfficial = server.isOfficial;
      
      try {
        if (server.url.includes('github.com')) {
          // GitHub Check
          const githubMatch = server.url.match(/github\.com\/([^/]+)\/([^/]+)/);
          if (githubMatch) {
            const owner = githubMatch[1];
            let repo = githubMatch[2];
            if (repo.endsWith('.git')) repo = repo.slice(0, -4);
            
            // Ping GitHub API
            const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
              headers: { 'User-Agent': 'AllMCPs-Health-Checker' }
            });
            
            if (ghRes.ok) {
              const ghData = await ghRes.json() as any;
              if (ghData.archived || ghData.disabled) {
                healthStatus = 'archived';
              } else {
                isVerifiedActive = true;
                healthStatus = 'healthy';
                
                // Autonomous Badge Check (Viral loop)
                const readmeRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`);
                if (readmeRes.ok) {
                  const text = await readmeRes.text();
                  const badge = `[![AllMCPs Verified](https://img.shields.io/badge/AllMCPs-Verified-blue)](https://allmcps.com/mcp/${server.id})`;
                  if (text.replace(/\s+/g, '').includes(badge.replace(/\s+/g, ''))) {
                    isOfficial = true; // They added the badge!
                  } else {
                    isOfficial = false; // Badge not found, remove verification
                  }
                }
              }
            } else if (ghRes.status === 404) {
              healthStatus = 'offline'; // Repo deleted or made private
            }
          }
        } else {
          // Hosted Endpoint Check
          const pingRes = await fetch(server.url, { method: 'HEAD' }).catch(() => null);
          if (pingRes && pingRes.status < 500) {
            isVerifiedActive = true;
            healthStatus = 'healthy';
          } else {
            // Try GET if HEAD fails
            const getRes = await fetch(server.url, { method: 'GET' }).catch(() => null);
            if (getRes && getRes.status < 500) {
               isVerifiedActive = true;
               healthStatus = 'healthy';
            } else {
               healthStatus = 'offline';
            }
          }
        }
      } catch (e) {
        healthStatus = 'offline';
      }
      
      // Update the record in D1
      await db.update(servers).set({
        lastCheckedAt: now,
        isVerifiedActive,
        healthStatus,
        isOfficial
      }).where(eq(servers.id, server.id));
      
      processed++;
    }
    
    return NextResponse.json({ success: true, processed, message: `Successfully verified ${processed} servers.` });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
