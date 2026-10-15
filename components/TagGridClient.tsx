'use client';

import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { hueClass } from '@/lib/palette';
import type { TagWithCount } from '@/lib/tags';

type SortMode = 'popular' | 'alpha';

function letterOf(label: string): string {
  const c = label.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

export function TagGridClient({ tags }: { tags: TagWithCount[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('popular');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q
      ? tags.filter(
          (t) =>
            t.label.toLowerCase().includes(q) ||
            t.slug.toLowerCase().includes(q),
        )
      : [...tags];
    list.sort((a, b) =>
      sort === 'alpha'
        ? a.label.localeCompare(b.label)
        : b.count - a.count || a.label.localeCompare(b.label),
    );
    return list;
  }, [tags, query, sort]);

  // A–Z mode groups tags under letter headings with a jump bar.
  const groups = useMemo(() => {
    if (sort !== 'alpha') return null;
    const map = new Map<string, TagWithCount[]>();
    for (const t of filtered) {
      const l = letterOf(t.label);
      map.set(l, [...(map.get(l) ?? []), t]);
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b),
    );
  }, [filtered, sort]);

  const max = tags[0]?.count ?? 1;

  return (
    <div>
      <div className="dir-tag-toolbar">
        <div className="dir-search dir-search--sm">
          <Search size={17} className="dir-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="dir-search-input"
            placeholder={`Filter ${tags.length} tags`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tags"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              className="dir-search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <fieldset className="segmented fieldset-plain" aria-label="Sort tags">
          <button
            type="button"
            aria-pressed={sort === 'popular'}
            onClick={() => setSort('popular')}
          >
            Most servers
          </button>
          <button
            type="button"
            aria-pressed={sort === 'alpha'}
            onClick={() => setSort('alpha')}
          >
            A–Z
          </button>
        </fieldset>
      </div>

      <p className="dir-cat-meta" aria-live="polite">
        {query
          ? `${filtered.length} ${filtered.length === 1 ? 'tag matches' : 'tags match'} “${query.trim()}”`
          : `${tags.length} tags`}
      </p>

      {filtered.length === 0 ? (
        <div className="dir-empty">
          <div className="dir-empty-icon" aria-hidden="true">
            <Search size={22} />
          </div>
          <h2 className="dir-empty-title">No tags match</h2>
          <p className="dir-empty-body">
            Try a shorter word, or search every server for &ldquo;
            {query.trim()}&rdquo;.
          </p>
          <div className="dir-empty-actions">
            <Link
              href={`/browse?q=${encodeURIComponent(query.trim())}`}
              className="btn btn-secondary btn-sm"
            >
              Search all servers
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setQuery('')}
            >
              Clear filter
            </button>
          </div>
        </div>
      ) : groups ? (
        <>
          <nav
            className="scroll-x fade-x dir-letters"
            aria-label="Jump to letter"
          >
            {groups.map(([letter]) => (
              <a key={letter} href={`#tags-${letter}`} className="chip">
                {letter}
              </a>
            ))}
          </nav>
          {groups.map(([letter, items]) => (
            <section
              key={letter}
              id={`tags-${letter}`}
              className="dir-letter-group"
              aria-label={`Tags starting with ${letter}`}
            >
              <h2 className="dir-letter">{letter}</h2>
              <TagList tags={items} max={max} />
            </section>
          ))}
        </>
      ) : (
        <TagList tags={filtered} max={max} />
      )}
    </div>
  );
}

function TagList({ tags, max }: { tags: TagWithCount[]; max: number }) {
  return (
    <ul className="dir-tags">
      {tags.map(({ slug, label, count }) => (
        <li key={slug}>
          <Link href={`/tags/${slug}`} className={`dir-tag ${hueClass(slug)}`}>
            <span className="dir-tag-label">{label}</span>
            <span className="dir-tag-count tabular">{count}</span>
            <span
              className="dir-tag-bar"
              aria-hidden="true"
              style={{ transform: `scaleX(${Math.max(0.04, count / max)})` }}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
