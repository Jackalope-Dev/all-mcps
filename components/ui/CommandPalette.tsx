'use client';

import {
  ArrowRight,
  BookOpen,
  Clock,
  CornerDownLeft,
  FileText,
  Hash,
  Loader2,
  Search,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { categoryHue } from '../../lib/categories';
import { parseServerName } from '../../lib/displayName';
import { trackFeatureUse } from '../../lib/gtag';
import { OPEN_SEARCH_EVENT } from '../../lib/openSearch';
import type { Hue } from '../../lib/palette';
import { compileQuery, scoreServerMatch } from '../../lib/search';
import { guideByHref, guideTopicHue } from '../content/guideCatalog';
import { toolHue } from '../tools/toolCatalog';
import { InlineMarkdown } from './InlineMarkdown';
import { ServerAvatar } from './ServerAvatar';

type Group = 'recent' | 'server' | 'category' | 'page';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  /** Short label shown at the right of page items (Guide / Tool / Page). */
  category: string;
  categoryType: 'server' | 'page' | 'category' | 'search' | 'recent';
  url: string;
  icon?: React.ReactNode;
  /** Identity hue for the icon tile (category / tool group / guide topic). */
  hue?: Hue;
  /** Raw server name + logo, only set for categoryType 'server' — used to render ServerAvatar. */
  rawName?: string;
  logoUrl?: string | null;
  /** Extra searchable text (e.g. AI summary) not shown in the UI but matched by the filter. */
  searchText?: string;
  /** For recent-search items: the query to restore. */
  query?: string;
}

/** Typing pause before the palette asks the server for matches. */
const SEARCH_DEBOUNCE_MS = 150;
const RECENT_KEY = 'allmcps-cmdk-recent';
const RECENT_MAX = 5;

const GROUP_LABELS: Record<Group, string> = {
  recent: 'Recent searches',
  server: 'Servers',
  category: 'Categories',
  page: 'Pages & tools',
};

type IndexedServer = {
  id: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string | null;
  aiSummary?: string | null;
};
type IndexedCategory = {
  name: string;
  label: string;
  slug: string;
  count: number;
};

/** Same hues the header menu and hubs use: tool group for tools, topic for guides. */
function itemHue(item: CommandItem): Hue | undefined {
  if (item.hue) return item.hue;
  if (item.category === 'Tool') return toolHue(item.url);
  if (item.category === 'Guide') {
    return guideTopicHue(guideByHref(item.url)?.topic ?? 'setup');
  }
  return undefined;
}

const guide = <BookOpen size={16} aria-hidden="true" />;
const page = <FileText size={16} aria-hidden="true" />;
const tool = <Wrench size={16} aria-hidden="true" />;
const spark = <Sparkles size={16} aria-hidden="true" />;

const STATIC_PAGES: CommandItem[] = [
  {
    id: 'nav-browse',
    title: 'Browse all servers',
    subtitle: 'Search and filter the full catalog',
    category: 'Page',
    categoryType: 'page',
    url: '/browse',
    icon: <Search size={16} aria-hidden="true" />,
  },
  {
    id: 'nav-best',
    title: 'Best MCP servers',
    subtitle: 'Curated, ranked lists by use case',
    category: 'Page',
    categoryType: 'page',
    url: '/best',
    icon: spark,
  },
  {
    id: 'nav-categories',
    title: 'Browse categories',
    subtitle: 'Explore 50+ categories of MCP tools',
    category: 'Page',
    categoryType: 'page',
    url: '/categories',
    icon: <Hash size={16} aria-hidden="true" />,
  },
  {
    id: 'client-claude',
    title: 'Claude Desktop MCP setup',
    subtitle: 'How to install MCP servers into Claude Desktop',
    category: 'Guide',
    categoryType: 'page',
    url: '/mcp-for-claude-desktop',
    icon: guide,
  },
  {
    id: 'client-cursor',
    title: 'Cursor MCP setup',
    subtitle: 'How to install MCP servers into Cursor IDE',
    category: 'Guide',
    categoryType: 'page',
    url: '/mcp-for-cursor',
    icon: guide,
  },
  {
    id: 'client-windsurf',
    title: 'Windsurf MCP setup',
    subtitle: 'How to install MCP servers into Windsurf IDE',
    category: 'Guide',
    categoryType: 'page',
    url: '/mcp-for-windsurf',
    icon: guide,
  },
  {
    id: 'client-cline',
    title: 'Cline MCP setup',
    subtitle: 'How to install MCP servers into the Cline extension',
    category: 'Guide',
    categoryType: 'page',
    url: '/mcp-for-cline',
    icon: guide,
  },
  {
    id: 'tool-auditor',
    title: 'Config Auditor & Merger',
    subtitle: 'Audit client JSONs for missing keys & merge servers',
    category: 'Tool',
    categoryType: 'page',
    url: '/tools/config-auditor',
    icon: tool,
  },
  {
    id: 'tool-playground',
    title: 'Interactive MCP Playground',
    subtitle: 'Test remote JSON-RPC 2.0 endpoints online',
    category: 'Tool',
    categoryType: 'page',
    url: '/tools/playground',
    icon: tool,
  },
  {
    id: 'nav-prompts',
    title: 'Agent prompt & workflow library',
    subtitle: 'Multi-MCP system prompts & combined suites',
    category: 'Page',
    categoryType: 'page',
    url: '/prompts',
    icon: page,
  },
  {
    id: 'tool-openapi',
    title: 'OpenAPI to MCP generator',
    subtitle: 'Convert OpenAPI/Swagger specs to MCP server code',
    category: 'Tool',
    categoryType: 'page',
    url: '/tools/openapi-to-mcp',
    icon: tool,
  },
  {
    id: 'tool-inspector',
    title: 'Protocol Inspector & Debugger',
    subtitle: 'Inspect raw JSON-RPC 2.0 payloads & schemas',
    category: 'Tool',
    categoryType: 'page',
    url: '/tools/protocol-inspector',
    icon: tool,
  },
  {
    id: 'tool-validator',
    title: 'Config Validator',
    subtitle: 'Validate claude_desktop_config.json syntax',
    category: 'Tool',
    categoryType: 'page',
    url: '/tools/config-validator',
    icon: tool,
  },
  {
    id: 'tool-calculator',
    title: 'Token Cost Calculator',
    subtitle: 'Calculate MCP schema token context window overhead',
    category: 'Tool',
    categoryType: 'page',
    url: '/tools/token-calculator',
    icon: tool,
  },
  {
    id: 'nav-build',
    title: 'Build an MCP server',
    subtitle: 'Developer reference and specs',
    category: 'Guide',
    categoryType: 'page',
    url: '/build-mcp-server',
    icon: guide,
  },
  {
    id: 'nav-security',
    title: 'MCP security best practices',
    subtitle: 'Use MCP servers safely',
    category: 'Guide',
    categoryType: 'page',
    url: '/mcp-security',
    icon: guide,
  },
  {
    id: 'nav-versioning',
    title: 'MCP protocol versioning explained',
    subtitle: 'The stateless 2026-07-28 revision',
    category: 'Guide',
    categoryType: 'page',
    url: '/mcp-protocol-versioning',
    icon: guide,
  },
  {
    id: 'nav-docs-api',
    title: 'Directory API docs',
    subtitle: 'Search API, OpenAPI, agent discovery',
    category: 'Page',
    categoryType: 'page',
    url: '/docs/api',
    icon: page,
  },
  {
    id: 'nav-blog',
    title: 'Blog',
    subtitle: 'Guides and product updates',
    category: 'Page',
    categoryType: 'page',
    url: '/blog',
    icon: page,
  },
  {
    id: 'nav-submit',
    title: 'Submit an MCP server',
    subtitle: 'List your server free',
    category: 'Page',
    categoryType: 'page',
    url: '/submit',
    icon: spark,
  },
  {
    id: 'nav-badge',
    title: 'Badge embed builder',
    subtitle: 'Dynamic SVG README badges',
    category: 'Tool',
    categoryType: 'page',
    url: '/badge-generator',
    icon: tool,
  },
  {
    id: 'nav-pricing',
    title: 'Pricing & featured listings',
    subtitle: 'Promote your server',
    category: 'Page',
    categoryType: 'page',
    url: '/pricing',
    icon: spark,
  },
];

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((q): q is string => typeof q === 'string')
      : [];
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  const term = q.trim();
  if (term.length < 2) return;
  try {
    const next = [
      term,
      ...readRecent().filter((r) => r.toLowerCase() !== term.toLowerCase()),
    ].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

export function CommandPalette({
  initialOpen = false,
  onReady,
}: {
  /** Open immediately on mount — a search request arrived while this chunk was loading. */
  initialOpen?: boolean;
  /** Called once this component's own hotkey/open listeners are attached. */
  onReady?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveServers, setLiveServers] = useState<IndexedServer[] | null>(null);
  const [serversLoading, setServersLoading] = useState(false);
  const [liveCategories, setLiveCategories] = useState<IndexedCategory[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);
  const router = useRouter();

  // Category shortcuts load once, the first time the palette opens.
  useEffect(() => {
    if (!isOpen || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch('/api/search-index?categories=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const payload = data as { categories?: IndexedCategory[] } | null;
        if (payload?.categories) setLiveCategories(payload.categories);
      })
      .catch(() => {
        // Silently degrade to page shortcuts if categories can't load.
      });
  }, [isOpen]);

  // Server matches are fetched as you type (after a short pause), ranked by the
  // same search the API uses.
  useEffect(() => {
    const q = query.trim();
    if (!isOpen || !q) {
      setLiveServers(null);
      setServersLoading(false);
      return;
    }
    setServersLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search-index?q=${encodeURIComponent(q)}&limit=8`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const payload = data as { servers?: IndexedServer[] } | null;
          setLiveServers(payload?.servers ?? []);
          setServersLoading(false);
        })
        .catch((e: Error) => {
          // Aborted by the next keystroke, or offline: keep page matches only.
          if (e.name !== 'AbortError') setServersLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    const handleOpenRequest = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(OPEN_SEARCH_EVENT, handleOpenRequest);
    onReady?.();
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(OPEN_SEARCH_EVENT, handleOpenRequest);
    };
  }, [isOpen, onReady]);

  // Lock scroll, focus input and load recent searches when open.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setRecent(readRecent());
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
    document.body.style.overflow = '';
    setQuery('');
    setSelectedIndex(0);
  }, [isOpen]);

  const categoryItems: CommandItem[] = useMemo(
    () =>
      liveCategories.map((c) => ({
        id: `category-${c.slug}`,
        title: c.label,
        subtitle: `${c.count.toLocaleString()} ${c.count === 1 ? 'server' : 'servers'}`,
        category: 'Category',
        categoryType: 'category',
        url: `/categories/${c.slug}`,
        icon: <Hash size={16} aria-hidden="true" />,
        hue: categoryHue(c.name),
      })),
    [liveCategories],
  );

  // Ordered groups. Keyboard navigation walks the flattened list.
  const groups: Array<{ group: Group; items: CommandItem[] }> = useMemo(() => {
    const q = query.trim();
    if (!q) {
      const recentItems: CommandItem[] = recent.map((r) => ({
        id: `recent-${r}`,
        title: r,
        subtitle: '',
        category: '',
        categoryType: 'recent',
        url: `/browse?q=${encodeURIComponent(r)}`,
        icon: <Clock size={16} aria-hidden="true" />,
        query: r,
      }));
      return [
        { group: 'recent' as const, items: recentItems },
        { group: 'page' as const, items: STATIC_PAGES.slice(0, 6) },
        { group: 'category' as const, items: categoryItems.slice(0, 6) },
      ].filter((g) => g.items.length > 0);
    }

    const terms = compileQuery(q);
    const fullQuery = terms.map((t) => t.term).join(' ');
    const score = (items: CommandItem[], max: number) =>
      terms.length === 0
        ? []
        : items
            .map((item) => ({
              item,
              score: scoreServerMatch(
                {
                  name: item.title,
                  description: item.subtitle,
                  category: item.category,
                  extraText: item.searchText,
                },
                terms,
                fullQuery,
                false,
              ),
            }))
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, max)
            .map((s) => s.item);

    // Servers arrive already ranked by the server; keep that order.
    const serverItems: CommandItem[] = (liveServers ?? []).map((s) => ({
      id: `server-${s.id}`,
      title: parseServerName(s.name).displayName,
      subtitle: s.description,
      category: s.category || 'Server',
      categoryType: 'server',
      url: `/mcp/${s.id}`,
      rawName: s.name,
      logoUrl: s.logoUrl ?? null,
      searchText: s.aiSummary ?? undefined,
    }));
    serverItems.push({
      id: 'search-all',
      title: `Search all servers for “${q}”`,
      subtitle: '',
      category: '',
      categoryType: 'search',
      url: `/browse?q=${encodeURIComponent(q)}`,
      icon: <Search size={16} aria-hidden="true" />,
    });

    return [
      { group: 'server' as const, items: serverItems },
      { group: 'category' as const, items: score(categoryItems, 3) },
      { group: 'page' as const, items: score(STATIC_PAGES, 4) },
    ].filter((g) => g.items.length > 0);
  }, [query, recent, categoryItems, liveServers]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Reset the highlighted row whenever the query changes (adjusted during
  // render, React's "reset state when a value changes" pattern).
  const [indexedQuery, setIndexedQuery] = useState(query);
  if (indexedQuery !== query) {
    setIndexedQuery(query);
    setSelectedIndex(0);
  }

  // Keep the active row in view while arrowing.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = (item: CommandItem) => {
    if (item.categoryType === 'recent' && item.query) {
      setQuery(item.query);
      inputRef.current?.focus();
      return;
    }
    if (query.trim()) saveRecent(query);
    trackFeatureUse('command_palette', {
      category: item.categoryType,
      title: item.title,
      url: item.url,
    });
    setIsOpen(false);
    router.push(item.url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const n = Math.max(1, flat.length);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + n) % n);
    } else if (e.key === 'Enter' && flat[selectedIndex]) {
      e.preventDefault();
      handleSelect(flat[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  let index = -1;
  const activeId = flat[selectedIndex]
    ? `cmdk-item-${selectedIndex}`
    : undefined;

  return (
    <div className="cmdk-overlay">
      <button
        type="button"
        className="cmdk-backdrop"
        aria-label="Close search"
        tabIndex={-1}
        onClick={() => setIsOpen(false)}
      />
      <div
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Search AllMCPs"
        onKeyDown={handleKeyDown}
      >
        <div className="cmdk-head">
          {serversLoading ? (
            <Loader2 size={18} className="cmdk-head-icon cmdk-spin" />
          ) : (
            <Search size={18} className="cmdk-head-icon" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            type="text"
            className="cmdk-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search servers, categories, guides and tools…"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="cmdk-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close search"
          >
            <span className="kbd">Esc</span>
            <X size={16} className="cmdk-close-x" aria-hidden="true" />
          </button>
        </div>

        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
          {flat.length === 0 ? (
            <div className="cmdk-empty">
              {query.trim()
                ? serversLoading
                  ? 'Searching…'
                  : `Nothing matches “${query.trim()}”.`
                : 'Start typing to search the directory.'}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.group} className="cmdk-group" role="presentation">
                <div className="cmdk-group-label" role="presentation">
                  {GROUP_LABELS[g.group]}
                </div>
                {g.items.map((item) => {
                  index += 1;
                  const i = index;
                  const active = selectedIndex === i;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      id={`cmdk-item-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={active}
                      tabIndex={-1}
                      className={`cmdk-item${active ? ' is-active' : ''}${item.categoryType === 'search' ? ' cmdk-item--action' : ''}`}
                      onClick={() => handleSelect(item)}
                      onMouseMove={() => {
                        if (!active) setSelectedIndex(i);
                      }}
                    >
                      {item.categoryType === 'server' && item.rawName ? (
                        <ServerAvatar
                          name={item.rawName}
                          logoUrl={item.logoUrl}
                          category={item.category}
                          size={30}
                        />
                      ) : (
                        <span
                          className={`cmdk-item-icon${itemHue(item) ? ` hue-${itemHue(item)}` : ''}`}
                        >
                          {item.icon}
                        </span>
                      )}
                      <span className="cmdk-item-text">
                        <span className="cmdk-item-title">{item.title}</span>
                        {item.subtitle && (
                          <span className="cmdk-item-sub">
                            <InlineMarkdown content={item.subtitle} />
                          </span>
                        )}
                      </span>
                      {item.categoryType === 'page' && (
                        <span className="cmdk-item-tag">{item.category}</span>
                      )}
                      <CornerDownLeft
                        size={14}
                        className="cmdk-item-enter"
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="cmdk-foot">
          <span>
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
          </span>
          <span>
            <span className="kbd">↵</span> open
          </span>
          <span className="cmdk-foot-right">
            <Link
              href="/browse"
              className="cmdk-foot-link"
              onClick={() => setIsOpen(false)}
            >
              Advanced search <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
