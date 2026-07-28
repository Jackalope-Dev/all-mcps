import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import serversData from '../../../../data/mcp-servers.json';
import Link from 'next/link';
import { Terminal } from 'lucide-react';
import { SafeMarkdown } from '../../../../components/ui/SafeMarkdown';

type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
};

async function getServer(id: string): Promise<Server | undefined> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.id, id)).limit(1);
      if (dbServers.length > 0) return dbServers[0] as unknown as Server;
    }
  } catch (e) {}

  const servers = serversData as Server[];
  return servers.find((s) => s.id === id);
}

// Generate static params so Next.js can pre-render these pages at build time
export async function generateStaticParams() {
  const servers = serversData as Server[];
  return servers.slice(0, 50).map((server) => ({
    id: server.id,
  }));
}

function getGradient(str: string) {
  const colors = [
    'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    'linear-gradient(135deg, #10b981, #047857)',
    'linear-gradient(135deg, #f59e0b, #b45309)',
    'linear-gradient(135deg, #8b5cf6, #5b21b6)',
    'linear-gradient(135deg, #ec4899, #be185d)',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: '#0a0a0a', color: 'white', fontFamily: 'sans-serif', height: '100vh' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          header, footer { display: none !important; }
          body { background: transparent !important; margin: 0; overflow: hidden; padding: 0 !important; }
        `}} />
        <h2>Not Found</h2>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        header, footer { display: none !important; }
        body { background: transparent !important; margin: 0; overflow: hidden; padding: 0 !important; }
        .embed-card {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: rgba(15, 15, 15, 0.8);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 1.25rem;
          text-decoration: none;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .embed-card:hover {
          background: rgba(25, 25, 25, 0.9);
          border-color: rgba(255,255,255,0.2);
        }
      `}} />
      
      <Link href={`/mcp/${server.id}`} target="_blank" rel="noopener noreferrer" className="embed-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexShrink: 0 }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: getGradient(server.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            {server.name.charAt(0)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             {server.isOfficial && (
                <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 600 }}>Official</span>
             )}
            <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}>
              {server.category}
            </span>
          </div>
        </div>
        
        <h3 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem 0', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {server.name}
        </h3>
        
        <div style={{ fontSize: '0.8rem', margin: '0 0 1rem 0', flexGrow: 1, flexShrink: 0, minHeight: '3.6rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#a1a1aa', lineHeight: 1.5 }}>
          <SafeMarkdown content={server.description || 'No description provided.'} isInline />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa', fontSize: '0.75rem', fontWeight: 600 }}>
             <Terminal size={12} /> Install via AllMCPs
          </div>
          <div style={{ fontSize: '0.65rem', color: '#52525b', fontWeight: 500, letterSpacing: '0.02em' }}>
            ALLMCPS.COM
          </div>
        </div>
      </Link>
    </div>
  );
}
