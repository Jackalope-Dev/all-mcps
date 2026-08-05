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
          <h4 className="footer-heading">Stay in the loop</h4>
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
        </div>
        <div>
          <h4 className="footer-heading">Resources</h4>
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
              <Link href="/pricing" className="nav-link">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/what-is-mcp" className="nav-link">
                What is an MCP?
              </Link>
            </li>
            <li>
              <Link href="/guide" className="nav-link">
                LLM Agents Guide
              </Link>
            </li>
            <li>
              <Link href="/build-mcp-server" className="nav-link">
                Build an MCP Server
              </Link>
            </li>
            <li>
              <Link href="/deploy-mcp-server" className="nav-link">
                Deploy MCP Server
              </Link>
            </li>
            <li>
              <Link href="/mcp-security" className="nav-link">
                MCP Security
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
                href="https://github.com/Jackalope-Dev"
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
