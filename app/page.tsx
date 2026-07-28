import fs from 'fs';
import path from 'path';
import DirectoryGrid from '../components/DirectoryGrid';

// Define the type for our server data
type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
};

// Fetch data from local JSON
async function getServers(): Promise<Server[]> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'mcp-servers.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (e) {
    console.error("Failed to load servers", e);
    return [];
  }
}

export default async function Home() {
  const servers = await getServers();
  
  // Take top 300 for the homepage to allow for meaningful searching
  const featuredServers = servers.slice(0, 300);

  return (
    <main className="container">
      {/* Hero Section */}
      <section style={{ textAlign: 'center', margin: '6rem 0 4rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="animate-fade-in delay-1">
        <h1>Give your AI agents <span style={{ background: 'linear-gradient(135deg, var(--accent-color), #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>superpowers</span>.</h1>
        <p style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '1rem auto 0', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          Find the best tools to connect your favorite LLMs directly to local files, databases, and external APIs.
        </p>
      </section>

      <DirectoryGrid initialServers={featuredServers} />
    </main>
  );
}
