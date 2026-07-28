'use client';

import React, { useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { FeaturedMarquee } from './FeaturedMarquee';
import { FeaturedCards } from './FeaturedCards';
import { Eye, Heart, Download } from 'lucide-react';
import { SafeMarkdown } from './ui/SafeMarkdown';

type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
  views?: number;
  copies?: number;
  upvotes?: number;
  createdAt?: string;
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

export default function DirectoryGrid({ 
  initialServers,
  marqueeServers = [],
  featuredCards = []
}: { 
  initialServers: Server[];
  marqueeServers?: Server[];
  featuredCards?: Server[];
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'trending' | 'most_viewed' | 'newest'>('trending');
  const [visibleCount, setVisibleCount] = useState(30);

  // Extract unique categories for the filter pill list
  const categories = useMemo(() => {
    const cats = new Set(initialServers.map(s => s.category));
    return Array.from(cats).sort();
  }, [initialServers]);

  const filteredServers = useMemo(() => {
    let result = initialServers.filter(server => {
      const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            server.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory ? server.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });
    
    result.sort((a, b) => {
      if (sortMode === 'trending') {
        const scoreA = ((a.upvotes || 0) * 5) + (a.copies || 0);
        const scoreB = ((b.upvotes || 0) * 5) + (b.copies || 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
      } else if (sortMode === 'most_viewed') {
        if ((b.views || 0) !== (a.views || 0)) return (b.views || 0) - (a.views || 0);
      }
      
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    
    return result;
  }, [initialServers, searchQuery, selectedCategory, sortMode]);

  // Read initial query parameters from URL on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const catParam = params.get('category');
      const qParam = params.get('q');
      if (catParam) setSelectedCategory(catParam);
      if (qParam) setSearchQuery(qParam);
    }
  }, []);

  // Update URL search parameters when category or search changes
  const handleCategorySelect = (cat: string | null) => {
    setSelectedCategory(cat);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (cat) {
        url.searchParams.set('category', cat);
      } else {
        url.searchParams.delete('category');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (q.trim()) {
        url.searchParams.set('q', q);
      } else {
        url.searchParams.delete('q');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Reset pagination when searching, filtering, or sorting
  React.useEffect(() => {
    setVisibleCount(30);
  }, [searchQuery, selectedCategory, sortMode]);

  const visibleServers = filteredServers.slice(0, visibleCount);
  const hasMore = visibleCount < filteredServers.length;
  
  const isSearching = searchQuery.length > 0 || selectedCategory !== null;

  return (
    <>
      {/* Marquee (above search, hidden when searching) */}
      {!isSearching && (
        <FeaturedMarquee servers={marqueeServers} />
      )}

      {/* Search Bar & Category Select */}
      <section className="container animate-fade-in delay-2" style={{ margin: '0 auto 4rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '900px', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <Input 
            type="text" 
            placeholder="Search for tools (e.g. GitHub, Postgres, File System)..." 
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Search MCP Servers"
            inputClassName="search-input"
            style={{ flexGrow: 1, flexBasis: '400px', margin: 0 }}
          />
          
          <select 
            className="form-input" 
            style={{ 
              flexGrow: 0, 
              flexBasis: '200px',
              padding: '1.25rem 2.5rem 1.25rem 1.5rem', 
              fontSize: '1rem', 
              borderRadius: '16px', 
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', 
              cursor: 'pointer', 
              appearance: 'none', 
              background: 'rgba(10,10,10,0.8) url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23a1a1aa\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E") no-repeat right 1rem center',
              color: 'var(--text-primary)',
              height: 'auto'
            }}
            value={selectedCategory || ''}
            onChange={(e) => handleCategorySelect(e.target.value === '' ? null : e.target.value)}
            aria-label="Filter by Category"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Featured Cards (below search, hidden when searching) */}
      {!isSearching && (
        <FeaturedCards servers={featuredCards} />
      )}

      {/* Directory Grid */}
      <section className="container animate-fade-in delay-3" style={{ marginBottom: '6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2>Directory <span style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', fontWeight: 500 }}>({filteredServers.length} tools)</span></h2>
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem', borderRadius: '8px' }}>
            <button onClick={() => setSortMode('trending')} className={`btn ${sortMode === 'trending' ? 'btn-primary' : ''}`} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>Trending</button>
            <button onClick={() => setSortMode('most_viewed')} className={`btn ${sortMode === 'most_viewed' ? 'btn-primary' : ''}`} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>Most Viewed</button>
            <button onClick={() => setSortMode('newest')} className={`btn ${sortMode === 'newest' ? 'btn-primary' : ''}`} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>Newest</button>
          </div>
        </div>
        
        {filteredServers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
            No tools found matching your criteria.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {visibleServers.map((server) => (
              <Card key={server.id} href={`/mcp/${server.id}`} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: getGradient(server.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>
                    {server.name.charAt(0)}
                  </div>
                  {server.isOfficial && (
                    <Badge variant="official">Official</Badge>
                  )}
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.name}</h3>
                <div style={{ fontSize: '0.875rem', marginBottom: '1.5rem', flexGrow: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--text-secondary)' }}>
                  <SafeMarkdown content={server.description || 'No description provided.'} isInline />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Badge variant="category">{server.category}</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Views"><Eye size={12} /> {server.views || 0}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Installs"><Download size={12} /> {server.copies || 0}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Upvotes"><Heart size={12} /> {server.upvotes || 0}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {filteredServers.length > 0 && hasMore && (
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Button variant="secondary" onClick={() => setVisibleCount(v => v + 30)}>
              Load More
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
