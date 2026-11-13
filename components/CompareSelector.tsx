'use client';

import { ArrowRight, Check, Plus, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { type ComparePickServer, toPickServer } from '@/lib/comparePick';
import { trackFeatureUse } from '@/lib/gtag';
import { ServerAvatar } from './ui/ServerAvatar';

const MAX = 4;
const RESULTS = 12;

interface CompareSelectorProps {
  servers: ComparePickServer[];
  /** Pre-selected server ids (e.g. the servers already being compared). */
  initialIds?: string[];
}

/**
 * Server picker for /compare: a tray of up to four slots, a search box, and a
 * result list. Two picks go to the canonical /mcp/[a]/vs/[b] page; three or
 * four go to the /compare/[a-vs-b-vs-c] matrix.
 */
export function CompareSelector({
  servers,
  initialIds = [],
}: CompareSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    initialIds.slice(0, MAX),
  );
  const [query, setQuery] = useState('');
  // Catalog-wide matches for the current query. `servers` is only a starter
  // set (the newest few hundred), so filtering it alone missed most listings:
  // the header search found "call4me" while this said nothing matched.
  const [remote, setRemote] = useState<{
    q: string;
    servers: ComparePickServer[] | null;
  } | null>(null);
  // Picks that came from a search, so the tray can still show them after the
  // query changes.
  const [picked, setPicked] = useState<Map<string, ComparePickServer>>(
    () => new Map(),
  );
  const router = useRouter();

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(
        `/api/search-index?q=${encodeURIComponent(trimmed)}&limit=${RESULTS}`,
        { signal: controller.signal },
      )
        .then((res) => {
          if (!res.ok) throw new Error(`Search failed (${res.status})`);
          return res.json() as Promise<{ servers?: ComparePickServer[] }>;
        })
        .then((data) =>
          setRemote({
            q: trimmed,
            servers: (data.servers ?? []).map(toPickServer),
          }),
        )
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          setRemote({ q: trimmed, servers: null });
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const localMatches = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return servers.slice(0, RESULTS);
    return servers
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q),
      )
      .slice(0, RESULTS);
  }, [servers, trimmed]);

  // The search result for this exact query wins; while it loads (or if the
  // search failed) the starter set's matches stand in.
  const current = remote && remote.q === trimmed ? remote : null;
  const searching = trimmed.length >= 2 && !current;
  const filtered =
    trimmed.length >= 2 && current?.servers ? current.servers : localMatches;

  const byId = useMemo(() => {
    const map = new Map(servers.map((s) => [s.id, s]));
    for (const [id, s] of picked) if (!map.has(id)) map.set(id, s);
    return map;
  }, [servers, picked]);
  const selected = selectedIds
    .map((id) => byId.get(id))
    .filter((s): s is ComparePickServer => Boolean(s));
  const full = selectedIds.length >= MAX;

  const toggle = (id: string, server?: ComparePickServer) => {
    if (server && !byId.has(id)) {
      setPicked((prev) => new Map(prev).set(id, server));
    }
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : prev.length < MAX
          ? [...prev, id]
          : prev,
    );
  };

  const compare = () => {
    if (selectedIds.length < 2) return;
    trackFeatureUse('compare_servers', {
      server_ids: selectedIds,
      count: selectedIds.length,
    });
    if (selectedIds.length === 2) {
      const [a, b] = selectedIds;
      const [c0, c1] = a < b ? [a, b] : [b, a];
      router.push(`/mcp/${c0}/vs/${c1}`);
    } else {
      router.push(`/compare/${selectedIds.join('-vs-')}`);
    }
  };

  return (
    <div className="cmp-picker">
      <div className="cmp-tray" aria-live="polite">
        <ol className="cmp-slots">
          {Array.from({ length: MAX }, (_, i) => {
            const s = selected[i];
            return (
              <li
                key={s?.id ?? `empty-${i}`}
                className={`cmp-slot${s ? ' is-filled' : ''}`}
              >
                {s ? (
                  <>
                    <ServerAvatar name={s.name} logoUrl={s.logoUrl} size={24} />
                    <span className="cmp-slot-name">{s.name}</span>
                    <button
                      type="button"
                      className="lst-icon-btn cmp-slot-x"
                      onClick={() => toggle(s.id)}
                      aria-label={`Remove ${s.name}`}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <span className="cmp-slot-empty">
                    {i < 2 ? `Server ${i + 1}` : 'Optional'}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={compare}
          disabled={selectedIds.length < 2}
          className="btn btn-primary btn-md cmp-go"
        >
          Compare {selectedIds.length >= 2 ? selectedIds.length : ''}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>

      <label className="cmp-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search servers by name, category or keyword"
          aria-label="Search servers to compare"
        />
      </label>

      <ul className="cmp-results">
        {filtered.map((s) => {
          const isSelected = selectedIds.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                className="cmp-result"
                aria-pressed={isSelected}
                disabled={!isSelected && full}
                onClick={() => toggle(s.id, s)}
              >
                <ServerAvatar name={s.name} logoUrl={s.logoUrl} size={28} />
                <span className="cmp-result-text">
                  <span className="cmp-result-name">{s.name}</span>
                  <span className="cmp-result-cat">{s.category}</span>
                </span>
                <span className="cmp-result-check" aria-hidden="true">
                  {isSelected ? <Check size={13} /> : <Plus size={13} />}
                </span>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="cmp-empty" role="status">
            {searching ? 'Searching…' : `No servers match “${trimmed}”.`}
          </li>
        )}
      </ul>
    </div>
  );
}
