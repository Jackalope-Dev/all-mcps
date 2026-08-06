'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { getCategoryMeta, CATEGORY_GROUPS } from '../lib/categories';

type CategoryItem = {
  name: string;
  emoji: string;
  label: string;
  count: number;
  slug: string;
};

export function CategoryGrid({ categories }: { categories: CategoryItem[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [hasScrolled, setHasScrolled] = useState(false);

  const filtered = useMemo(() => {
    return categories.filter((c) => {
      if (activeGroup !== 'all') {
        const meta = getCategoryMeta(c.name);
        if (meta.group.id !== activeGroup) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!c.label.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [categories, searchQuery, activeGroup]);

  // Handle hash-based scrolling from breadcrumb links (e.g. /categories#💻 Developer Tools)
  useEffect(() => {
    if (hasScrolled) return;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) {
      // Small delay to allow the DOM to render
      const timer = setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Brief highlight effect
          el.style.boxShadow = '0 0 0 2px var(--accent-color), 0 12px 40px rgba(0, 0, 0, 0.5)';
          setTimeout(() => { el.style.boxShadow = ''; }, 2000);
        }
        setHasScrolled(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [hasScrolled]);

  return (
    <>
      {/* Search & Group Tabs */}
      <div className="animate-fade-in delay-2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-input search-input"
          style={{ maxWidth: '500px', width: '100%' }}
          aria-label="Search categories"
          id="search-categories"
        />

        <div className="directory-tags-row" style={{ overflowX: 'auto', paddingBottom: '0.25rem', maxWidth: '100%', justifyContent: 'center' }}>
          <button
            type="button"
            className={`directory-tag ${activeGroup === 'all' ? 'directory-tag-active' : ''}`}
            onClick={() => setActiveGroup('all')}
          >
            ✨ All Categories
          </button>
          {CATEGORY_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`directory-tag ${activeGroup === g.id ? 'directory-tag-active' : ''}`}
              onClick={() => setActiveGroup(g.id)}
              style={{
                borderColor: activeGroup === g.id ? g.color : undefined,
                color: activeGroup === g.id ? g.color : undefined,
                background: activeGroup === g.id ? g.bgTint : undefined,
              }}
            >
              <span aria-hidden="true">{g.emoji}</span>
              <span>{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results count when filtering */}
      {searchQuery && (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.875rem' }}>
          {filtered.length} {filtered.length === 1 ? 'category' : 'categories'} found
        </p>
      )}

      {/* Grid */}
      <div className="categories-grid">
        {filtered.map((cat, i) => {
          const meta = getCategoryMeta(cat.name);
          const lightColor = meta.lightColor || meta.color;
          return (
            <Link
              key={cat.name}
              href={`/categories/${cat.slug}`}
              id={cat.name}
              className="category-card surface-interactive"
              style={{ 
                animationDelay: `${Math.min(i * 0.03, 0.6)}s`,
                '--cat-color': meta.color,
                '--cat-light-color': lightColor,
                '--cat-bg': meta.bgTint,
                '--cat-bg-light': `${lightColor}15`,
                '--cat-border': meta.borderTint || `${meta.color}40`,
                '--cat-border-light': `${lightColor}35`,
                '--cat-gradient-bg': `linear-gradient(135deg, ${meta.color}15 0%, var(--bg-elevated) 100%)`,
                '--cat-gradient-light': meta.lightGradient || `linear-gradient(135deg, ${lightColor}12 0%, #ffffff 100%)`,
              } as React.CSSProperties}
            >
              <div 
                className="category-card-emoji" 
                aria-hidden="true"
                style={{
                  background: `${meta.color}18`,
                  borderColor: meta.borderTint || `${meta.color}40`,
                  boxShadow: `0 2px 10px ${meta.color}20`,
                }}
              >
                {meta.emoji || cat.emoji || cat.label.charAt(0)}
              </div>
              <div className="category-card-content">
                <h3 className="category-card-label">{cat.label}</h3>
                <span className="category-card-count">
                  Browse {cat.count.toLocaleString()} {cat.label} MCP {cat.count === 1 ? 'server' : 'servers'}
                </span>
              </div>
              <span className="category-card-arrow" aria-hidden="true" style={{ color: meta.color }}>→</span>
            </Link>
          );
        })}
      </div>


      {filtered.length === 0 && (
        <div className="surface empty-state" style={{ borderStyle: 'dashed' }}>
          <p className="empty-state-body" style={{ margin: 0 }}>
            No categories found matching &ldquo;{searchQuery}&rdquo;.
          </p>
        </div>
      )}
    </>
  );
}
