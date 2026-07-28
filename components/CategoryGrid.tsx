'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';

type CategoryItem = {
  name: string;
  emoji: string;
  label: string;
  count: number;
};

export function CategoryGrid({ categories }: { categories: CategoryItem[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasScrolled, setHasScrolled] = useState(false);

  const filtered = useMemo(() => {
    if (!searchQuery) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(c => c.label.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

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
      {/* Search */}
      <div className="animate-fade-in delay-2" style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem' }}>
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
      </div>

      {/* Results count when filtering */}
      {searchQuery && (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.875rem' }}>
          {filtered.length} {filtered.length === 1 ? 'category' : 'categories'} found
        </p>
      )}

      {/* Grid */}
      <div className="categories-grid">
        {filtered.map((cat, i) => (
          <Link
            key={cat.name}
            href={`/browse?category=${encodeURIComponent(cat.name)}`}
            id={cat.name}
            className="category-card surface-interactive"
            style={{ animationDelay: `${Math.min(i * 0.03, 0.6)}s` }}
          >
            <div className="category-card-emoji" aria-hidden="true">
              {cat.emoji || cat.label.charAt(0)}
            </div>
            <div className="category-card-content">
              <h3 className="category-card-label">{cat.label}</h3>
              <span className="category-card-count">
                {cat.count.toLocaleString()} {cat.count === 1 ? 'server' : 'servers'}
              </span>
            </div>
            <span className="category-card-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
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
