'use client';

import { Search } from 'lucide-react';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';

export interface DirectoryServerHit {
  id: string;
  name: string;
  description: string;
  category: string;
}

/**
 * Directory search combobox shared by the config generator and token
 * calculator. Debounced /api/v1/search, arrow-key navigation, Enter to add.
 */
export function ServerPicker({
  onSelect,
  placeholder = 'Search the directory…',
  addedIds,
  source = 'api',
}: {
  onSelect: (server: DirectoryServerHit) => void;
  placeholder?: string;
  /** Ids already added — shown as "Added" in the results. */
  addedIds?: ReadonlySet<string>;
  /**
   * 'api' = public /api/v1/search; 'index' = the on-site /api/search-index
   * lookup (not logged as external API use).
   */
  source?: 'api' | 'index';
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryServerHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setResults([]);
      setError(false);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      const base = source === 'index' ? '/api/search-index' : '/api/v1/search';
      fetch(`${base}?q=${encodeURIComponent(trimmedQuery)}&limit=8`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Search failed (${res.status})`);
          return res.json() as Promise<{ servers?: DirectoryServerHit[] }>;
        })
        .then((data) => {
          setResults(data.servers || []);
          setActive(0);
          setIsOpen(true);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          setError(true);
          setResults([]);
          setIsOpen(true);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery, source]);

  // Dismiss on outside click, but keep whatever was typed — only picking a
  // result clears the query.
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const showDropdown = isOpen && trimmedQuery.length >= 2;

  const pick = (server: DirectoryServerHit) => {
    onSelect(server);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (!showDropdown || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[active];
      if (hit) pick(hit);
    }
  };

  return (
    <div ref={containerRef} className="tl-picker">
      <div className="tl-picker-input">
        <Search size={16} aria-hidden="true" />
        <input
          className="tl-input"
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (trimmedQuery.length >= 2) setIsOpen(true);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showDropdown && results[active]
              ? `${listId}-${results[active].id}`
              : undefined
          }
          aria-label="Search MCP directory"
          autoComplete="off"
        />
        {loading ? (
          <span className="tl-picker-spin" aria-hidden="true" />
        ) : null}
      </div>
      {showDropdown && !loading ? (
        <div className="tl-picker-pop">
          {error ? (
            <div className="tl-picker-note" role="status">
              Search is temporarily unavailable — try again in a moment.
            </div>
          ) : results.length === 0 ? (
            <div className="tl-picker-note" role="status">
              No servers match &ldquo;{trimmedQuery}&rdquo;.
            </div>
          ) : (
            <div id={listId} role="listbox" aria-label="Matching servers">
              {results.map((server, i) => {
                const added = addedIds?.has(server.id);
                return (
                  <button
                    type="button"
                    key={server.id}
                    id={`${listId}-${server.id}`}
                    role="option"
                    aria-selected={i === active}
                    className={`tl-picker-option ${i === active ? 'is-active' : ''} ${added ? 'is-added' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(server)}
                  >
                    <span className="tl-picker-avatar" aria-hidden="true">
                      {server.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="tl-picker-text">
                      <span className="tl-picker-name">{server.name}</span>
                      <span className="tl-picker-meta">
                        {server.category}
                        {server.description ? ` · ${server.description}` : ''}
                      </span>
                    </span>
                    <span className="tl-picker-add">
                      {added ? 'Added' : '+ Add'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
