import Link from 'next/link';
import { BrandLogo } from './BrandLogo';
import { NewsletterSignupForm } from './forms/NewsletterSignupForm';
import { BadgeMarquee } from './BadgeMarquee';

export function SiteFooter() {
  return (
    <footer className="container site-footer">
      <hr className="brand-divider" />
      <div className="newsletter-footer-cta">
        <div>
          <h2 className="footer-heading">Stay in the loop</h2>
          <p className="site-footer-blurb" style={{ margin: 0 }}>
            Get new MCP servers and top picks in your inbox.
          </p>
        </div>
        <NewsletterSignupForm source="footer" compact />
      </div>
      <div className="site-footer-grid">
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <BrandLogo size="sm" href="/" />
          </div>
          <p className="site-footer-blurb">
            The definitive directory for discovering and installing Model Context Protocol servers.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <a href="https://x.com/AllMCPs" target="_blank" rel="noopener noreferrer" className="nav-link" aria-label="Follow AllMCPs on X (opens in a new tab)" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://github.com/Jackalope-Dev/allmcps-server" target="_blank" rel="noopener noreferrer" className="nav-link" aria-label="AllMCPs on GitHub (opens in a new tab)" style={{ display: 'inline-flex', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
            </a>
          </div>
        </div>
        <nav aria-label="Resources">
          <h2 className="footer-heading">Resources</h2>
          <ul className="site-footer-links">
            <li>
              <Link href="/best" className="nav-link">
                Best MCP Servers
              </Link>
            </li>
            <li>
              <Link href="/categories" className="nav-link">
                Browse Categories
              </Link>
            </li>
            <li>
              <Link href="/guides" className="nav-link">
                Guides Hub
              </Link>
            </li>
            <li>
              <Link href="/blog" className="nav-link">
                Blog
              </Link>
            </li>
            <li>
              <a href="/blog/rss.xml" className="nav-link">
                Blog RSS
              </a>
            </li>
            <li>
              <Link href="/pricing" className="nav-link">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/what-is-mcp" className="nav-link">
                What is MCP?
              </Link>
            </li>
            <li>
              <Link href="/guide" className="nav-link">
                Install MCP Guide
              </Link>
            </li>
            <li>
              <Link href="/build-mcp-server" className="nav-link">
                Build an MCP Server
              </Link>
            </li>
            <li>
              <Link href="/mcp-security" className="nav-link">
                MCP Security
              </Link>
            </li>
            <li>
              <Link href="/deploy-mcp-server" className="nav-link">
                Deploy Remote MCP
              </Link>
            </li>
            <li>
              <Link href="/mcp-troubleshooting" className="nav-link">
                MCP Troubleshooting
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="footer-heading">Popular hubs</h4>
          <ul className="site-footer-links">
            <li>
              <Link href="/best/databases" className="nav-link">
                Best for Databases
              </Link>
            </li>
            <li>
              <Link href="/best/developer-tools" className="nav-link">
                Best for Developers
              </Link>
            </li>
            <li>
              <Link href="/best/web-search" className="nav-link">
                Best for Web Search
              </Link>
            </li>
            <li>
              <Link href="/best/security" className="nav-link">
                Best for Security
              </Link>
            </li>
            <li>
              <Link href="/best/browser-automation" className="nav-link">
                Best for Browser Automation
              </Link>
            </li>
            <li>
              <Link href="/categories/databases" className="nav-link">
                Databases category
              </Link>
            </li>
            <li>
              <Link href="/categories/developer-tools" className="nav-link">
                Developer Tools category
              </Link>
            </li>
            <li>
              <Link href="/mcp-for-cursor" className="nav-link">
                MCP for Cursor
              </Link>
            </li>
            <li>
              <Link href="/mcp-for-claude-desktop" className="nav-link">
                MCP for Claude Desktop
              </Link>
            </li>
            <li>
              <Link href="/clients" className="nav-link">
                All MCP clients
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="footer-heading">Free Tools</h4>
          <ul className="site-footer-links">
            <li>
              <Link href="/tools" className="nav-link">
                All tools
              </Link>
            </li>
            <li>
              <Link href="/tools/config-generator" className="nav-link">
                Config Generator
              </Link>
            </li>
            <li>
              <Link href="/tools/config-validator" className="nav-link">
                Config Validator
              </Link>
            </li>
            <li>
              <Link href="/tools/token-calculator" className="nav-link">
                Token Cost Calculator
              </Link>
            </li>
            <li>
              <Link href="/tools/openapi-to-mcp" className="nav-link">
                OpenAPI → MCP
              </Link>
            </li>
            <li>
              <Link href="/tools/protocol-inspector" className="nav-link">
                Protocol Inspector
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="footer-heading">For AI &amp; Agents</h4>
          <ul className="site-footer-links">
            <li>
              <Link href="/docs/api" className="nav-link">
                API Documentation
              </Link>
            </li>
            <li>
              <Link href="/trust" className="nav-link">
                Trust &amp; Traffic Transparency
              </Link>
            </li>
            <li>
              <a href="/llms.txt" className="nav-link" target="_blank" rel="noopener">
                llms.txt Standard ↗
              </a>
            </li>
            <li>
              <a href="/api/mcp" className="nav-link" target="_blank" rel="noopener">
                Remote MCP Server ↗
              </a>
            </li>
            <li>
              <a href="/api/v1/search" className="nav-link" target="_blank" rel="noopener">
                Agent Search API ↗
              </a>
            </li>
            <li>
              <a href="/data.json" className="nav-link" target="_blank" rel="noopener">
                Catalog Dataset (JSON) ↗
              </a>
            </li>
            <li>
              <a
                href="https://www.npmjs.com/package/allmcps-server"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
              >
                Submit via npx (allmcps-server) ↗
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="footer-heading">Company</h4>
          <ul className="site-footer-links">
            <li>
              <Link href="/about" className="nav-link">
                About
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
                X (@AllMCPs) ↗
              </a>
            </li>
            <li>
              <a
                href="https://github.com/Jackalope-Dev/allmcps-server"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
              >
                GitHub ↗
              </a>
            </li>
            <li>
              <a
                href="https://jackalope.digital"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
              >
                Jackalope Digital ↗
              </a>
            </li>
            <li>
              <Link href="/terms" className="nav-link">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="nav-link">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <BadgeMarquee />
      <div className="site-footer-copy">
        &copy; {new Date().getFullYear()} Jackalope Digital LLC. All rights reserved.
      </div>
    </footer>
  );
}
