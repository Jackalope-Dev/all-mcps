'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

export interface DirectoryServerHit {
  id: string;
  name: string;
  description: string;
  category: string;
}

export function ServerPicker({
  onSelect,
  placeholder = 'Search the directory…',
}: {
  onSelect: (server: DirectoryServerHit) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryServerHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      fetch(`/api/v1/search?q=${encodeURIComponent(trimmedQuery)}&limit=8`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Search failed (${res.status})`);
          return res.json() as Promise<{ servers?: DirectoryServerHit[] }>;
        })
        .then((data) => {
          setResults(data.servers || []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery]);

  // Dismiss the dropdown on outside click or Escape, but keep whatever was typed —
  // the only thing that should clear the query is actually picking a result.
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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const showDropdown = isOpen && trimmedQuery.length >= 2;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (trimmedQuery.length >= 2) setIsOpen(true);
        }}
        aria-label="Search MCP directory"
      />
      {showDropdown && (
        <div style={{ marginTop: '0.5rem' }}>
          {loading && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Searching…
            </div>
          )}
          {!loading && error && (
            <div
              style={{
                fontSize: '0.8rem',
                color: '#d97706',
                background: 'rgba(217,119,6,0.1)',
                border: '1px solid rgba(217,119,6,0.3)',
                borderRadius: '8px',
                padding: '0.6rem 0.75rem',
              }}
            >
              Search is temporarily unavailable — try again in a moment, or
              paste the listing id directly.
            </div>
          )}
          {!loading && !error && results.length === 0 && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                padding: '0.25rem 0',
              }}
            >
              No matching listings found for &ldquo;{trimmedQuery}&rdquo;.
            </div>
          )}
          {!loading && !error && results.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {results.map((server) => (
                <Card
                  key={server.id}
                  hoverable
                  onClick={() => {
                    onSelect(server);
                    setQuery('');
                    setResults([]);
                    setIsOpen(false);
                  }}
                  style={{ padding: '0.75rem 1rem', cursor: 'pointer' }}
                >
                  <strong style={{ display: 'block' }}>{server.name}</strong>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {server.category}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
