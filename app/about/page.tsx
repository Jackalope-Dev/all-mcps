import { type LucideIcon, Rocket, Search, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleLayout } from '@/components/content/ArticleLayout';
import { serializeJsonLd } from '@/lib/jsonLd';
import type { Hue } from '@/lib/palette';

export const metadata: Metadata = {
  title: {
    absolute: 'About AllMCPs - The MCP Server Directory',
  },
  description:
    'Learn about AllMCPs, our mission to index the Model Context Protocol ecosystem, and how we help developers empower AI agents.',
  alternates: {
    canonical: 'https://allmcps.com/about',
  },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/og/default.png',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'About AllMCPs - The MCP Server Directory',
    description:
      'Learn about AllMCPs, our mission to index the Model Context Protocol ecosystem, and how we help developers empower AI agents.',
    url: 'https://allmcps.com/about',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About AllMCPs - The MCP Server Directory',
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
        {
          '@type': 'ListItem',
          position: 2,
          name: 'About',
          item: `${SITE}/about`,
        },
      ],
    },
  ],
};

const FEATURES: Array<{
  Icon: LucideIcon;
  title: string;
  body: string;
  hue: Hue;
}> = [
  {
    Icon: Search,
    hue: 'blue',
    title: 'Discover Tools',
    body: 'Search thousands of curated MCP servers spanning databases, APIs, dev tools, and desktop applications.',
  },
  {
    Icon: Zap,
    hue: 'amber',
    title: '1-Click Install',
    body: 'Copy pre-formatted Claude Desktop and Cursor JSON configs directly into your local setup.',
  },
  {
    Icon: Rocket,
    hue: 'pink',
    title: 'Community Driven',
    body: 'Submit your own open-source MCP servers so developers and AI agents searching the directory can find them.',
  },
];

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(aboutJsonLd) }}
      />
      <ArticleLayout
        path="/about"
        crumbs={[{ label: 'Home', href: '/' }, { label: 'About' }]}
        title={
          <>
            About{' '}
            <span className="wordmark-text">
              <span className="wordmark-all">All</span>
              <span className="wordmark-mcps">MCPs</span>
            </span>
          </>
        }
        lede={
          <p>
            <strong>AllMCPs</strong> is the premier, open directory for
            discovering, evaluating, and installing Model Context Protocol (MCP)
            servers to equip AI agents and LLMs with real-world superpowers.
          </p>
        }
        updatedLabel="Last updated"
        toc={[
          { id: 'what-we-do', text: 'What we do' },
          { id: 'built-by', text: 'Built by Jackalope Digital' },
          { id: 'verification', text: 'How listings are verified and ranked' },
          { id: 'editorial-standards', text: 'Editorial standards' },
          { id: 'contact', text: 'Corrections and contact' },
        ]}
        progress={false}
        footer={
          <section className="content-cta">
            <div>
              <h2 className="content-cta-title">List your MCP server</h2>
              <p className="content-cta-text">
                Built something agents should know about? Submit it, or learn
                the protocol from the ground up.
              </p>
            </div>
            <div className="content-cta-actions">
              <Link href="/submit" className="btn btn-primary btn-md">
                Submit an MCP Server
              </Link>
              <Link href="/what-is-mcp" className="btn btn-ghost btn-md">
                Learn What is an MCP
              </Link>
              <a
                href="https://jackalope.digital"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-md"
              >
                Visit Jackalope Digital →
              </a>
            </div>
          </section>
        }
      >
        <h2 id="what-we-do" className="sr-only">
          What we do
        </h2>
        <ul className="about-features">
          {FEATURES.map(({ Icon, title, body, hue }) => (
            <li key={title} className="about-feature">
              <span
                className={`about-feature-icon hue-${hue}`}
                aria-hidden="true"
              >
                <Icon size={18} />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>

        <h2 id="built-by">Built by Jackalope Digital</h2>
        <p>
          AllMCPs is built and maintained by <strong>Caden Sumner</strong> at{' '}
          <strong>Jackalope Digital</strong>. Our team builds high-performance
          tools, applications, and infrastructure for the modern AI ecosystem.
        </p>

        <h2 id="verification">How listings are verified and ranked</h2>
        <p>
          Every listing on AllMCPs starts from a public source — a GitHub
          repository, npm/PyPI package, or a submission through{' '}
          <a href="/submit">/submit</a>. We don&rsquo;t independently rewrite
          descriptions from scratch; a listing&rsquo;s description and metadata
          are pulled from that source (its README, package manifest, or the
          submitter&rsquo;s own input), so accuracy ultimately traces back to
          the maintainer.
        </p>
        <p>
          A <strong>Verified</strong> badge means the listing is either
          confirmed official (published under an organization we&rsquo;ve
          matched to the underlying vendor, e.g. GitHub&rsquo;s own MCP server)
          or has had ownership proven by its maintainer — via a GitHub README
          badge, a site badge, or a DNS TXT record, through the{' '}
          <a href="/submit">claim flow</a> on each listing page. It is not a
          quality or safety endorsement, and it does not mean AllMCPs has
          audited the server&rsquo;s code.
        </p>
        <p>
          Where possible, listings are cross-checked against a live{' '}
          <code>tools/list</code> protocol handshake and, for a subset of stdio
          servers, an automated install attempt in an isolated sandbox (see{' '}
          <a href="/trust">/trust</a> for current coverage) — these confirm the
          server responds to the protocol, not that every tool it exposes
          behaves correctly.
        </p>
        <p>
          Ranking scores on category, best-of, and search pages are computed
          from real engagement signals (install copies, views, upvotes, GitHub
          stars, npm downloads) plus verified-owner and official status. Payment
          never changes a listing&rsquo;s score or its organic order, and never
          makes it Verified. A <strong>Featured</strong> badge means a listing
          paid for placement (see <a href="/pricing">/pricing</a>): paid
          listings appear in labelled slots (the homepage Featured shelf, a
          Featured row above <a href="/browse">/browse</a> results, and a
          category sponsor&rsquo;s pinned top spot) and always carry that label.
          Ads are marked <strong>Sponsored</strong>.
        </p>
        <p>
          We list any public MCP server that implements the protocol, including
          ones we haven&rsquo;t used ourselves — this is an index, not a curated
          recommendation list, except on <a href="/best">/best</a> pages, which
          are explicitly editorial. Found something wrong on a listing?{' '}
          <a href="/contact">Contact us</a> or use the claim flow to fix it
          directly.
        </p>

        <h2 id="editorial-standards">Editorial standards</h2>
        <p>Each listing page is built from what we can check, in this order:</p>
        <ul>
          <li>
            <strong>Source facts.</strong> Name, description, license, tools,
            install command and environment variables come from the
            project&rsquo;s own repository, package manifest or live server, and
            every listing links back to its source.
          </li>
          <li>
            <strong>Live checks.</strong> Where we can, we connect to the server
            and read its real tool list, re-check remote endpoints on a
            schedule, and record when the repository was last updated. The page
            says when a check last ran and never shows a tool list we
            didn&rsquo;t see.
          </li>
          <li>
            <strong>Our writeup.</strong> The &ldquo;How it works&rdquo;
            overview and FAQ on a listing are written by AllMCPs with AI
            assistance, grounded in the project&rsquo;s README and the data
            above, and are marked as ours on the page. They are refreshed when
            the source changes. When we have not confirmed an install command,
            the page says so instead of guessing one.
          </li>
        </ul>
        <p>
          Not every listing is offered to search engines. A listing is only
          indexed once it has our writeup and a real signal behind it: an
          official or owner-verified publisher, meaningful adoption, or a
          maintained project we have seen run. Thin, duplicate, archived and
          stale listings stay on the site for people who look them up, but are
          marked <code>noindex</code>. Duplicate listings point to the one we
          keep, and listings removed at a maintainer&rsquo;s request are
          redirected or taken down.
        </p>

        <h2 id="contact">Corrections and contact</h2>
        <p>
          Spotted an error, an outdated install command, or a listing that
          should not be here? Email{' '}
          <a href="mailto:contact@allmcps.com">contact@allmcps.com</a>, use the{' '}
          <a href="/contact">contact form</a>, or flag it with &ldquo;Report a
          problem&rdquo; on the listing page. Maintainers can claim their
          listing to edit it directly. We read every report and correct
          confirmed errors.
        </p>
      </ArticleLayout>
    </>
  );
}
