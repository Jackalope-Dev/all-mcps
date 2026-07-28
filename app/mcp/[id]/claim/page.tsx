import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import ClaimClient from './ClaimClient';
import fs from 'fs';
import path from 'path';

export const runtime = 'edge';

async function getServer(id: string) {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
      if (dbServers.length > 0) return dbServers[0];
    }
  } catch (e) {}

  const filePath = path.join(process.cwd(), 'data', 'mcp-servers.json');
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const allServers = JSON.parse(fileContents);
  return allServers.find((s: any) => s.id === id);
}

export default async function ClaimPage({ params }: { params: { id: string } }) {
  const server = await getServer(params.id);
  
  if (!server) {
    notFound();
  }

  return (
    <main className="container animate-fade-in" style={{ padding: '4rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', textAlign: 'center' }}>Verify Ownership</h1>
      <ClaimClient serverId={server.id} serverName={server.name} repoUrl={server.url} />
    </main>
  );
}
