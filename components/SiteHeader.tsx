'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Sparkles, Search, LogIn, LogOut } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Button } from './ui/Button';

const NAV = [
  { href: '/browse', label: 'Browse' },
  { href: '/best', label: 'Best' },
  { href: '/categories', label: 'Categories' },
  { href: '/stack', label: 'Stack' },
  { href: '/compare', label: 'Compare' },
  { href: '/tools', label: 'Tools' },
  { href: '/guides', label: 'Guides' },
  { href: '/blog', label: 'Blog' },
] as const;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  /** Platform-appropriate search shortcut for the header chip (⌘ vs Ctrl). */
  const [searchModKey, setSearchModKey] = useState('Ctrl');
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  // The mobile drawer is portaled to <body>, so it must wait for the client
  // mount before createPortal has a DOM target.
  useEffect(() => {
    setMounted(true);
    try {
      const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
      setSearchModKey(isApple ? '⌘' : 'Ctrl');
    } catch {
      setSearchModKey('Ctrl');
    }
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
  const loginHref =
    pathname === '/login' || pathname === '/verify-request'
      ? '/login'
      : `/login?callbackUrl=${encodeURIComponent(pathname)}`;
  const logoutHref =
    pathname.startsWith('/dashboard') || pathname.startsWith('/admin')
      ? '/api/auth/signout?callbackUrl=%2F'
      : `/api/auth/signout?callbackUrl=${encodeURIComponent(pathname)}`;

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Focus trap + Escape while the drawer is open; restore focus on close.
  useEffect(() => {
    if (!mobileMenuOpen) return;

    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) || menuButtonRef.current;

    // Defer so the portal has painted before we move focus.
    const focusTimer = window.setTimeout(() => {
      const drawer = drawerRef.current;
      if (!drawer) return;
      const first = drawer.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMobileMenu();
        return;
      }
      if (e.key !== 'Tab') return;

      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !drawer.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !drawer.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      // Restore focus to the menu button (or prior focus) after close.
      const restore = previouslyFocusedRef.current || menuButtonRef.current;
      restore?.focus?.();
    };
  }, [mobileMenuOpen, closeMobileMenu]);

  // Lock scroll when mobile menu is open. `overflow: hidden` on <body> looks
  // like the obvious approach, but it silently breaks .site-header's
  // `position: sticky` — toggling body's overflow makes it a new scroll
  // container, so the sticky header's containing block switches away from
  // the viewport and it stops tracking scroll, jumping off-screen by
  // exactly the current scrollY (visible as the header "scrolling away" and
  // leaving a gap above the menu). Freezing body at its current scroll
  // offset via `position: fixed` locks scroll without touching overflow, so
  // sticky positioning keeps working normally.
  useEffect(() => {
    if (mobileMenuOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [mobileMenuOpen]);

  return (
    <header className="site-header" role="banner">
      <div className="container grid-crosshair grid-crosshair-bl grid-crosshair-br">
        <div className="site-header-inner">
          <div className="flex items-center">
            <BrandLogo size="md" />
          </div>

          {/* Desktop Navigation */}
          <nav className="site-nav desktop-only-nav animate-fade-in delay-1" aria-label="Main">
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
              onClick={() =>
                window.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true })
                )
              }
              className="header-search-btn"
              title={`Search directory (${searchModKey}+K)`}
              aria-label={`Search directory (${searchModKey}+K)`}
            >
              <Search size={13} className="text-cyan-400" aria-hidden="true" />
              <span className="header-search-label">Search</span>
              <kbd className="header-search-kbd" aria-hidden="true">
                {searchModKey === '⌘' ? '⌘K' : 'Ctrl+K'}
              </kbd>
            </button>
            {isSignedIn ? (
              <div className="site-nav-manage-group">
                <Button href={ctaHref} variant="primary" size="sm" className="site-nav-cta">
                  <Sparkles size={13} aria-hidden="true" /> {ctaLabel}
                </Button>
                <a
                  href={logoutHref}
                  className="header-search-btn site-nav-logout"
                  title="Log out"
                  aria-label="Log out"
                >
                  <LogOut size={13} aria-hidden="true" />
                </a>
              </div>
            ) : (
              <div className="site-nav-auth-group">
                <Button href={loginHref} variant="secondary" size="sm" className="site-nav-login">
                  <LogIn size={13} aria-hidden="true" /> Log in
                </Button>
                <Button href={ctaHref} variant="primary" size="sm" className="site-nav-cta">
                  <Sparkles size={13} aria-hidden="true" /> {ctaLabel}
                </Button>
              </div>
            )}
          </nav>

          {/* Mobile Menu Toggle Button */}
          <button
            ref={menuButtonRef}
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay — portaled to <body> so it isn't trapped by the
          header's backdrop-filter, which establishes a containing block for
          position: fixed descendants and would otherwise collapse the overlay
          to the header's height (making the menu appear to do nothing). */}
      {mounted && mobileMenuOpen && createPortal(
        <div
          className="mobile-menu-overlay"
          onClick={closeMobileMenu}
          role="presentation"
        >
          <div
            ref={drawerRef}
            className="mobile-menu-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
          >
            <nav id="mobile-navigation" className="mobile-nav-list" aria-label="Mobile">
              {NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`mobile-nav-link${isActive(pathname, href) ? ' is-active' : ''}`}
                  aria-current={isActive(pathname, href) ? 'page' : undefined}
                  onClick={closeMobileMenu}
                >
                  {label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
                }}
                className="mobile-nav-link"
                style={{ width: '100%', justifyContent: 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                aria-label="Search directory"
              >
                <Search size={18} className="text-cyan-400" aria-hidden="true" />
                <span>Search Directory</span>
              </button>
              <Link
                href="/build-mcp-server"
                className={`mobile-nav-link${isActive(pathname, '/build-mcp-server') ? ' is-active' : ''}`}
                onClick={closeMobileMenu}
              >
                Build an MCP Server
              </Link>
              <div className="mobile-nav-cta-block">
                {!isSignedIn && (
                  <Button
                    href={loginHref}
                    variant="secondary"
                    size="md"
                    className="mobile-nav-cta-btn"
                    onClick={closeMobileMenu}
                  >
                    <LogIn size={16} aria-hidden="true" /> Log in
                  </Button>
                )}
                <Button
                  href={ctaHref}
                  variant="primary"
                  size="md"
                  className="mobile-nav-cta-btn"
                  onClick={closeMobileMenu}
                >
                  <Sparkles size={16} aria-hidden="true" /> {mobileCtaLabel}
                </Button>
                {isSignedIn && (
                  <Button
                    href={logoutHref}
                    variant="secondary"
                    size="md"
                    className="mobile-nav-cta-btn"
                    onClick={closeMobileMenu}
                  >
                    <LogOut size={16} aria-hidden="true" /> Log out
                  </Button>
                )}
              </div>
            </nav>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}

