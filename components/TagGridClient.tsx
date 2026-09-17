'use client';

import {
  Flame,
  Layers,
  LayoutGrid,
  Search,
  SortAsc,
  Tag,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { TagWithCount } from '@/lib/tags';

interface TagGridClientProps {
  tags: TagWithCount[];
}

export function TagGridClient({ tags }: TagGridClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'popular' | 'alphabetical'>(
    'all',
  );
  const [selectedLetter, setSelectedLetter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<
    'count-desc' | 'count-asc' | 'alpha-asc' | 'alpha-desc'
  >('count-desc');

  // Compute list of available first letters
  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const tag of tags) {
      const firstChar = tag.label.trim().charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar)) {
        set.add(firstChar);
      } else {
        set.add('#');
      }
    }
    return set;
  }, [tags]);

  const allAlphabetLetters = [
    'ALL',
    '#',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  ];

  // Filtered & Sorted Tags
  const processedTags = useMemo(() => {
    let result = [...tags];

    // 1. Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.label.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
      );
    }

    // 2. Filter by view mode (Popular)
    if (viewMode === 'popular') {
      // Tags with at least 3 servers or top tags
      result = result.filter((t) => t.count >= 3);
    }

    // 3. Filter by selected letter
    if (selectedLetter !== 'ALL') {
      result = result.filter((t) => {
        const firstChar = t.label.trim().charAt(0).toUpperCase();
        if (selectedLetter === '#') {
          return !/[A-Z]/.test(firstChar);
        }
        return firstChar === selectedLetter;
      });
    }

    // 4. Sort
    result.sort((a, b) => {
      if (sortBy === 'count-desc')
        return b.count - a.count || a.label.localeCompare(b.label);
      if (sortBy === 'count-asc')
        return a.count - b.count || a.label.localeCompare(b.label);
      if (sortBy === 'alpha-asc') return a.label.localeCompare(b.label);
      if (sortBy === 'alpha-desc') return b.label.localeCompare(a.label);
      return 0;
    });

    return result;
  }, [tags, searchQuery, viewMode, selectedLetter, sortBy]);

  // Group tags by letter for Alphabetical View
  const groupedByLetter = useMemo(() => {
    const groups: { [key: string]: TagWithCount[] } = {};
    for (const tag of processedTags) {
      const firstChar = tag.label.trim().charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!groups[letter]) {
        groups[letter] = [];
      }
      groups[letter].push(tag);
    }

    // Sort group keys
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '#') return -1;
      if (b === '#') return 1;
      return a.localeCompare(b);
    });

    return sortedKeys.map((key) => ({
      letter: key,
      items: groups[key],
    }));
  }, [processedTags]);

  const handleClear = () => {
    setSearchQuery('');
    setSelectedLetter('ALL');
  };

  return (
    <div className="tags-toolbar-section">
      {/* Search and Filters Toolbar */}
      <div className="tags-toolbar">
        {/* Search Bar */}
        <div className="tags-search-row">
          <Search size={18} className="tags-search-icon" />
          <input
            type="text"
            className="tags-search-input"
            placeholder="Search 100+ topics and technology tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search tags"
          />
          {searchQuery && (
            <button
              type="button"
              className="tags-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* View Mode & Sort Controls */}
        <div className="tags-filter-bar">
          <div
            className="tags-view-tabs"
            role="tablist"
            aria-label="Tag view mode"
          >
            <button
              type="button"
              className={`tags-view-tab ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
              role="tab"
              aria-selected={viewMode === 'all'}
            >
              <LayoutGrid size={15} /> All Tags
            </button>
            <button
              type="button"
              className={`tags-view-tab ${viewMode === 'popular' ? 'active' : ''}`}
              onClick={() => setViewMode('popular')}
              role="tab"
              aria-selected={viewMode === 'popular'}
            >
              <Flame
                size={15}
                style={{
                  color: viewMode === 'popular' ? '#ffffff' : '#ff9800',
                }}
              />{' '}
              Popular
            </button>
            <button
              type="button"
              className={`tags-view-tab ${viewMode === 'alphabetical' ? 'active' : ''}`}
              onClick={() => setViewMode('alphabetical')}
              role="tab"
              aria-selected={viewMode === 'alphabetical'}
            >
              <Layers size={15} /> Alphabetical
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SortAsc size={16} style={{ color: 'var(--text-secondary)' }} />
            <select
              className="tags-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sort tags by"
            >
              <option value="count-desc">Most Servers</option>
              <option value="count-asc">Least Servers</option>
              <option value="alpha-asc">Name (A–Z)</option>
              <option value="alpha-desc">Name (Z–A)</option>
            </select>
          </div>
        </div>

        {/* Alphabet Jump Bar */}
        <div
          className="tag-alphabet-bar"
          role="group"
          aria-label="Alphabetical jump filter"
        >
          {allAlphabetLetters.map((letter) => {
            const isAvailable =
              letter === 'ALL' || availableLetters.has(letter);
            const isActive = selectedLetter === letter;

            return (
              <button
                key={letter}
                type="button"
                className={`tag-alphabet-btn ${isActive ? 'active' : ''} ${!isAvailable ? 'disabled' : ''}`}
                onClick={() => isAvailable && setSelectedLetter(letter)}
                disabled={!isAvailable}
                aria-label={`Filter by letter ${letter}`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count Summary */}
      {(searchQuery || selectedLetter !== 'ALL' || viewMode === 'popular') && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span>
            Showing{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {processedTags.length}
            </strong>{' '}
            tags
            {searchQuery && <> matching &ldquo;{searchQuery}&rdquo;</>}
            {selectedLetter !== 'ALL' && (
              <> starting with &ldquo;{selectedLetter}&rdquo;</>
            )}
            {viewMode === 'popular' && <> (Popular)</>}
          </span>
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-color)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Render Tags: Alphabetical Mode vs Standard Grid */}
      {viewMode === 'alphabetical' &&
      !searchQuery &&
      selectedLetter === 'ALL' ? (
        <div>
          {groupedByLetter.map(({ letter, items }) => (
            <div key={letter} className="tag-letter-group">
              <div className="tag-letter-header">
                <span>{letter}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  ({items.length} {items.length === 1 ? 'tag' : 'tags'})
                </span>
              </div>
              <div className="tags-grid">
                {items.map(({ slug, label, count }) => (
                  <TagCard key={slug} slug={slug} label={label} count={count} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="tags-grid">
          {processedTags.map(({ slug, label, count }) => (
            <TagCard key={slug} slug={slug} label={label} count={count} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {processedTags.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 1.5rem',
            background: 'var(--bg-elevated)',
            border: '1px dashed var(--border-color)',
            borderRadius: '16px',
            marginTop: '1rem',
          }}
        >
          <Tag
            size={36}
            style={{
              color: 'var(--text-secondary)',
              opacity: 0.5,
              marginBottom: '1rem',
            }}
          />
          <h3
            style={{
              fontSize: '1.2rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            No tags found
          </h3>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              maxWidth: '400px',
              margin: '0 auto 1.5rem',
            }}
          >
            We couldn&apos;t find any topics matching your search or selected
            letter filter.
          </p>
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              background: 'var(--brand-gradient)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Clear Search & Filters
          </button>
        </div>
      )}
    </div>
  );
}

function TagCard({
  slug,
  label,
  count,
}: {
  slug: string;
  label: string;
  count: number;
}) {
  return (
    <Link href={`/tags/${slug}`} className="tag-card">
      <div className="tag-card-info">
        <Tag size={15} className="tag-card-icon" />
        <span className="tag-card-label">{label}</span>
      </div>
      <span className="tag-card-badge">{count}</span>
    </Link>
  );
}
