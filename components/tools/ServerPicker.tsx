'use client';

import { useEffect, useState } from 'react';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';

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

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=8`, { signal: controller.signal })
        .then((res) => res.json() as Promise<{ servers?: DirectoryServerHit[] }>)
        .then((data) => setResults(data.servers || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <div style={{ position: 'relative' }}>
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search MCP directory"
      />
      {loading && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Searching…</div>
      )}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
          {results.map((server) => (
            <Card
              key={server.id}
              hoverable
              onClick={() => {
                onSelect(server);
                setQuery('');
                setResults([]);
              }}
              style={{ padding: '0.75rem 1rem', cursor: 'pointer' }}
            >
              <strong style={{ display: 'block' }}>{server.name}</strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{server.category}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
