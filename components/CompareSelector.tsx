'use client';

import { ArrowRight, Check, Plus, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ComparePickServer } from '@/lib/comparePick';
import { trackFeatureUse } from '@/lib/gtag';
import { ServerAvatar } from './ui/ServerAvatar';

const MAX = 4;

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
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return servers.slice(0, 12);
    return servers
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [servers, query]);

  const byId = useMemo(() => new Map(servers.map((s) => [s.id, s])), [servers]);
  const selected = selectedIds
    .map((id) => byId.get(id))
    .filter((s): s is ComparePickServer => Boolean(s));
  const full = selectedIds.length >= MAX;

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : prev.length < MAX
          ? [...prev, id]
          : prev,
    );

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
                onClick={() => toggle(s.id)}
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
          <li className="cmp-empty">No servers match &ldquo;{query}&rdquo;.</li>
        )}
      </ul>
    </div>
  );
}
