import { Metadata } from 'next';
import { Search, Zap, Rocket } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { PageShell, PageHeader } from '../../components/PageShell';

export const metadata: Metadata = {
  title: {
    absolute: 'About AllMCPs — The MCP Server Directory',
  },
  description:
    'Learn about AllMCPs, our mission to index the Model Context Protocol ecosystem, and how we help developers empower AI agents.',
  alternates: {
    canonical: 'https://allmcps.com/about',
  },
  openGraph: {
    images: [{ url: 'https://allmcps.com/opengraph-image', width: 1200, height: 630, alt: 'AllMCPs' }],
    title: 'About AllMCPs — The MCP Server Directory',
    description:
      'Learn about AllMCPs, our mission to index the Model Context Protocol ecosystem, and how we help developers empower AI agents.',
    url: 'https://allmcps.com/about',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About AllMCPs — The MCP Server Directory',
    description:
      'Learn about AllMCPs, our mission to index the Model Context Protocol ecosystem, and how we help developers empower AI agents.',
  },
};

const SITE = 'https://allmcps.com';
const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'AboutPage',
      name: 'About AllMCPs',
      description:
        'AllMCPs is an open directory for discovering, evaluating, and installing Model Context Protocol (MCP) servers for AI agents and LLMs.',
      url: `${SITE}/about`,
      isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
      about: {
        '@type': 'Organization',
        name: 'AllMCPs',
        url: SITE,
        logo: `${SITE}/logo-icon.svg`,
        parentOrganization: {
          '@type': 'Organization',
          name: 'Jackalope Digital',
          url: 'https://jackalope.digital',
        },
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'About', item: `${SITE}/about` },
      ],
    },
  ],
};

export default function AboutPage() {
  return (
    <PageShell variant="content" panel className="animate-fade-in">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }} />
      <PageHeader
        title={
          <>
            About{' '}
            <span className="wordmark-text">
              <span className="wordmark-all">All</span>
              <span className="wordmark-mcps">MCPs</span>
            </span>
          </>
        }
        description={
          <>
            <strong>AllMCPs</strong> is the premier, open directory for discovering, evaluating, and
            installing Model Context Protocol (MCP) servers to equip AI agents and LLMs with
            real-world superpowers.
          </>
        }
      />

      <div className="feature-grid">
        <div className="surface-muted feature-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', borderRadius: '10px', background: 'rgba(var(--accent-rgb), 0.1)', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
              <Search size={18} style={{ color: 'var(--accent-color)' }} />
            </div>
            <h2 style={{ margin: 0 }}>Discover Tools</h2>
          </div>
          <p>
            Search hundreds of curated MCP servers spanning databases, APIs, dev tools, and desktop
            applications.
          </p>
        </div>
        <div className="surface-muted feature-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', borderRadius: '10px', background: 'rgba(var(--accent-rgb), 0.1)', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
              <Zap size={18} style={{ color: 'var(--accent-color)' }} />
            </div>
            <h2 style={{ margin: 0 }}>1-Click Install</h2>
          </div>
          <p>
            Copy pre-formatted Claude Desktop and Cursor JSON configs directly into your local setup.
          </p>
        </div>
        <div className="surface-muted feature-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', borderRadius: '10px', background: 'rgba(var(--accent-rgb), 0.1)', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
              <Rocket size={18} style={{ color: 'var(--accent-color)' }} />
            </div>
            <h2 style={{ margin: 0 }}>Community Driven</h2>
          </div>
          <p>
            Submit your own open-source MCP servers to reach thousands of AI developers and users.
          </p>
        </div>
      </div>

      <h2 className="text-section">Built by Jackalope Digital</h2>
      <p style={{ lineHeight: 1.8, marginBottom: '2rem' }}>
        AllMCPs is built and maintained by <strong>Caden Sumner</strong> at <strong>Jackalope Digital</strong>.
        Our team builds high-performance tools, applications, and infrastructure for the modern AI
        ecosystem.
      </p>

      <h2 className="text-section">How listings are verified and ranked</h2>
      <div style={{ lineHeight: 1.8, marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ margin: 0 }}>
          Every listing on AllMCPs starts from a public source — a GitHub repository, npm/PyPI
          package, or a submission through <a href="/submit">/submit</a>. We don&rsquo;t independently
          rewrite descriptions from scratch; a listing&rsquo;s description and metadata are pulled from
          that source (its README, package manifest, or the submitter&rsquo;s own input), so accuracy
          ultimately traces back to the maintainer.
        </p>
        <p style={{ margin: 0 }}>
          A <strong>Verified</strong> badge means the listing is either confirmed official (published
          under an organization we&rsquo;ve matched to the underlying vendor, e.g. GitHub&rsquo;s own MCP
          server) or has had ownership proven by its maintainer — via a GitHub README badge, a site
          badge, or a DNS TXT record, through the <a href="/submit">claim flow</a> on each listing
          page. It is not a quality or safety endorsement, and it does not mean AllMCPs has audited
          the server&rsquo;s code.
        </p>
        <p style={{ margin: 0 }}>
          Where possible, listings are cross-checked against a live <code style={{ fontSize: '0.85em' }}>tools/list</code> protocol
          handshake and, for a subset of stdio servers, an automated install attempt in an isolated
          sandbox (see <a href="/trust">/trust</a> for current coverage) — these confirm the server
          responds to the protocol, not that every tool it exposes behaves correctly.
        </p>
        <p style={{ margin: 0 }}>
          Rankings on category, best-of, and search pages are driven by real engagement signals
          (installs, views, upvotes) plus official/verified status — never by payment. A{' '}
          <strong>Featured</strong> or <strong>Sponsored</strong> badge means a listing paid for
          placement (see <a href="/pricing">/pricing</a>); it is labeled as such and shown separately
          from the ranked results it appears alongside, not blended in as an organic signal.
        </p>
        <p style={{ margin: 0 }}>
          We list any public MCP server that implements the protocol, including ones we haven&rsquo;t
          used ourselves — this is an index, not a curated recommendation list, except on{' '}
          <a href="/best">/best</a> pages, which are explicitly editorial. Found something wrong on a
          listing? <a href="/contact">Contact us</a> or use the claim flow to fix it directly.
        </p>
      </div>

      <div className="form-actions" style={{ borderTop: '1px solid var(--border-color)' }}>
        <Button href="/submit" variant="primary">
          Submit an MCP Server
        </Button>
        <Button href="/what-is-mcp" variant="secondary">
          Learn What is an MCP
        </Button>
        <a
          href="https://jackalope.digital"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-md"
        >
          Visit Jackalope Digital →
        </a>
      </div>
    </PageShell>
  );
}
