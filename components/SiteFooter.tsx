import Link from 'next/link';
import { BrandLogo } from './BrandLogo';
import { NewsletterSignupForm } from './forms/NewsletterSignupForm';
import { BadgeMarquee } from './BadgeMarquee';
import { FooterNavSection } from './FooterNavSection';

/**
 * Site footer — kept to ~5 columns with concise link sets so mobile users
 * don't face a wall of text. Deep guides live under /guides.
 */
export function SiteFooter() {
  return (
    <footer className="container site-footer grid-crosshair grid-crosshair-tl grid-crosshair-tr">
      <div className="newsletter-footer-cta surface-interactive">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="footer-heading" style={{ margin: 0 }}>Stay in the loop</h2>
          </div>
          <p className="site-footer-blurb" style={{ margin: 0 }}>
            Get new MCP servers and top picks in your inbox.
          </p>
        </div>
        <NewsletterSignupForm source="footer" compact />
      </div>
      <div className="site-footer-grid">
        <div className="site-footer-brand">
          <div style={{ marginBottom: '1rem' }}>
            <BrandLogo size="sm" href="/" />
          </div>
          <p className="site-footer-blurb">
            The open directory for discovering and installing Model Context Protocol servers.
          </p>
          <div className="site-footer-social">
            <a
              href="https://x.com/AllMCPs"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link site-footer-social-link"
              aria-label="Follow AllMCPs on X (opens in a new tab)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://github.com/Jackalope-Dev/allmcps-server"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link site-footer-social-link"
              aria-label="AllMCPs on GitHub (opens in a new tab)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            </a>
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            {/* tinystartups · Launched on Tiny Startups (solid) */}
            <a
              href="https://www.tinystartups.com/startup/all-mcps"
              target="_blank"
              rel="noopener noreferrer"
              className="tinystartups-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 24px 16px 20px',
                borderRadius: '14px',
                textDecoration: 'none',
                fontFamily: "'Inter', system-ui, sans-serif",
                background: 'linear-gradient(135deg, #3525E6, #D81FE0, #22B8F0)',
                color: '#fff',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              <svg width="56" height="56" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
                <path
                  d="M50 6C52 32 68 48 94 50C68 52 52 68 50 94C48 68 32 52 6 50C32 48 48 32 50 6Z"
                  fill="#ffffff"
                />
              </svg>
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    fontWeight: 600,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.75)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Launched on
                </span>
                <span
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    letterSpacing: '-0.025em',
                    color: '#fff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Tiny Startups
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.75)',
                    marginTop: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  tinystartups.com
                </span>
              </span>
            </a>
          </div>
        </div>

        <FooterNavSection ariaLabel="Explore" heading="Explore">
          <ul className="site-footer-links">
            <li>
              <Link href="/browse" className="nav-link">
                Browse servers
              </Link>
            </li>
            <li>
              <Link href="/best" className="nav-link">
                Best MCP servers
              </Link>
            </li>
            <li>
              <Link href="/categories" className="nav-link">
                Categories
              </Link>
            </li>
            <li>
              <Link href="/clients" className="nav-link">
                MCP clients
              </Link>
            </li>
            <li>
              <Link href="/prompts" className="nav-link">
                Agent prompts
              </Link>
            </li>
            <li>
              <Link href="/stack" className="nav-link">
                Stack Builder
              </Link>
            </li>
            <li>
              <Link href="/compare" className="nav-link">
                Compare servers
              </Link>
            </li>
            <li>
              <Link href="/lucky" className="nav-link">
                Random discovery <span className="footer-badge footer-badge-new">New</span>
              </Link>
            </li>
            <li>
              <Link href="/submit" className="nav-link">
                Submit a server
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="nav-link">
                Pricing &amp; Boost <span className="footer-badge footer-badge-boost">Boost</span>
              </Link>
            </li>
          </ul>
        </FooterNavSection>

        <FooterNavSection ariaLabel="Learn" heading="Learn">
          <ul className="site-footer-links">
            <li>
              <Link href="/guides" className="nav-link">
                Guides hub
              </Link>
            </li>
            <li>
              <Link href="/what-is-mcp" className="nav-link">
                What is MCP?
              </Link>
            </li>
            <li>
              <Link href="/guide" className="nav-link">
                Install guide
              </Link>
            </li>
            <li>
              <Link href="/build-mcp-server" className="nav-link">
                Build an MCP server
              </Link>
            </li>
            <li>
              <Link href="/deploy-mcp-server" className="nav-link">
                Deploy an MCP server
              </Link>
            </li>
            <li>
              <Link href="/mcp-security" className="nav-link">
                Security guide
              </Link>
            </li>
            <li>
              <Link href="/mcp-troubleshooting" className="nav-link">
                Troubleshooting
              </Link>
            </li>
            <li>
              <Link href="/mcp-for-seo" className="nav-link">
                MCP for SEO &amp; AEO
              </Link>
            </li>
            <li>
              <Link href="/mcp-protocol-versioning" className="nav-link">
                Protocol versioning
              </Link>
            </li>
            <li>
              <Link href="/blog" className="nav-link">
                Blog &amp; updates
              </Link>
            </li>
          </ul>
        </FooterNavSection>

        <FooterNavSection ariaLabel="Free tools" heading="Tools">
          <ul className="site-footer-links">
            <li>
              <Link href="/tools" className="nav-link">
                All developer tools
              </Link>
            </li>
            <li>
              <Link href="/tools/config-generator" className="nav-link">
                Config generator
              </Link>
            </li>
            <li>
              <Link href="/tools/config-validator" className="nav-link">
                Config validator
              </Link>
            </li>
            <li>
              <Link href="/tools/config-auditor" className="nav-link">
                Config auditor
              </Link>
            </li>
            <li>
              <Link href="/tools/playground" className="nav-link">
                MCP playground
              </Link>
            </li>
            <li>
              <Link href="/tools/token-calculator" className="nav-link">
                Token calculator
              </Link>
            </li>
            <li>
              <Link href="/tools/openapi-to-mcp" className="nav-link">
                OpenAPI → MCP
              </Link>
            </li>
            <li>
              <Link href="/badge-generator" className="nav-link">
                Badge generator
              </Link>
            </li>
          </ul>
        </FooterNavSection>

        <FooterNavSection ariaLabel="For AI and agents" heading="For agents">
          <ul className="site-footer-links">
            <li>
              <Link href="/docs/api" className="nav-link">
                REST API docs
              </Link>
            </li>
            <li>
              <Link href="/trust" className="nav-link">
                Trust &amp; traffic <span className="footer-badge footer-badge-live"><span className="footer-badge-dot"></span>Live</span>
              </Link>
            </li>
            <li>
              <a href="/api/mcp" className="nav-link" target="_blank" rel="noopener noreferrer">
                Remote MCP server <span className="footer-badge footer-badge-subtle">SSE</span> <span aria-hidden="true">↗</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a href="/llms.txt" className="nav-link" target="_blank" rel="noopener noreferrer">
                llms.txt <span aria-hidden="true">↗</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a href="/data.json" className="nav-link" target="_blank" rel="noopener noreferrer">
                Catalog JSON <span aria-hidden="true">↗</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </FooterNavSection>

        <FooterNavSection ariaLabel="Company" heading="Company">
          <ul className="site-footer-links">
            <li>
              <Link href="/about" className="nav-link">
                About
              </Link>
            </li>
            <li>
              <Link href="/advertise" className="nav-link">
                Advertise <span className="footer-badge footer-badge-sponsor">Sponsor</span>
              </Link>
            </li>
            <li>
              <Link href="/contact" className="nav-link">
                Contact
              </Link>
            </li>
            <li>
              <a
                href="https://x.com/AllMCPs"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
              >
                X (@AllMCPs) <span aria-hidden="true">↗</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a
                href="https://github.com/Jackalope-Dev/allmcps-server"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
              >
                GitHub <span aria-hidden="true">↗</span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <Link href="/terms" className="nav-link">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="nav-link">
                Privacy
              </Link>
            </li>
          </ul>
        </FooterNavSection>
      </div>
      <BadgeMarquee />
      <div className="site-footer-copy">
        &copy; {new Date().getFullYear()} Jackalope Digital LLC. All rights reserved.
      </div>
    </footer>
  );
}
