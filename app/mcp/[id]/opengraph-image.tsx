import { ImageResponse } from 'next/og';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import serversData from '../../../data/mcp-servers.json';

export const alt = 'AllMCPs - Tool Directory';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function getServer(id: string) {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.id, id)).limit(1);
      if (dbServers.length > 0) return dbServers[0];
    }
  } catch (e) {}

  const servers = serversData as { id: string; name: string; description: string }[];
  return servers.find((s) => s.id === id);
}

export default async function Image({ params }: { params: { id: string } }) {
  const server = await getServer(params.id);
  const title = server ? server.name : 'Unknown Server';
  const desc = server ? server.description : 'Model Context Protocol';

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #00E5FF, #007BFF)', borderRadius: '8px', marginRight: '16px', display: 'flex' }} />
          <h2 style={{ fontSize: '32px', fontWeight: 600, color: '#a3a3a3', margin: 0, letterSpacing: '-0.01em' }}>
            AllMCPs.com
          </h2>
        </div>
        
        <h1 style={{ fontSize: '84px', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.03em' }}>
          {title}
        </h1>
        
        <p style={{ fontSize: '36px', color: '#d4d4d4', lineHeight: 1.4, maxWidth: '900px' }}>
          {desc}
        </p>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '8px', background: 'linear-gradient(90deg, #00E5FF, #007BFF)', display: 'flex' }} />
      </div>
    ),
    { ...size }
  );
}
