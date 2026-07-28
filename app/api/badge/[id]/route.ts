import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import serversData from '../../../../data/mcp-servers.json';

export const runtime = 'edge';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  let isOfficial = false;
  
  try {
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.id, id)).limit(1);
      if (dbServers.length > 0) {
        isOfficial = dbServers[0].isOfficial || false;
      }
    } else {
      const server = serversData.find((s: any) => s.id === id);
      if (server) {
        isOfficial = server.isOfficial || false;
      }
    }
  } catch (e) {
    const server = serversData.find((s: any) => s.id === id);
    if (server) {
      isOfficial = server.isOfficial || false;
    }
  }

  const badgeColor = isOfficial ? '#10b981' : '#8b5cf6';
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="32" viewBox="0 0 220 32" fill="none">
    <rect width="220" height="32" rx="8" fill="#121212" />
    <rect width="220" height="32" rx="8" fill="url(#grad)" opacity="0.15" />
    <path d="M110 0h102a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8h-102V0z" fill="rgba(255,255,255,0.03)"/>
    <text x="55" y="21" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="12" font-weight="500" fill="#a1a1aa" text-anchor="middle">Featured on</text>
    <text x="165" y="22" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="14" font-weight="800" fill="#ffffff" text-anchor="middle">AllMCPs</text>
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="220" y2="32" gradientUnits="userSpaceOnUse">
        <stop stop-color="#3b82f6" />
        <stop offset="1" stop-color="${badgeColor}" />
      </linearGradient>
    </defs>
    <rect x="0.5" y="0.5" width="219" height="31" rx="7.5" stroke="rgba(255,255,255,0.15)" />
  </svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
