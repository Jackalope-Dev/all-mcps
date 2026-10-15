import { BookOpen, Compass, LayoutGrid, Search, Trophy } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';

const QUICK_LINKS = [
  { href: '/browse', label: 'Browse servers', icon: Compass },
  { href: '/categories', label: 'Categories', icon: LayoutGrid },
  { href: '/best', label: 'Best of', icon: Trophy },
  { href: '/guides', label: 'Guides', icon: BookOpen },
] as const;

/**
 * Shared layout for 404 / error screens: a calm centered block with a code
 * label, heading, actions, a catalog search box, and quick links so a dead
 * end is never actually a dead end.
 */
export function StatusScreen({
  code,
  title,
  titleAs: Title = 'h1',
  description,
  actions,
  showSearch = true,
}: {
  code: string;
  title: string;
  titleAs?: 'h1' | 'h2';
  description: React.ReactNode;
  actions?: React.ReactNode;
  showSearch?: boolean;
}) {
  return (
    <main className="acct-status">
      <div className="acct-status-inner">
        <p className="acct-status-code animate-in" aria-hidden="true">
          {code}
        </p>
        <Title
          className="acct-status-title animate-in"
          style={{ '--i': 1 } as React.CSSProperties}
        >
          {title}
        </Title>
        <p
          className="acct-status-desc animate-in"
          style={{ '--i': 2 } as React.CSSProperties}
        >
          {description}
        </p>

        {showSearch ? (
          // display: contents keeps the <search> landmark as the laid-out box.
          <form action="/browse" method="get" style={{ display: 'contents' }}>
            <search
              className="acct-status-search animate-in"
              style={{ '--i': 3 } as React.CSSProperties}
            >
              <Search size={17} aria-hidden="true" />
              <label htmlFor="status-search" className="sr-only">
                Search MCP servers
              </label>
              <input
                id="status-search"
                name="q"
                type="search"
                placeholder="Search MCP servers by name or use case…"
                autoComplete="off"
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Search
              </button>
            </search>
          </form>
        ) : null}

        {actions ? (
          <div
            className="acct-status-actions animate-in"
            style={{ '--i': 3 } as React.CSSProperties}
          >
            {actions}
          </div>
        ) : null}

        <nav
          aria-label="Popular pages"
          className="acct-status-links animate-in"
          style={{ '--i': 4 } as React.CSSProperties}
        >
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="chip">
              <Icon size={14} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
