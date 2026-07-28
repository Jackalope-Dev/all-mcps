import { ArrowLeft, CheckCircle2, FolderGit2, Terminal, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import ShareModal from '../../../components/ShareModal';
import { Badge } from '../../../components/ui/Badge';
import { CopyBlock } from '../../../components/ui/CopyBlock';
import { ViewTracker } from '../../../components/ui/ViewTracker';
import { UpvoteButton } from '../../../components/ui/UpvoteButton';
import serversData from '../../../data/mcp-servers.json';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';

// Define the type for our server data
type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
  status: string;
  lastCheckedAt?: string | null;
  isVerifiedActive?: boolean;
  healthStatus?: string;
  views?: number;
  copies?: number;
  upvotes?: number;
  createdAt: string;
};

async function getServer(id: string): Promise<Server | undefined> {
  // Try D1 first
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.id, id)).limit(1);
      if (dbServers.length > 0) return dbServers[0] as unknown as Server;
    }
  } catch (e) {}

  // Fallback to the bundled JSON snapshot
  const servers = serversData as Server[];
  return servers.find((s) => s.id === id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = await getServer(id);
  
  if (!server) {
    return { title: 'Not Found' };
  }
  
  return {
    title: `${server.name} MCP Server - Install & Setup`,
    description: server.description,
    keywords: [server.name, 'MCP server', 'Model Context Protocol', 'AI agent tool', server.category].join(', '),
    alternates: {
      canonical: `https://allmcps.com/mcp/${server.id}`,
    },
    openGraph: {
      title: `${server.name} MCP Server - Install & Setup | AllMCPs`,
      description: server.description,
      url: `https://allmcps.com/mcp/${server.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${server.name} MCP Server - Install & Setup | AllMCPs`,
      description: server.description,
    }
  };
}

async function fetchReadme(url: string) {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    
    const owner = match[1];
    let repo = match[2];
    
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }
    
    // Attempt to fetch from 'main' branch first
    let res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`, { next: { revalidate: 3600 } });
    if (!res.ok) {
      // Fallback to 'master' branch
      res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`, { next: { revalidate: 3600 } });
    }
    
    if (res.ok) {
      return await res.text();
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Generate static params so Next.js can pre-render these pages at build time
export async function generateStaticParams() {
  const servers = serversData as Server[];
  return servers.slice(0, 50).map((server) => ({
    id: server.id,
  }));
}

export default async function MCPDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    return (
      <div className="container" style={{ paddingTop: '6rem', textAlign: 'center' }}>
        <h1>Server Not Found</h1>
        <Link href="/" style={{ color: 'var(--accent-color)', marginTop: '1rem', display: 'inline-block' }}>← Back to Directory</Link>
      </div>
    );
  }

  const readme = await fetchReadme(server.url);
  const installName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: server.name,
        description: server.description,
        url: `https://allmcps.com/mcp/${server.id}`,
        sameAs: server.url,
        codeRepository: server.url,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        softwareRequirements: 'Node.js, npx, Claude Desktop or MCP compatible client',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `How do I install the ${server.name} MCP server?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Add the following block to your claude_desktop_config.json under mcpServers: "mcpServers": { "${installName}": { "command": "npx", "args": ["-y", "${installName}"] } }`,
            },
          },
          {
            '@type': 'Question',
            name: `What does ${server.name} do?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: server.description,
            },
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://allmcps.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: server.category,
            item: `https://allmcps.com/?category=${encodeURIComponent(server.category)}`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: server.name,
            item: `https://allmcps.com/mcp/${server.id}`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <ViewTracker serverId={server.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="container" style={{ paddingBottom: '6rem' }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: '2rem' }}>
        <ol className="breadcrumb">
          <li><Link href="/">Home</Link></li>
          <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
          <li><Link href={`/?category=${encodeURIComponent(server.category)}`}>{server.category}</Link></li>
          <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
          <li className="breadcrumb-current">{server.name}</li>
        </ol>
      </nav>

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '3rem', alignItems: 'start' }}>
        
        {/* Main Content (Left Column) */}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: '0 0 1rem 0' }}>{server.name}</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <Badge variant="category">{server.category}</Badge>
            {server.isOfficial && (
              <Badge variant="official">✓ Official</Badge>
            )}
            {server.isVerifiedActive && (
              <Badge variant="success" title={server.lastCheckedAt ? `Last checked: ${new Date(server.lastCheckedAt).toLocaleString()}` : 'Recently checked'}>
                🟢 Verified Active
              </Badge>
            )}
            <UpvoteButton serverId={server.id} initialCount={server.upvotes || 0} />
          </div>
          
          <div style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
            <SafeMarkdown content={server.description} />
          </div>

          <div className="glass-panel-static" style={{ padding: '2rem', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={20} /> Quick Install (Claude Desktop)
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>Add this directly to your <code>claude_desktop_config.json</code> file:</p>
            <CopyBlock code={`"mcpServers": {\n  "${installName}": {\n    "command": "npx",\n    "args": ["-y", "${installName}"]\n  }\n}`} serverId={server.id} />
          </div>

          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Documentation Overview</h2>
            <div className="detail-readme-scroll">
              <div className="markdown-body">
                {readme ? (
                  <SafeMarkdown content={readme} />
                ) : (
                  <p>No README found or this server is not hosted on GitHub.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar (Right Column) */}
        <div className="detail-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-panel-static" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
              Verified Active
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              {server.lastCheckedAt ? `Last checked: ${new Date(server.lastCheckedAt).toLocaleString()}` : 'Not yet checked.'}
            </p>
          </div>

          <div className="glass-panel-static" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Links</h3>
            <a href={server.url} target="_blank" rel={server.isOfficial ? "noopener noreferrer" : "noopener noreferrer nofollow"} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontWeight: 500, transition: 'background 0.2s', border: '1px solid var(--border-color)' }} className="nav-link">
              <FolderGit2 size={18} /> View Repository
            </a>
          </div>

          <div className="glass-panel-static" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Share & Embed</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Add our SVG badge or dynamic widget to your website to get a free Featured boost in the directory.</p>
            <ShareModal serverId={server.id} serverName={server.name} />
          </div>
          
        </div>
      </div>
    </main>
    </>
  );
}
