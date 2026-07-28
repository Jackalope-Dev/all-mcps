'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Command, ArrowRight, X, ExternalLink, Cpu, FileText, Tag, Sparkles } from 'lucide-react';
import serversData from '../../data/mcp-servers.json';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'server' | 'page' | 'category';
  url: string;
  icon?: React.ReactNode;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const items: CommandItem[] = useMemo(() => {
    const staticPages: CommandItem[] = [
      { id: 'nav-browse', title: 'Browse All Servers', subtitle: 'Directory list & filters', category: 'page', url: '/browse', icon: <Search className="w-4 h-4 text-cyan-400" /> },
      { id: 'nav-categories', title: 'Browse Categories', subtitle: '50+ server categories', category: 'page', url: '/categories', icon: <Tag className="w-4 h-4 text-cyan-400" /> },
      { id: 'nav-build', title: 'Build an MCP Server', subtitle: 'Developer reference guide', category: 'page', url: '/build-mcp-server', icon: <FileText className="w-4 h-4 text-cyan-400" /> },
      { id: 'nav-badge', title: 'Badge Embed Builder', subtitle: 'Dynamic SVG README badges', category: 'page', url: '/badge-generator', icon: <Sparkles className="w-4 h-4 text-cyan-400" /> },
      { id: 'nav-pricing', title: 'Pricing & Featured Listings', subtitle: 'Promote your server', category: 'page', url: '/pricing', icon: <Sparkles className="w-4 h-4 text-cyan-400" /> },
    ];

    const serverItems: CommandItem[] = (serversData as any[]).slice(0, 150).map((s) => ({
      id: `server-${s.id}`,
      title: s.name,
      subtitle: s.description,
      category: 'server',
      url: `/mcp/${s.id}`,
      icon: <Cpu className="w-4 h-4 text-blue-400" />,
    }));

    return [...staticPages, ...serverItems];
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 10);
    const q = query.toLowerCase();
    return items
      .filter((item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q))
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
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-fade-in"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-zinc-950 border border-white/15 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-black/40">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search servers, docs, or pages... (e.g. SQLite, GitHub, Cursor)"
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No matching servers or pages found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-all ${
                  selectedIndex === idx
                    ? 'bg-cyan-500/15 border border-cyan-500/30 text-white'
                    : 'text-zinc-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{item.title}</div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">{item.subtitle}</div>
                  </div>
                </div>
                <ArrowRight className={`w-4 h-4 shrink-0 transition-opacity ${selectedIndex === idx ? 'opacity-100 text-cyan-400' : 'opacity-0'}`} />
              </button>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-black/60 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 font-mono">↑↓</span> to navigate
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 font-mono">↵</span> to select
          </div>
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 font-mono">ESC</span> to close
          </div>
        </div>
      </div>
    </div>
  );
}
