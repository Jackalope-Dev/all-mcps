'use client';

import { ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { openSearch } from '../lib/openSearch';
import { ClientLogo } from './ClientLogo';
import { AmbientCodeBackground } from './ui/AmbientCodeBackground';

interface HeroSectionProps {
  totalCount?: number;
  /** Server-rendered featured-listings row (components/FeaturedCards.tsx). */
  featuredSlot?: React.ReactNode;
}

/** Real jobs people search for — cycled through the input's placeholder. */
const PLACEHOLDER_JOBS = [
  'query Postgres',
  'review pull requests',
  'scrape the web',
  'automate a browser',
  'search Slack',
  'remember across chats',
  'deploy to Cloudflare',
];

const POPULAR_QUERIES = [
  'postgres',
  'github',
  'playwright',
  'filesystem',
  'slack',
  'supabase',
];

const CLIENTS = [
  { href: '/mcp-for-claude-desktop', label: 'Claude', slug: 'claude-desktop' },
  { href: '/mcp-for-cursor', label: 'Cursor', slug: 'cursor' },
  { href: '/mcp-for-windsurf', label: 'Windsurf', slug: 'windsurf' },
  { href: '/clients/vs-code', label: 'VS Code', slug: 'vs-code' },
  { href: '/mcp-for-cline', label: 'Cline', slug: 'cline' },
] as const;

/**
 * Types each job into the placeholder, holds, erases, moves on. Returns the
 * first job (static) under reduced motion or before hydration so SSR and the
 * first client render agree.
 */
function useTypedPlaceholder(jobs: string[], paused: boolean) {
  const [text, setText] = useState(jobs[0]);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setText(jobs[0]);
    let job = 0;
    let chars = jobs[0].length;
    let phase: 'hold' | 'erase' | 'type' = 'hold';
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      let delay: number;
      if (phase === 'hold') {
        phase = 'erase';
        delay = 30;
      } else if (phase === 'erase') {
        chars -= 1;
        delay = 26;
        if (chars <= 1) {
          // Jump straight to the next job's first letter so the placeholder
          // never flashes an empty `Try ""`.
          chars = 1;
          job = (job + 1) % jobs.length;
          phase = 'type';
          delay = 200;
        }
      } else {
        chars += 1;
        delay = 60;
        if (chars >= jobs[job].length) {
          phase = 'hold';
          delay = 2200;
        }
      }
      setText(jobs[job].slice(0, chars));
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 2400);
    return () => clearTimeout(timer);
  }, [jobs, paused]);

  return text;
}

export function HeroSection({ totalCount, featuredSlot }: HeroSectionProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [modKey, setModKey] = useState('Ctrl');
  const typed = useTypedPlaceholder(PLACEHOLDER_JOBS, focused || query !== '');

  useEffect(() => {
    if (
      /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
    ) {
      setModKey('⌘');
    }
  }, []);

  const countLabel =
    typeof totalCount === 'number' && totalCount > 0
      ? totalCount.toLocaleString('en-US')
      : null;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  };

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <AmbientCodeBackground />

      <div className="container home-hero-inner">
        <Link
          href="/what-is-mcp"
          className="home-hero-pill animate-in"
          style={{ '--i': 0 } as React.CSSProperties}
        >
          <span className="home-hero-pill-dot" aria-hidden="true" />
          {countLabel ? (
            <span>
              <strong className="tabular">{countLabel}</strong> MCP servers
              indexed
            </span>
          ) : (
            <span>The MCP server directory</span>
          )}
          <span className="home-hero-pill-sep" aria-hidden="true" />
          <span className="home-hero-pill-link">
            What is MCP? <ArrowRight size={12} aria-hidden="true" />
          </span>
        </Link>

        <h1
          id="home-hero-title"
          className="home-hero-title animate-in"
          style={{ '--i': 1 } as React.CSSProperties}
        >
          Find the MCP server{' '}
          <span className="home-hero-title-accent">your agent needs.</span>
        </h1>

        <p
          className="home-hero-lede animate-in"
          style={{ '--i': 2 } as React.CSSProperties}
        >
          Search by the job you need done, check what a server actually does,
          and install it in one click.
        </p>

        {/* display: contents keeps the <search> landmark as the laid-out box. */}
        <form style={{ display: 'contents' }} onSubmit={onSubmit}>
          <search
            className="home-search animate-in"
            style={{ '--i': 3 } as React.CSSProperties}
            aria-label="Search MCP servers"
          >
            <Search size={20} className="home-search-icon" aria-hidden="true" />
            <label htmlFor="home-search-input" className="sr-only">
              Search MCP servers
            </label>
            <input
              id="home-search-input"
              type="search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={
                focused ? 'Search servers, tools, or jobs…' : `Try “${typed}”`
              }
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            <button
              type="button"
              className="home-search-kbd"
              onClick={openSearch}
              aria-label="Open quick search"
              title="Quick search"
            >
              <kbd className="kbd">{modKey}</kbd>
              <kbd className="kbd">K</kbd>
            </button>
            <button
              type="submit"
              className="btn btn-primary home-search-submit"
            >
              <span className="home-search-submit-label">Search</span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </search>
        </form>

        <div
          className="home-hero-chips animate-in"
          style={{ '--i': 4 } as React.CSSProperties}
        >
          <span className="home-hero-chips-label">Popular</span>
          <div className="home-hero-chip-row">
            {POPULAR_QUERIES.map((q) => (
              <Link
                key={q}
                href={`/browse?q=${encodeURIComponent(q)}`}
                className="chip"
              >
                {q}
              </Link>
            ))}
          </div>
        </div>

        {featuredSlot ? (
          <div
            className="animate-fade"
            style={{ '--i': 5 } as React.CSSProperties}
          >
            {featuredSlot}
          </div>
        ) : null}

        <div
          className="home-clients animate-fade"
          style={{ '--i': 6 } as React.CSSProperties}
        >
          <span className="home-clients-label">Works with</span>
          <ul className="home-clients-list">
            {CLIENTS.map((client) => (
              <li key={client.label}>
                <Link href={client.href} className="home-client">
                  <ClientLogo
                    slug={client.slug}
                    name={client.label}
                    size={22}
                    className="home-client-logo"
                  />
                  {client.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
