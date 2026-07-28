import fs from 'fs';
import path from 'path';

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

// Generate a random gradient based on the string (for colorful icons)
function getGradient(str: string) {
  const colors = [
    'linear-gradient(135deg, #3b82f6, #1d4ed8)', // Blue
    'linear-gradient(135deg, #10b981, #047857)', // Green
    'linear-gradient(135deg, #f59e0b, #b45309)', // Orange
    'linear-gradient(135deg, #8b5cf6, #5b21b6)', // Purple
    'linear-gradient(135deg, #ec4899, #be185d)', // Pink
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Helper to remove markdown characters for a clean plain-text preview
function stripMarkdown(text: string) {
  if (!text) return '';
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with just the link text
    .replace(/[*_~`#]/g, '') // Remove markdown formatting characters like bold, italic, code
    .replace(/<[^>]*>?/gm, '') // Remove any stray HTML
    .trim();
}

export default async function Home() {
  const servers = await getServers();
  
  // Take top 40 for the homepage to keep it snappy
  const featuredServers = servers.slice(0, 40);

  return (
    <main className="container">
      {/* Hero Section */}
      <section style={{ textAlign: 'center', margin: '6rem 0 8rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="animate-fade-in delay-1">
        <h1>Give your AI agents <span style={{ background: 'linear-gradient(135deg, var(--accent-color), #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>superpowers</span>.</h1>
        <p style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '1rem auto 3rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          Find the best tools to connect your favorite LLMs directly to local files, databases, and external APIs.
        </p>

        {/* Search Bar */}
        <div style={{ width: '100%', maxWidth: '700px', position: 'relative' }} className="animate-fade-in delay-2">
          <input 
            type="text" 
            placeholder="Search for tools (e.g. GitHub, Postgres, File System)..." 
            style={{
              width: '100%',
              padding: '1.25rem 2rem',
              fontSize: '1.125rem',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(10, 10, 10, 0.8)',
              color: 'var(--text-primary)',
              outline: 'none',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              transition: 'all 0.3s ease'
            }}
          />
          <button style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'var(--accent-color)',
            border: 'none',
            color: '#fff',
            padding: '0.75rem 1.5rem',
            borderRadius: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 15px var(--accent-glow)'
          }}>Search</button>
        </div>
      </section>

      {/* Directory Grid */}
      <section className="animate-fade-in delay-3" style={{ marginBottom: '6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
          <h2>Directory <span style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', fontWeight: 500 }}>({servers.length} tools)</span></h2>
          <a href="#" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>View all →</a>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {featuredServers.map((server) => (
            <a key={server.id} href={`/mcp/${server.id}`} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: getGradient(server.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>
                  {server.name.charAt(0)}
                </div>
                {server.isOfficial && (
                  <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#10b981' }}>Official</span>
                )}
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.name}</h3>
              <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', flexGrow: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--text-secondary)' }}>
                {stripMarkdown(server.description) || 'No description provided.'}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.5)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>{server.category}</span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
