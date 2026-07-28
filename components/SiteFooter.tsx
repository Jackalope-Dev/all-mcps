import Link from 'next/link';
import { BrandLogo } from './BrandLogo';

export function SiteFooter() {
  return (
    <footer className="container site-footer">
      <hr className="brand-divider" />
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
          </ul>
        </div>
        <div>
          <h4 className="footer-heading">For AI &amp; Agents</h4>
          <ul className="site-footer-links">
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
      <div className="site-footer-copy">
        &copy; {new Date().getFullYear()} Jackalope Digital LLC. All rights reserved.
      </div>
    </footer>
  );
}
