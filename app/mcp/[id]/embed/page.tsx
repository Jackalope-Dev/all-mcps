import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Terminal } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SafeMarkdown } from '../../../../components/ui/SafeMarkdown';
import { ServerAvatar } from '../../../../components/ui/ServerAvatar';
import serversData from '../../../../data/mcp-servers.json';
import { servers as serversTable } from '../../../../db/schema';
import { parseServerName } from '../../../../lib/displayName';
import { redirectIfListingMoved } from '../../../../lib/listingRedirect';
import { PUBLIC_SERVER_COLUMNS } from '../../../../lib/servers';

type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  logoUrl?: string | null;
  isOfficial: boolean;
  isPremium?: boolean;
};

async function getServer(id: string): Promise<Server | undefined> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db
        .select(PUBLIC_SERVER_COLUMNS)
        .from(serversTable)
        .where(eq(serversTable.id, id))
        .limit(1);
      if (dbServers.length > 0) return dbServers[0] as unknown as Server;
    }
  } catch (e) {}

  const servers = serversData as Server[];
  return servers.find((s) => s.id === id);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const server = await getServer(id);
  redirectIfListingMoved(id, server, '/embed');
  return {
    title: server ? `${server.name} Widget` : 'MCP Widget',
    robots: { index: false, follow: false },
  };
}

// Generate static params so Next.js can pre-render these pages at build time
export async function generateStaticParams() {
  const servers = serversData as Server[];
  return servers.slice(0, 50).map((server) => ({
    id: server.id,
  }));
}

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServer(id);
  redirectIfListingMoved(id, server, '/embed');
  const { displayName, org } = server
    ? parseServerName(server.name)
    : { displayName: '', org: null };

  if (!server) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          background: '#0a0a0a',
          color: 'white',
          fontFamily: 'sans-serif',
          height: '100vh',
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
          header, footer { display: none !important; }
          body { background: transparent !important; margin: 0; overflow: hidden; padding: 0 !important; }
        `,
          }}
        />
        <h2>Not Found</h2>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        header, footer { display: none !important; }
        body { background: transparent !important; margin: 0; overflow: hidden; padding: 0 !important; }
        :root {
          --embed-bg: #0f172a;
          --embed-border: rgba(255, 255, 255, 0.12);
          --embed-text: #ffffff;
          --embed-subtext: #94a3b8;
          --embed-badge-bg: rgba(255, 255, 255, 0.06);
          --embed-badge-border: rgba(255, 255, 255, 0.12);
          --embed-badge-text: #cbd5e1;
          --embed-accent: #38bdf8;
          --embed-footer: #64748b;
        }

        @media (prefers-color-scheme: light) {
          :root {
            --embed-bg: #ffffff;
            --embed-border: rgba(15, 23, 42, 0.12);
            --embed-text: #0f172a;
            --embed-subtext: #475569;
            --embed-badge-bg: #f1f5f9;
            --embed-badge-border: #cbd5e1;
            --embed-badge-text: #334155;
            --embed-accent: #0284c7;
            --embed-footer: #64748b;
          }
        }

        .embed-card {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--embed-bg);
          border: 1px solid var(--embed-border);
          border-radius: 12px;
          padding: 1.25rem;
          text-decoration: none;
          color: var(--embed-text);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          transition: all 0.2s ease;
          box-sizing: border-box;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
        }
        .embed-card:hover {
          border-color: var(--embed-accent);
          transform: translateY(-1px);
        }
      `,
        }}
      />

      <Link
        href={`/mcp/${server.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="embed-card"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '0.75rem',
            flexShrink: 0,
          }}
        >
          <ServerAvatar
            name={server.name}
            logoUrl={server.logoUrl}
            category={server.category}
            size={40}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {(server.isOfficial || server.isPremium) && (
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '0.2rem 0.4rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#047857',
                  fontWeight: 700,
                }}
              >
                Verified
              </span>
            )}
            <span
              style={{
                fontSize: '0.65rem',
                padding: '0.2rem 0.4rem',
                borderRadius: '4px',
                backgroundColor: 'var(--embed-badge-bg)',
                border: '1px solid var(--embed-badge-border)',
                color: 'var(--embed-badge-text)',
                fontWeight: 600,
              }}
            >
              {server.category}
            </span>
          </div>
        </div>

        <h3
          style={{
            fontSize: '1.125rem',
            margin: org ? '0 0 0.15rem 0' : '0 0 0.5rem 0',
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            color: 'var(--embed-text)',
          }}
        >
          {displayName}
        </h3>
        {org && (
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--embed-subtext)',
              margin: '0 0 0.5rem 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {org}
          </div>
        )}

        <div
          style={{
            fontSize: '0.8rem',
            margin: '0 0 1rem 0',
            flexGrow: 1,
            flexShrink: 0,
            minHeight: '3.6rem',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: 'var(--embed-subtext)',
            lineHeight: 1.5,
          }}
        >
          <SafeMarkdown
            content={server.description || 'No description provided.'}
            isInline
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--embed-border)',
            paddingTop: '0.75rem',
            flexShrink: 0,
            minHeight: '1.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--embed-accent)',
              fontSize: '0.75rem',
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            <Terminal size={12} style={{ flexShrink: 0 }} /> Install via AllMCPs
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.65rem',
              color: 'var(--embed-footer)',
              fontWeight: 500,
              letterSpacing: '0.02em',
              lineHeight: 1,
            }}
          >
            allmcps.com
          </div>
        </div>
      </Link>
    </div>
  );
}
