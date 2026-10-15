'use client';

import {
  ArrowRight,
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchBrowserSession } from '../lib/clientSession';
import { openSearch } from '../lib/openSearch';
import { BrandLogo } from './BrandLogo';
import {
  isGroupActive,
  isNavActive,
  NAV_GROUPS,
  type NavGroup,
  PRIMARY_NAV,
} from './navigation';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function NavMenu({
  group,
  open,
  active,
  onOpen,
  onClose,
}: {
  group: NavGroup;
  open: boolean;
  active: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const panelId = `nav-menu-${group.id}`;
  const closeTimer = useRef<number | undefined>(undefined);

  // Hover intent: open immediately, close after a short grace period so the
  // pointer can travel from the trigger into the panel without it vanishing.
  const enter = () => {
    window.clearTimeout(closeTimer.current);
    onOpen();
  };
  const leave = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(onClose, 140);
  };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <div
      className="nav-menu"
      onPointerEnter={(e) => e.pointerType === 'mouse' && enter()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && leave()}
    >
      <button
        type="button"
        className={`nav-link nav-menu-trigger${active ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? onClose() : onOpen())}
      >
        {group.label}
        <ChevronDown size={14} aria-hidden="true" className="nav-menu-caret" />
      </button>
      {/* Always rendered (hidden via CSS when closed) so the menu's links are
          in the server HTML for crawlers, not only after a click. */}
      <div
        id={panelId}
        className="nav-menu-panel"
        data-open={open || undefined}
      >
        <ul className="nav-menu-grid">
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="nav-menu-item"
                  onClick={onClose}
                >
                  {Icon && (
                    <span
                      className={`nav-menu-icon${item.hue ? ` hue-${item.hue}` : ''}`}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </span>
                  )}
                  <span className="nav-menu-copy">
                    <span className="nav-menu-label">{item.label}</span>
                    {item.description && (
                      <span className="nav-menu-desc">{item.description}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {group.footer && (
          <Link
            href={group.footer.href}
            className="nav-menu-footer"
            onClick={onClose}
          >
            <span>
              <span className="nav-menu-label">{group.footer.label}</span>
              <span className="nav-menu-desc">{group.footer.description}</span>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname() || '/';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  /** Platform-appropriate search shortcut for the header chip (⌘ vs Ctrl). */
  const [searchModKey, setSearchModKey] = useState('Ctrl');
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  // Close only if this group is still the open one: a delayed hover-out
  // close from one menu must not shut a sibling the pointer has moved to.
  const closeGroup = useCallback(
    (id: string) =>
      setOpenGroup((current) => (current === id ? null : current)),
    [],
  );

  // The mobile drawer is portaled to <body>, so it must wait for the client
  // mount before createPortal has a DOM target.
  useEffect(() => {
    setMounted(true);
    try {
      const isApple = /Mac|iPhone|iPad|iPod/i.test(
        navigator.platform || navigator.userAgent,
      );
      setSearchModKey(isApple ? '⌘' : 'Ctrl');
    } catch {
      setSearchModKey('Ctrl');
    }
  }, []);

  // Hairline + denser glass only once the page has scrolled, so the header
  // sits flush with hero sections at the top of the page.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Signed-in state isn't known until this client-side check resolves, so the
  // CTA starts as "Submit" (correct for the common logged-out case) and
  // swaps to "Dashboard" rather than blocking render on a server session check.
  useEffect(() => {
    let cancelled = false;
    fetchBrowserSession().then((data) => {
      if (!cancelled) setIsSignedIn(Boolean(data?.user));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const ctaHref = isSignedIn ? '/dashboard' : '/submit';
  const ctaLabel = isSignedIn ? 'Dashboard' : 'Submit server';
  const loginHref =
    pathname === '/login' || pathname === '/verify-request'
      ? '/login'
      : `/login?callbackUrl=${encodeURIComponent(pathname)}`;
  const logoutHref =
    pathname.startsWith('/dashboard') || pathname.startsWith('/admin')
      ? '/api/auth/signout?callbackUrl=%2F'
      : `/api/auth/signout?callbackUrl=${encodeURIComponent(pathname)}`;

  // Close menus on route change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value read inside.
  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  // Desktop menus: Escape and outside clicks close the open panel.
  useEffect(() => {
    if (!openGroup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null);
    };
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenGroup(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [openGroup]);

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
        drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
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

  // Lock scroll while the mobile sheet is open. Locks <html> and <body>
  // overflow rather than making body position: fixed — the latter breaks
  // .site-header's position: sticky (body becomes the containing block).
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
    <header className="site-header" data-scrolled={scrolled || undefined}>
      <div className="container site-header-inner">
        <BrandLogo size="sm" />

        <nav
          ref={navRef}
          className="site-nav desktop-only-nav"
          aria-label="Main"
        >
          {PRIMARY_NAV.map(({ href, label }) => {
            const active = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`nav-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
          {NAV_GROUPS.map((group) => (
            <NavMenu
              key={group.id}
              group={group}
              open={openGroup === group.id}
              active={isGroupActive(pathname, group)}
              onOpen={() => setOpenGroup(group.id)}
              onClose={() => closeGroup(group.id)}
            />
          ))}
        </nav>

        <div className="site-header-actions">
          <button
            type="button"
            onClick={openSearch}
            className="header-search"
            aria-label={`Search MCP servers (${searchModKey}+K)`}
          >
            <Search size={15} aria-hidden="true" />
            <span className="header-search-label">Search servers…</span>
            <span className="header-search-keys" aria-hidden="true">
              <kbd className="kbd">{searchModKey === '⌘' ? '⌘' : 'Ctrl'}</kbd>
              <kbd className="kbd">K</kbd>
            </span>
          </button>
          {isSignedIn ? (
            <a
              href={logoutHref}
              className="btn btn-ghost btn-sm header-auth"
              title="Log out"
            >
              <LogOut size={14} aria-hidden="true" />
              <span className="header-auth-label">Log out</span>
            </a>
          ) : (
            <Link href={loginHref} className="btn btn-ghost btn-sm header-auth">
              <LogIn size={14} aria-hidden="true" />
              <span className="header-auth-label">Log in</span>
            </Link>
          )}
          <Link href={ctaHref} className="btn btn-primary btn-sm header-cta">
            {!isSignedIn && <Plus size={14} aria-hidden="true" />}
            {ctaLabel}
          </Link>

          {/* Mobile: search is one tap, not buried in the sheet. */}
          <button
            type="button"
            className="header-icon-btn mobile-only"
            onClick={openSearch}
            aria-label="Search MCP servers"
          >
            <Search size={19} aria-hidden="true" />
          </button>
          <button
            ref={menuButtonRef}
            type="button"
            className="header-icon-btn mobile-only"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={
              mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
          >
            {mobileMenuOpen ? (
              <X size={20} aria-hidden="true" />
            ) : (
              <Menu size={20} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile sheet — portaled to <body> so the header's backdrop-filter
          (which creates a containing block for fixed descendants) doesn't
          collapse the overlay to the header's height. */}
      {mounted &&
        mobileMenuOpen &&
        createPortal(
          <div className="mobile-sheet-overlay">
            {/* Backdrop: a click outside the drawer closes it. The drawer
                (positioned, later in the DOM) paints above this button. */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close navigation"
              onClick={() => closeMobileMenu()}
              style={{
                position: 'absolute',
                inset: 0,
                margin: 0,
                padding: 0,
                border: 0,
                background: 'transparent',
                cursor: 'default',
              }}
            />
            <div
              ref={drawerRef}
              className="mobile-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
            >
              <div className="mobile-sheet-head">
                <BrandLogo size="sm" />
                <button
                  type="button"
                  className="header-icon-btn"
                  onClick={closeMobileMenu}
                  aria-label="Close navigation menu"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <nav
                id="mobile-navigation"
                className="mobile-sheet-body"
                aria-label="Mobile"
              >
                <button
                  type="button"
                  className="mobile-sheet-search"
                  onClick={() => {
                    closeMobileMenu();
                    openSearch();
                  }}
                >
                  <Search size={16} aria-hidden="true" />
                  Search MCP servers…
                </button>
                <ul className="mobile-sheet-primary">
                  {PRIMARY_NAV.map(({ href, label }) => {
                    const active = isNavActive(pathname, href);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className={`mobile-sheet-link${active ? ' is-active' : ''}`}
                          aria-current={active ? 'page' : undefined}
                          onClick={closeMobileMenu}
                        >
                          {label}
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {NAV_GROUPS.map((group) => (
                  <section key={group.id} className="mobile-sheet-group">
                    <h2 className="mobile-sheet-heading">{group.label}</h2>
                    <ul className="mobile-sheet-grid">
                      {[
                        ...group.items,
                        ...(group.footer ? [group.footer] : []),
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={`mobile-sheet-item${item.hue ? ` hue-${item.hue}` : ''}`}
                              onClick={closeMobileMenu}
                            >
                              {Icon && <Icon size={16} aria-hidden="true" />}
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </nav>
              <div className="mobile-sheet-foot">
                {isSignedIn ? (
                  <a
                    href={logoutHref}
                    className="btn btn-secondary btn-md"
                    onClick={closeMobileMenu}
                  >
                    <LogOut size={16} aria-hidden="true" /> Log out
                  </a>
                ) : (
                  <Link
                    href={loginHref}
                    className="btn btn-secondary btn-md"
                    onClick={closeMobileMenu}
                  >
                    <LogIn size={16} aria-hidden="true" /> Log in
                  </Link>
                )}
                <Link
                  href={ctaHref}
                  className="btn btn-primary btn-md"
                  onClick={closeMobileMenu}
                >
                  {ctaLabel}
                </Link>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}
