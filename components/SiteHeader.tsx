'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, BookOpen, Sparkles, Layers, Search } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Button } from './ui/Button';

const NAV = [
  { href: '/browse', label: 'Browse' },
  { href: '/best', label: 'Best' },
  { href: '/categories', label: 'Categories' },
  { href: '/tools', label: 'Tools' },
  { href: '/guides', label: 'Guides' },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/browse') {
    return pathname === '/browse' || pathname.startsWith('/mcp/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname() || '/';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  // The mobile drawer is portaled to <body>, so it must wait for the client
  // mount before createPortal has a DOM target.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Signed-in state isn't known until this client-side check resolves, so the
  // CTA starts as "Submit MCP" (correct for the common logged-out case) and
  // swaps to "Manage" rather than blocking render on a server session check.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = res.ok ? ((await res.json()) as { user?: unknown }) : null;
        if (!cancelled) setIsSignedIn(Boolean(data?.user));
      } catch {
        // Network error — leave the logged-out default in place.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ctaHref = isSignedIn ? '/dashboard' : '/submit';
  const ctaLabel = isSignedIn ? 'Manage' : 'Submit MCP';
  const mobileCtaLabel = isSignedIn ? 'Manage Your Listings' : 'Submit MCP Server';
  const loginHref = `/login?callbackUrl=${encodeURIComponent(pathname)}`;

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <header className="site-header">
      <div className="container">
        <div className="site-header-inner">
          <BrandLogo size="md" />

          {/* Desktop Navigation */}
          <nav className="site-nav desktop-only-nav animate-fade-in delay-1" aria-label="Main Navigation">
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
            <button
              type="button"
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="header-search-btn"
              title="Search directory (Cmd+K)"
            >
              <Search size={13} className="text-cyan-400" />
              <span>Search</span>
              <kbd className="header-search-kbd">⌘K</kbd>
            </button>
            {!isSignedIn && (
              <Link href={loginHref} className="nav-link">
                Log in
              </Link>
            )}
            <Button href={ctaHref} variant="primary" size="sm" className="site-nav-cta">
              {ctaLabel}
            </Button>
          </nav>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay — portaled to <body> so it isn't trapped by the
          header's backdrop-filter, which establishes a containing block for
          position: fixed descendants and would otherwise collapse the overlay
          to the header's height (making the menu appear to do nothing). */}
      {mounted && mobileMenuOpen && createPortal(
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu-drawer" onClick={(e) => e.stopPropagation()}>
            <nav className="mobile-nav-list" aria-label="Mobile Navigation">
              {NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`mobile-nav-link${isActive(pathname, href) ? ' is-active' : ''}`}
                  aria-current={isActive(pathname, href) ? 'page' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
                }}
                className="mobile-nav-link"
                style={{ width: '100%', justifyContent: 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <Search size={18} className="text-cyan-400" />
                <span>Search Directory</span>
              </button>
              <Link
                href="/build-mcp-server"
                className={`mobile-nav-link${isActive(pathname, '/build-mcp-server') ? ' is-active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Build an MCP Server
              </Link>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {!isSignedIn && (
                  <Link
                    href={loginHref}
                    className="mobile-nav-link"
                    style={{ marginBottom: '0.5rem' }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Log in
                  </Link>
                )}
                <Button
                  href={ctaHref}
                  variant="primary"
                  size="md"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Sparkles size={16} /> {mobileCtaLabel}
                </Button>
              </div>
            </nav>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}

