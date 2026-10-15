'use client';

import { ArrowUpRight, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CATEGORY_GROUPS, getCategoryMeta } from '../lib/categories';
import { parseServerName } from '../lib/displayName';
import { ServerAvatar } from './ui/ServerAvatar';

type CategoryPreview = { id: string; name: string; logoUrl: string | null };

type CategoryItem = {
  name: string;
  emoji: string;
  label: string;
  count: number;
  slug: string;
  /** A few of the most-viewed servers in the category, for the card preview. */
  top?: CategoryPreview[];
};

export function CategoryGrid({ categories }: { categories: CategoryItem[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categories.filter((c) => {
      if (activeGroup !== 'all') {
        if (getCategoryMeta(c.name).group.id !== activeGroup) return false;
      }
      if (q) {
        const haystack =
          `${c.label} ${c.name} ${(c.top ?? []).map((s) => s.name).join(' ')}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [categories, searchQuery, activeGroup]);

  // Hash links (e.g. /categories#💻 Developer Tools) scroll to and flash the card.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(hash);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('is-targeted');
      setTimeout(() => el.classList.remove('is-targeted'), 2000);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="dir-cat-toolbar">
        <div className="dir-search dir-search--sm">
          <Search size={17} className="dir-search-icon" aria-hidden="true" />
          <input
            id="search-categories"
            type="search"
            className="dir-search-input"
            placeholder="Filter categories or servers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search categories"
            autoComplete="off"
          />
          {searchQuery && (
            <button
              type="button"
              className="dir-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <fieldset
          className="scroll-x fade-x dir-cat-groups fieldset-plain"
          aria-label="Category groups"
        >
          <button
            type="button"
            className="chip"
            aria-pressed={activeGroup === 'all'}
            onClick={() => setActiveGroup('all')}
          >
            All
          </button>
          {CATEGORY_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`chip hue-${g.hue}`}
              aria-pressed={activeGroup === g.id}
              onClick={() => setActiveGroup(g.id)}
            >
              <span className="dir-group-dot" aria-hidden="true" />
              {g.label}
            </button>
          ))}
        </fieldset>
      </div>

      <p className="dir-cat-meta" aria-live="polite">
        {filtered.length === categories.length
          ? `${categories.length} categories, largest first`
          : `${filtered.length} of ${categories.length} categories`}
      </p>

      {filtered.length > 0 ? (
        <ul className="dir-catgrid">
          {filtered.map((cat) => {
            const meta = getCategoryMeta(cat.name);
            const top = cat.top ?? [];
            return (
              <li key={cat.name}>
                <Link
                  href={`/categories/${cat.slug}`}
                  id={cat.name}
                  className={`dir-catcard spotlight tint-card hue-${meta.hue}`}
                >
                  <div className="dir-catcard-head">
                    <span className="dir-catcard-icon" aria-hidden="true">
                      {meta.emoji || cat.emoji || cat.label.charAt(0)}
                    </span>
                    <div className="dir-catcard-titles">
                      <h2 className="dir-catcard-title">{cat.label}</h2>
                      <span className="dir-catcard-count tabular">
                        {cat.count.toLocaleString('en-US')}{' '}
                        {cat.count === 1 ? 'server' : 'servers'}
                      </span>
                    </div>
                    <ArrowUpRight
                      size={16}
                      className="dir-catcard-arrow"
                      aria-hidden="true"
                    />
                  </div>
                  {top.length > 0 && (
                    <div className="dir-catcard-preview">
                      <span className="dir-catcard-avatars" aria-hidden="true">
                        {top.map((s) => (
                          <ServerAvatar
                            key={s.id}
                            name={s.name}
                            logoUrl={s.logoUrl}
                            category={cat.name}
                            size={22}
                          />
                        ))}
                      </span>
                      <span className="dir-catcard-names">
                        {top
                          .map((s) => parseServerName(s.name).displayName)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="dir-empty">
          <div className="dir-empty-icon" aria-hidden="true">
            <Search size={22} />
          </div>
          <h2 className="dir-empty-title">No categories match</h2>
          <p className="dir-empty-body">
            Nothing matches &ldquo;{searchQuery}&rdquo;. Search every server
            instead.
          </p>
          <div className="dir-empty-actions">
            <Link
              href={`/browse?q=${encodeURIComponent(searchQuery.trim())}`}
              className="btn btn-secondary btn-sm"
            >
              Search all servers
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearchQuery('');
                setActiveGroup('all');
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </>
  );
}
