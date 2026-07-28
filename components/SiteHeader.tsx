'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from './BrandLogo';
import { Button } from './ui/Button';

const NAV = [
  { href: '/browse', label: 'Browse' },
  { href: '/categories', label: 'Categories' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/browse') {
    return pathname === '/browse' || pathname.startsWith('/mcp/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname() || '/';

  return (
    <header className="site-header">
      <div className="container">
        <div className="site-header-inner">
          <BrandLogo size="md" />
          <nav className="site-nav animate-fade-in delay-1" aria-label="Main Navigation">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link${isActive(pathname, href) ? ' is-active' : ''}`}
                aria-current={isActive(pathname, href) ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
            <Button href="/submit" variant="primary" size="sm" className="site-nav-cta">
              Submit MCP
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
