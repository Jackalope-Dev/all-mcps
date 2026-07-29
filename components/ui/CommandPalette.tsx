'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, X, FileText, Tag, Sparkles } from 'lucide-react';
import serversData from '../../data/mcp-servers.json';
import { SafeMarkdown } from './SafeMarkdown';
import { Badge } from './Badge';
import { ServerAvatar } from './ServerAvatar';
import { parseServerName } from '../../lib/displayName';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  categoryType: 'server' | 'page' | 'category';
  url: string;
  icon?: React.ReactNode;
  /** Raw server name + logo, only set for categoryType 'server' — used to render ServerAvatar. */
  rawName?: string;
  logoUrl?: string | null;
}

type IndexedServer = { id: string; name: string; description: string; category: string; logoUrl?: string | null };

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveServers, setLiveServers] = useState<IndexedServer[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchedRef = useRef(false);
  const router = useRouter();

  // Fetch the full live directory (DB-backed, includes user-submitted listings
  // that never made it into the bundled data/mcp-servers.json snapshot) the
  // first time the palette is opened, rather than on every page load.
  useEffect(() => {
    if (!isOpen || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch('/api/search-index')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { servers?: IndexedServer[] } | null) => {
        if (data?.servers) setLiveServers(data.servers);
      })
      .catch(() => {
        // Silently keep using the bundled static snapshot as a fallback.
      });
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Lock scroll and focus input when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const items: CommandItem[] = useMemo(() => {
    const staticPages: CommandItem[] = [
      { id: 'nav-browse', title: 'Browse All Servers', subtitle: 'Explore and filter MCP servers', category: 'Page', categoryType: 'page', url: '/browse', icon: <Search size={18} className="text-cyan-400" /> },
      { id: 'nav-categories', title: 'Browse Categories', subtitle: 'Explore 50+ categories of MCP tools', category: 'Page', categoryType: 'page', url: '/categories', icon: <Tag size={18} className="text-cyan-400" /> },
      { id: 'nav-build', title: 'Build an MCP Server', subtitle: 'Developer reference and specs', category: 'Page', categoryType: 'page', url: '/build-mcp-server', icon: <FileText size={18} className="text-cyan-400" /> },
      { id: 'nav-badge', title: 'Badge Embed Builder', subtitle: 'Dynamic SVG README badges', category: 'Page', categoryType: 'page', url: '/badge-generator', icon: <Sparkles size={18} className="text-cyan-400" /> },
      { id: 'nav-pricing', title: 'Pricing & Featured Listings', subtitle: 'Promote your server', category: 'Page', categoryType: 'page', url: '/pricing', icon: <Sparkles size={18} className="text-cyan-400" /> },
    ];

    // Prefer the live DB-backed directory once loaded (includes user-submitted
    // listings the bundled JSON snapshot doesn't have); fall back to the
    // static snapshot for instant results before that fetch resolves.
    const source: IndexedServer[] = liveServers ?? (serversData as any[]).slice(0, 200);
    const serverItems: CommandItem[] = source.map((s) => {
      const { displayName } = parseServerName(s.name);
      return {
        id: `server-${s.id}`,
        title: displayName,
        subtitle: s.description,
        category: s.category || 'Server',
        categoryType: 'server',
        url: `/mcp/${s.id}`,
        rawName: s.name,
        logoUrl: s.logoUrl ?? null,
      };
    });

    return [...staticPages, ...serverItems];
  }, [liveServers]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 10);
    const q = query.toLowerCase();
    return items
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          (item.rawName && item.rawName.toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (item: CommandItem) => {
    setIsOpen(false);
    router.push(item.url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '5rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        paddingBottom: '2rem',
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '42rem',
          borderRadius: '20px',
          backgroundColor: '#090d16',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 229, 255, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
          <Search size={20} style={{ color: '#00E5FF', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 150+ MCP servers, docs, or pages... (e.g. SQLite, GitHub, Cursor)"
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              fontSize: '0.95rem',
              color: '#ffffff',
              border: 'none',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              color: '#94a3b8',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            title="Close (ESC)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>
              No matching servers or pages found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  backgroundColor: selectedIndex === idx ? 'rgba(0, 229, 255, 0.12)' : 'transparent',
                  border: `1px solid ${selectedIndex === idx ? 'rgba(0, 229, 255, 0.3)' : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                  {item.categoryType === 'server' && item.rawName ? (
                    <ServerAvatar name={item.rawName} logoUrl={item.logoUrl} size={40} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: '0.775rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.2rem' }}>
                      <SafeMarkdown content={item.subtitle} isInline />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                  <Badge variant={item.categoryType === 'server' ? 'category' : 'default'}>
                    {item.category}
                  </Badge>
                  <ArrowRight size={16} style={{ color: '#00E5FF', opacity: selectedIndex === idx ? 1 : 0, transition: 'opacity 0.2s ease' }} />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div style={{ padding: '0.85rem 1.25rem', backgroundColor: 'rgba(15, 23, 42, 0.9)', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.775rem', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ padding: '0.2rem 0.45rem', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', fontFamily: 'monospace' }}>↑↓</span> navigate
            <span style={{ marginLeft: '0.75rem', padding: '0.2rem 0.45rem', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', fontFamily: 'monospace' }}>↵</span> select
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ padding: '0.2rem 0.45rem', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', fontFamily: 'monospace' }}>ESC</span> close
          </div>
        </div>
      </div>
    </div>
  );
}

