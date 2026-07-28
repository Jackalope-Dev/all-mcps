'use client';

import React, { useState, useMemo } from 'react';

type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
};

// Generate a random gradient based on the string (for colorful icons)
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

export default function DirectoryGrid({ initialServers }: { initialServers: Server[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Extract unique categories for the filter pill list
  const categories = useMemo(() => {
    const cats = new Set(initialServers.map(s => s.category));
    return Array.from(cats).sort();
  }, [initialServers]);

  const filteredServers = useMemo(() => {
    return initialServers.filter(server => {
      const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            server.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory ? server.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [initialServers, searchQuery, selectedCategory]);

  return (
    <>
      {/* Search Bar */}
      <section style={{ textAlign: 'center', margin: '0 0 4rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '700px', position: 'relative' }} className="animate-fade-in delay-2">
          <input 
            type="text" 
            placeholder="Search for tools (e.g. GitHub, Postgres, File System)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2rem', maxWidth: '900px' }} className="animate-fade-in delay-2">
          <button 
            onClick={() => setSelectedCategory(null)}
            style={{ padding: '0.5rem 1rem', borderRadius: '2rem', border: '1px solid var(--border-color)', backgroundColor: selectedCategory === null ? 'var(--accent-color)' : 'transparent', color: selectedCategory === null ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.875rem' }}>
            All
          </button>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{ padding: '0.5rem 1rem', borderRadius: '2rem', border: '1px solid var(--border-color)', backgroundColor: selectedCategory === cat ? 'var(--accent-color)' : 'transparent', color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.875rem' }}>
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Directory Grid */}
      <section className="animate-fade-in delay-3" style={{ marginBottom: '6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
          <h2>Directory <span style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', fontWeight: 500 }}>({filteredServers.length} tools)</span></h2>
        </div>
        
        {filteredServers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
            No tools found matching your criteria.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {filteredServers.map((server) => (
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
                  {server.description || 'No description provided.'}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.5)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>{server.category}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
