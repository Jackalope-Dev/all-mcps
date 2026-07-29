'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, BookOpen, Sparkles, Layers, Search } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Button } from './ui/Button';

const NAV = [
  { href: '/browse', label: 'Browse' },
  { href: '/categories', label: 'Categories' },
  { href: '/what-is-mcp', label: 'What is an MCP?' },
  { href: '/guides', label: 'Guides' },
  { href: '/tools', label: 'Tools' },
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
            <Button href="/submit" variant="primary" size="sm" className="site-nav-cta">
              Submit MCP
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

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
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
                <Button
                  href="/submit"
                  variant="primary"
                  size="md"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Sparkles size={16} /> Submit MCP Server
                </Button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

