'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, X, FileText, Tag, Sparkles } from 'lucide-react';
import { SafeMarkdown } from './SafeMarkdown';
import { Badge } from './Badge';
import { ServerAvatar } from './ServerAvatar';
import { parseServerName } from '../../lib/displayName';
import { compileQuery, scoreServerMatch } from '../../lib/search';
import { trackFeatureUse } from '../../lib/gtag';

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
  /** Extra searchable text (e.g. AI summary) not shown in the UI but matched by the filter. */
  searchText?: string;
}

type IndexedServer = { id: string; name: string; description: string; category: string; logoUrl?: string | null; aiSummary?: string | null };
type IndexedCategory = { name: string; label: string; slug: string; count: number };

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveServers, setLiveServers] = useState<IndexedServer[] | null>(null);
  const [liveCategories, setLiveCategories] = useState<IndexedCategory[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchedRef = useRef(false);
  const router = useRouter();

  // Fetch the full live directory (DB-backed) the first time the palette is
  // opened, rather than on every page load. The catalog JSON is deliberately NOT
  // imported into this client component — it would ship ~1.5 MB into the bundle;
  // the palette shows page/category shortcuts instantly and fills in server
  // results the moment this fetch resolves.
  useEffect(() => {
    if (!isOpen || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch('/api/search-index')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const payload = data as { servers?: IndexedServer[]; categories?: IndexedCategory[] } | null;
        if (payload?.servers) setLiveServers(payload.servers);
        if (payload?.categories) setLiveCategories(payload.categories);
      })
      .catch(() => {
        // Silently degrade to page/category shortcuts if the index can't load.
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
      { id: 'client-claude', title: 'Claude Desktop MCP Setup', subtitle: 'How to install MCP servers into Claude Desktop', category: 'Guide', categoryType: 'page', url: '/mcp-for-claude-desktop', icon: <FileText size={18} className="text-cyan-400" /> },
      { id: 'client-cursor', title: 'Cursor MCP Setup', subtitle: 'How to install MCP servers into Cursor IDE', category: 'Guide', categoryType: 'page', url: '/mcp-for-cursor', icon: <FileText size={18} className="text-cyan-400" /> },
      { id: 'client-windsurf', title: 'Windsurf MCP Setup', subtitle: 'How to install MCP servers into Windsurf IDE', category: 'Guide', categoryType: 'page', url: '/mcp-for-windsurf', icon: <FileText size={18} className="text-cyan-400" /> },
      { id: 'client-cline', title: 'Cline MCP Setup', subtitle: 'How to install MCP servers into Cline extension', category: 'Guide', categoryType: 'page', url: '/mcp-for-cline', icon: <FileText size={18} className="text-cyan-400" /> },
      { id: 'nav-browse', title: 'Browse All Servers', subtitle: 'Explore and filter MCP servers', category: 'Page', categoryType: 'page', url: '/browse', icon: <Search size={18} className="text-cyan-400" /> },
      { id: 'nav-best', title: 'Best MCP Servers', subtitle: 'Curated lists by use case', category: 'Page', categoryType: 'page', url: '/best', icon: <Sparkles size={18} className="text-cyan-400" /> },
      { id: 'nav-categories', title: 'Browse Categories', subtitle: 'Explore 50+ categories of MCP tools', category: 'Page', categoryType: 'page', url: '/categories', icon: <Tag size={18} className="text-cyan-400" /> },
      { id: 'tool-auditor', title: 'Config Auditor & Merger', subtitle: 'Audit client JSONs for missing keys & merge servers', category: 'Tool', categoryType: 'page', url: '/tools/config-auditor', icon: <Sparkles size={18} className="text-cyan-400" /> },
      { id: 'tool-playground', title: 'Interactive MCP Playground', subtitle: 'Test remote JSON-RPC 2.0 endpoints online', category: 'Tool', categoryType: 'page', url: '/tools/playground', icon: <Sparkles size={18} className="text-cyan-400" /> },
      { id: 'nav-prompts', title: 'Agent Prompt & Workflow Library', subtitle: 'Multi-MCP system prompts & combined suites', category: 'Page', categoryType: 'page', url: '/prompts', icon: <FileText size={18} className="text-cyan-400" /> },
      { id: 'tool-openapi', title: 'OpenAPI to MCP Generator', subtitle: 'Convert OpenAPI/Swagger specs to MCP server code', category: 'Tool', categoryType: 'page', url: '/tools/openapi-to-mcp', icon: <Sparkles size={18} className="text-cyan-400" /> },
      { id: 'tool-inspector', title: 'Protocol Inspector & Debugger', subtitle: 'Inspect raw JSON-RPC 2.0 payloads & schemas', category: 'Tool', categoryType: 'page', url: '/tools/protocol-inspector', icon: <Sparkles size={18} className="text-cyan-400" /> },
      { id: 'tool-validator', title: 'Config Validator', subtitle: 'Validate claude_desktop_config.json syntax', category: 'Tool', categoryType: 'page', url: '/tools/config-validator', icon: <Sparkles size={18} className="text-cyan-400" /> },
      { id: 'tool-calculator', title: 'Token Cost Calculator', subtitle: 'Calculate MCP schema token context window overhead', category: 'Tool', categoryType: 'page', url: '/tools/token-calculator', icon: <Sparkles size={18} className="text-cyan-400" /> },
      { id: 'nav-build', title: 'Build an MCP Server', subtitle: 'Developer reference and specs', category: 'Page', categoryType: 'page', url: '/build-mcp-server', icon: <FileText size={18} className="text-cyan-400" /> },
      { id: 'nav-security', title: 'MCP Security Best Practices', subtitle: 'Use MCP servers safely', category: 'Page', categoryType: 'page', url: '/mcp-security', icon: <FileText size={18} className="text-cyan-400" /> },
      { id: 'nav-docs-api', title: 'Directory API Docs', subtitle: 'Search API, OpenAPI, agent discovery', category: 'Page', categoryType: 'page', url: '/docs/api', icon: <FileText size={18} className="text-cyan-400" /> },
      { id: 'nav-blog', title: 'Blog', subtitle: 'Guides and product updates', category: 'Page', categoryType: 'page', url: '/blog', icon: <FileText size={18} className="text-cyan-400" /> },
      { id: 'nav-submit', title: 'Submit an MCP Server', subtitle: 'List your server free', category: 'Page', categoryType: 'page', url: '/submit', icon: <Sparkles size={18} className="text-cyan-400" /> },
      { id: 'nav-badge', title: 'Badge Embed Builder', subtitle: 'Dynamic SVG README badges', category: 'Page', categoryType: 'page', url: '/badge-generator', icon: <Sparkles size={18} className="text-cyan-400" /> },
      { id: 'nav-pricing', title: 'Pricing & Featured Listings', subtitle: 'Promote your server', category: 'Page', categoryType: 'page', url: '/pricing', icon: <Sparkles size={18} className="text-cyan-400" /> },
    ];

    // Category shortcuts (from the fetched index) navigate to landing pages.
    const categoryItems: CommandItem[] = liveCategories.map((c) => ({
      id: `category-${c.slug}`,
      title: `${c.label} servers`,
      subtitle: `${c.count.toLocaleString()} ${c.count === 1 ? 'server' : 'servers'} in this category`,
      category: 'Category',
      categoryType: 'category',
      url: `/categories/${c.slug}`,
      icon: <Tag size={18} className="text-cyan-400" />,
    }));

    // Server results come from the live DB-backed index once the fetch resolves;
    // before that, only page/category shortcuts are shown (no bundled snapshot).
    const serverItems: CommandItem[] = (liveServers ?? []).map((s) => {
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
        searchText: s.aiSummary ?? undefined,
      };
    });

    return [...staticPages, ...categoryItems, ...serverItems];
  }, [liveServers, liveCategories]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 10);
    const terms = compileQuery(query);
    if (terms.length === 0) return items.slice(0, 10);
    const fullQuery = terms.map((t) => t.term).join(' ');

    const scored: Array<{ item: CommandItem; score: number }> = [];
    for (const item of items) {
      const score = scoreServerMatch(
        {
          name: item.title,
          description: item.subtitle,
          category: item.category,
          extraText: item.searchText,
        },
        terms,
        fullQuery,
        false
      );
      if (score > 0) {
        scored.push({ item, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.item).slice(0, 12);
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (item: CommandItem) => {
    trackFeatureUse('command_palette', { category: item.categoryType, title: item.title, url: item.url });
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
      className="command-palette-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
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
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-muted)' }}>
          <Search size={20} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search MCP servers, docs, or pages... (e.g. SQLite, GitHub, Cursor)"
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              fontSize: '0.95rem',
              color: 'var(--text-primary)',
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
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-muted)',
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
            <div style={{ padding: '3rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
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
                  backgroundColor: selectedIndex === idx ? 'var(--brand-gradient-soft)' : 'transparent',
                  border: `1px solid ${selectedIndex === idx ? 'var(--accent-color)' : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                  {item.categoryType === 'server' && item.rawName ? (
                    <ServerAvatar name={item.rawName} logoUrl={item.logoUrl} size={40} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.2rem' }}>
                      <SafeMarkdown content={item.subtitle} isInline />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                  <Badge variant={item.categoryType === 'server' ? 'category' : 'default'}>
                    {item.category}
                  </Badge>
                  <ArrowRight size={16} style={{ color: 'var(--accent-color)', opacity: selectedIndex === idx ? 1 : 0, transition: 'opacity 0.2s ease' }} />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div style={{ padding: '0.85rem 1.25rem', backgroundColor: 'var(--bg-muted)', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ padding: '0.2rem 0.45rem', borderRadius: '6px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontFamily: 'monospace' }}>↑↓</span> navigate
            <span style={{ marginLeft: '0.75rem', padding: '0.2rem 0.45rem', borderRadius: '6px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontFamily: 'monospace' }}>↵</span> select
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ padding: '0.2rem 0.45rem', borderRadius: '6px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontFamily: 'monospace' }}>ESC</span> close
          </div>
        </div>
      </div>
    </div>
  );
}

