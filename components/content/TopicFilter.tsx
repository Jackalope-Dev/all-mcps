'use client';

import type React from 'react';
import { useState } from 'react';

interface Topic {
  id: string;
  label: string;
  count: number;
  /** Identity hue: shown as a small dot so chips match their cards. */
  hue?: string;
}

/**
 * Chip filter over server-rendered cards. Children carry `data-topic`; the
 * active chip hides the rest with one generated rule, so the cards stay
 * server components and every link is in the HTML for crawlers.
 */
export function TopicFilter({
  topics,
  total,
  label,
  children,
}: {
  topics: Topic[];
  total: number;
  label: string;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<string>('all');
  // ids come from our own catalog (lowercase slugs), never user input.
  const safe = /^[a-z0-9-]+$/.test(active) ? active : 'all';

  return (
    <div className="topic-filter" data-active={safe}>
      <div className="fade-x">
        <div className="topic-chips scroll-x" role="toolbar" aria-label={label}>
          <button
            type="button"
            className="chip"
            aria-pressed={safe === 'all'}
            onClick={() => setActive('all')}
          >
            All <span className="chip-count">{total}</span>
          </button>
          {topics.map((t) => (
            <button
              key={t.id}
              type="button"
              className="chip"
              aria-pressed={safe === t.id}
              onClick={() => setActive(t.id)}
            >
              {t.hue ? (
                <span className={`topic-dot hue-${t.hue}`} aria-hidden="true" />
              ) : null}
              {t.label} <span className="chip-count">{t.count}</span>
            </button>
          ))}
        </div>
      </div>
      {safe !== 'all' ? (
        <style>{`.topic-filter[data-active="${safe}"] [data-topic]:not([data-topic="${safe}"]){display:none}`}</style>
      ) : null}
      {children}
    </div>
  );
}
