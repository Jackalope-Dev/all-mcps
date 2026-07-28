import DirectoryGrid from '../components/DirectoryGrid';
import { FeaturedMarquee } from '../components/FeaturedMarquee';
import { FeaturedCards } from '../components/FeaturedCards';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../db/schema';
import { desc, eq } from 'drizzle-orm';
import serversData from '../data/mcp-servers.json';

// Define the type for our server data
type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
};

// Fetch data from local JSON or D1
async function getServers(): Promise<Server[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.status, 'active')).orderBy(desc(serversTable.createdAt));
      return dbServers as unknown as Server[];
    }
  } catch (e) {
    // Fallback to local JSON if not running in wrangler / opennext
  }

  return serversData as Server[];
}

export default async function Home() {
  const servers = await getServers();
  
  // Since we don't have explicit paid featured servers yet, 
  // we'll randomly select 15 for the marquee and 3 for the cards.
  const shuffled = [...servers].sort(() => 0.5 - Math.random());
  
  const marqueeServers = shuffled.slice(0, 15);
  const featuredCards = shuffled.slice(15, 18);

  return (
    <main>
      {/* Hero Section */}
      <section className="container animate-fade-in delay-1" style={{ textAlign: 'center', margin: '6rem auto 4rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1>Give your AI agents <span style={{ background: 'linear-gradient(135deg, var(--accent-color), #007BFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>superpowers</span>.</h1>
        <p style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '1rem auto 0', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          Find the best tools to connect your favorite LLMs directly to local files, databases, and external APIs.
        </p>
      </section>

      {/* We pass all servers to DirectoryGrid so client search works perfectly. It now handles layout internally. */}
      <DirectoryGrid 
        initialServers={servers} 
        marqueeServers={marqueeServers}
        featuredCards={featuredCards}
      />
    </main>
  );
}
