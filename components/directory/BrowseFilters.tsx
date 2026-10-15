'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import type { BrowseParams } from '../../lib/browseParams';
import { DIRECTORY_CATEGORIES, getCategoryMeta } from '../../lib/categories';

export type FacetKey = 'client' | 'stack' | 'transport' | 'pricing' | 'auth';

export type FacetState = {
  [K in FacetKey]: BrowseParams[K];
};

type FacetDef<K extends FacetKey = FacetKey> = {
  key: K;
  label: string;
  options: ReadonlyArray<readonly [NonNullable<BrowseParams[K]>, string]>;
};

/** Every /browse facet, in sidebar order. Values match lib/browseParams.ts. */
const FACETS: FacetDef[] = [
  {
    key: 'client',
    label: 'Works with',
    options: [
      ['claude', 'Claude'],
      ['cursor', 'Cursor'],
      ['windsurf', 'Windsurf'],
      ['cline', 'Cline'],
    ],
  },
  {
    key: 'stack',
    label: 'Language',
    options: [
      ['typescript', 'TypeScript'],
      ['python', 'Python'],
      ['go', 'Go'],
      ['rust', 'Rust'],
    ],
  },
  {
    key: 'transport',
    label: 'Transport',
    options: [
      ['stdio', 'Local (STDIO)'],
      ['remote', 'Remote (HTTP / SSE)'],
    ],
  },
  {
    key: 'pricing',
    label: 'Pricing',
    options: [
      ['free', 'Free'],
      ['freemium', 'Freemium'],
      ['paid', 'Paid'],
      ['byok', 'Bring your own key'],
    ],
  },
  {
    key: 'auth',
    label: 'Authentication',
    options: [
      ['none', 'No auth'],
      ['api_key', 'API key'],
      ['oauth', 'OAuth'],
    ],
  },
] as FacetDef[];

/** Short label for an active facet value (chips, empty-state suggestions). */
export function facetValueLabel(key: FacetKey, value: string): string {
  const def = FACETS.find((f) => f.key === key);
  const opt = def?.options.find(([v]) => v === value);
  return opt ? opt[1] : value;
}

const CATEGORY_PREVIEW = 8;

function FacetGroup({
  title,
  activeCount,
  children,
  defaultOpen = true,
}: {
  title: string;
  activeCount: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="dir-facet" open={defaultOpen || activeCount > 0}>
      <summary className="dir-facet-summary">
        <span>{title}</span>
        {activeCount > 0 && (
          <span className="dir-facet-dot">
            <span className="sr-only">(active)</span>
          </span>
        )}
        <ChevronDown size={15} className="dir-facet-chevron" aria-hidden />
      </summary>
      <div className="dir-facet-body">{children}</div>
    </details>
  );
}

function Option({
  label,
  active,
  onClick,
  prefix,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  prefix?: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      className="dir-option"
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="dir-option-check" aria-hidden="true">
        {active && <Check size={11} strokeWidth={3} />}
      </span>
      {prefix}
      <span className="dir-option-label">{label}</span>
      {count != null && (
        <span className="dir-option-count tabular">
          {count.toLocaleString('en-US')}
        </span>
      )}
    </button>
  );
}

/**
 * The browse filter panel — rendered in the sticky desktop sidebar and inside
 * the mobile bottom sheet. Every change applies immediately (the grid refetches).
 */
export function BrowseFilters({
  category,
  onCategory,
  facets,
  onFacet,
  verified,
  onVerified,
  idPrefix,
}: {
  category: string | null;
  onCategory: (c: string | null) => void;
  facets: FacetState;
  onFacet: (key: FacetKey, value: string | null) => void;
  verified: boolean;
  onVerified: (v: boolean) => void;
  /** Distinguishes the sidebar and sheet copies' input ids. */
  idPrefix: string;
}) {
  const [showAllCats, setShowAllCats] = useState(false);
  const [catQuery, setCatQuery] = useState('');
  const [catCounts, setCatCounts] = useState<Map<string, number> | null>(null);

  // Category sizes come from the CDN-cached palette index, so the list can be
  // ordered largest-first without adding a COUNT query to every /browse render.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/search-index?categories=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = (
          data as { categories?: { name: string; count: number }[] }
        )?.categories;
        if (!cancelled && list?.length) {
          setCatCounts(new Map(list.map((c) => [c.name, c.count])));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    const all = DIRECTORY_CATEGORIES.map((c) => ({
      value: c,
      count: catCounts?.get(c),
      ...getCategoryMeta(c),
    }));
    if (catCounts) all.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    if (q) return all.filter((c) => c.label.toLowerCase().includes(q));
    if (showAllCats) return all;
    const head = all.slice(0, CATEGORY_PREVIEW);
    // Keep the selected category visible even when collapsed.
    if (category && !head.some((c) => c.value === category)) {
      const sel = all.find((c) => c.value === category);
      if (sel) head.push(sel);
    }
    return head;
  }, [catQuery, showAllCats, category, catCounts]);

  return (
    <div className="dir-filters">
      <FacetGroup title="Status" activeCount={verified ? 1 : 0}>
        <label className="dir-switch">
          <input
            type="checkbox"
            role="switch"
            aria-checked={verified}
            checked={verified}
            onChange={(e) => onVerified(e.target.checked)}
          />
          <span className="dir-switch-track" aria-hidden="true" />
          <span className="dir-switch-text">
            <span className="dir-switch-title">Tested working</span>
            <span className="dir-switch-sub">
              Started in our sandbox or live
            </span>
          </span>
        </label>
      </FacetGroup>

      <FacetGroup title="Category" activeCount={category ? 1 : 0}>
        {(showAllCats || catQuery) && (
          <div className="dir-facet-search">
            <Search size={14} aria-hidden="true" />
            <input
              id={`${idPrefix}-cat-search`}
              type="search"
              placeholder="Find a category"
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              aria-label="Find a category"
              autoComplete="off"
            />
          </div>
        )}
        <fieldset
          className={`dir-option-list${showAllCats ? ' is-scroll' : ''} fieldset-plain`}
          aria-label="Category"
        >
          {categories.map((c) => (
            <Option
              key={c.value}
              label={c.label}
              count={c.count}
              active={category === c.value}
              prefix={
                <span className="dir-option-emoji" aria-hidden="true">
                  {c.emoji}
                </span>
              }
              onClick={() => onCategory(category === c.value ? null : c.value)}
            />
          ))}
          {categories.length === 0 && (
            <p className="dir-facet-empty">No matching category</p>
          )}
        </fieldset>
        {!catQuery && (
          <button
            type="button"
            className="dir-facet-more"
            onClick={() => setShowAllCats((v) => !v)}
          >
            {showAllCats
              ? 'Show fewer'
              : `Show all ${DIRECTORY_CATEGORIES.length}`}
          </button>
        )}
      </FacetGroup>

      {FACETS.map((f) => {
        const current = facets[f.key];
        return (
          <FacetGroup
            key={f.key}
            title={f.label}
            activeCount={current ? 1 : 0}
            defaultOpen={f.key === 'client' || f.key === 'stack'}
          >
            <fieldset
              className="dir-option-list fieldset-plain"
              aria-label={f.label}
            >
              {f.options.map(([value, label]) => (
                <Option
                  key={value}
                  label={label}
                  active={current === value}
                  onClick={() =>
                    onFacet(f.key, current === value ? null : value)
                  }
                />
              ))}
            </fieldset>
          </FacetGroup>
        );
      })}
    </div>
  );
}
