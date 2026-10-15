import Link from 'next/link';
import { BadgeMarquee } from './BadgeMarquee';
import { BrandLogo } from './BrandLogo';
import { FooterNavSection } from './FooterNavSection';
import { NewsletterSignupForm } from './forms/NewsletterSignupForm';

interface FooterLink {
  href: string;
  label: string;
  tag?: string;
  /** Opens in a new tab (raw files, external sites). */
  external?: boolean;
}

const COLUMNS: { heading: string; ariaLabel: string; links: FooterLink[] }[] = [
  {
    heading: 'Discover',
    ariaLabel: 'Discover',
    links: [
      { href: '/browse', label: 'Browse servers' },
      { href: '/best', label: 'Best MCP servers' },
      { href: '/categories', label: 'Categories' },
      { href: '/tags', label: 'Tags' },
      { href: '/clients', label: 'MCP clients' },
      { href: '/prompts', label: 'Agent prompts' },
      { href: '/stack', label: 'Stack builder' },
      { href: '/compare', label: 'Compare servers' },
      { href: '/lucky', label: 'Random discovery', tag: 'New' },
    ],
  },
  {
    heading: 'Learn',
    ariaLabel: 'Learn',
    links: [
      { href: '/guides', label: 'Guides hub' },
      { href: '/what-is-mcp', label: 'What is MCP?' },
      { href: '/guide', label: 'Install guide' },
      { href: '/build-mcp-server', label: 'Build an MCP server' },
      { href: '/deploy-mcp-server', label: 'Deploy an MCP server' },
      { href: '/mcp-security', label: 'Security guide' },
      { href: '/mcp-troubleshooting', label: 'Troubleshooting' },
      { href: '/mcp-transports', label: 'Transports: stdio vs HTTP' },
      { href: '/mcp-protocol-versioning', label: 'Protocol versioning' },
      { href: '/mcp-for-seo', label: 'MCP for SEO & AEO' },
      { href: '/state-of-mcp', label: 'State of MCP' },
      { href: '/blog', label: 'Blog' },
    ],
  },
  {
    heading: 'Developers',
    ariaLabel: 'Developer tools and API',
    links: [
      { href: '/tools', label: 'All developer tools' },
      { href: '/tools/config-generator', label: 'Config generator' },
      { href: '/tools/config-validator', label: 'Config validator' },
      { href: '/tools/config-auditor', label: 'Config auditor' },
      { href: '/tools/playground', label: 'MCP playground' },
      { href: '/tools/token-calculator', label: 'Token calculator' },
      { href: '/tools/openapi-to-mcp', label: 'OpenAPI → MCP' },
      { href: '/badge-generator', label: 'Badge generator' },
      { href: '/docs/api', label: 'REST API docs' },
      { href: '/api/mcp', label: 'Remote MCP server', external: true },
      { href: '/llms.txt', label: 'llms.txt', external: true },
      { href: '/data.json', label: 'Catalog JSON', external: true },
    ],
  },
  {
    heading: 'Company',
    ariaLabel: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/submit', label: 'Submit a server' },
      { href: '/pricing', label: 'Pricing & Boost' },
      { href: '/advertise', label: 'Advertise', tag: 'Sponsor' },
      { href: '/trust', label: 'Trust & traffic' },
      { href: '/contact', label: 'Contact' },
      {
        href: 'https://github.com/Jackalope-Dev/allmcps-server',
        label: 'GitHub',
        external: true,
      },
    ],
  },
];

function FooterLinkItem({ link }: { link: FooterLink }) {
  const content = (
    <>
      {link.label}
      {link.tag && <span className="footer-tag">{link.tag}</span>}
    </>
  );
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer">
        {content}
        <span aria-hidden="true">↗</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return <Link href={link.href}>{content}</Link>;
}

/**
 * Site footer: newsletter band, brand + four link columns (accordions on
 * mobile via FooterNavSection), the reciprocal "featured on" badges, and a
 * legal/status bar.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer-v2">
      <div className="container">
        <div className="footer-cta">
          <div>
            <h2 className="footer-cta-title">New MCP servers, weekly.</h2>
            <p className="footer-cta-sub">
              The best new listings and install tips. One email, no noise.
            </p>
          </div>
          <NewsletterSignupForm source="footer" compact />
        </div>

        <div className="footer-main">
          <div className="footer-brand">
            <BrandLogo size="sm" href="/" />
            <p className="footer-brand-blurb">
              The open directory for discovering, comparing, and installing
              Model Context Protocol servers.
            </p>
            <div className="footer-social">
              <a
                href="https://github.com/Jackalope-Dev/allmcps-server"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="sr-only">
                  AllMCPs on GitHub (opens in a new tab)
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <FooterNavSection
              key={col.heading}
              ariaLabel={col.ariaLabel}
              heading={col.heading}
            >
              <ul className="site-footer-links">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <FooterLinkItem link={link} />
                  </li>
                ))}
              </ul>
            </FooterNavSection>
          ))}
        </div>

        <BadgeMarquee />

        <div className="footer-bottom">
          <span>
            &copy; {new Date().getFullYear()} Jackalope Digital LLC. All rights
            reserved.
          </span>
          <nav className="footer-bottom-links" aria-label="Legal">
            <a
              href="https://app.lopebase.com/status/all-mcps"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-status"
            >
              System status
            </a>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
