import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Cable,
  Check,
  Cpu,
  GitBranch,
  Key,
  type LucideIcon,
  Search,
  Server,
  ShieldCheck,
  Terminal,
  Wrench,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type React from 'react';
import {
  GUIDE_TOPICS,
  GUIDES,
  type GuideEntry,
  type GuideIcon,
  guideTopicHue,
} from '@/components/content/guideCatalog';
import { TopicFilter } from '@/components/content/TopicFilter';
import { serializeJsonLd } from '@/lib/jsonLd';

export const metadata: Metadata = {
  title: 'Model Context Protocol Guides & Tutorials',
  description:
    'MCP guides: what MCP is, install and setup, build and deploy servers, security, and troubleshooting connection failures, zero tools, and timeouts.',
  alternates: {
    canonical: 'https://allmcps.com/guides',
  },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Model Context Protocol Guides & Tutorials | AllMCPs',
    description:
      'MCP guides: what MCP is, install and setup, build and deploy servers, security, and troubleshooting connection failures, zero tools, and timeouts.',
    url: 'https://allmcps.com/guides',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Model Context Protocol Guides & Tutorials | AllMCPs',
    description:
      'MCP guides: what MCP is, install and setup, build and deploy servers, security, and troubleshooting connection failures, zero tools, and timeouts.',
  },
};

const ICONS: Record<GuideIcon, LucideIcon> = {
  book: BookOpen,
  terminal: Terminal,
  cable: Cable,
  branch: GitBranch,
  cpu: Cpu,
  server: Server,
  key: Key,
  shield: ShieldCheck,
  wrench: Wrench,
  search: Search,
  chart: BarChart3,
};

const topicLabel = (id: GuideEntry['topic']) =>
  GUIDE_TOPICS.find((t) => t.id === id)?.label ?? id;

/** Long-tail posts that rank for support queries — linked under the pillar grid. */
const troubleshootingDeepDives = [
  {
    href: '/blog/mcp-server-not-connecting-troubleshooting-guide',
    title: 'MCP Server Not Connecting?',
    description:
      'Seven common failure modes with exact error text and fixes for Claude Desktop, Claude Code, Cursor, and more.',
  },
  {
    href: '/blog/testing-and-debugging-mcp-servers',
    title: 'Testing & Debugging MCP Servers',
    description:
      'Inspector, unit tests, integration harnesses, structured logging, and a pre-publish checklist for authors.',
  },
  {
    href: '/blog/how-to-install-mcp-servers-in-claude-cursor-windsurf-and-vs-code',
    title: 'Install MCP Across Clients',
    description:
      'Clean install paths for Claude, Cursor, Windsurf, and VS Code before you debug a bad config.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'AllMCPs Guides & Tutorials',
  description: 'Comprehensive guides for Model Context Protocol (MCP)',
  itemListElement: GUIDES.map((g, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: g.title,
    url: `https://allmcps.com${g.href}`,
  })),
};

function GuideCard({ guide, index }: { guide: GuideEntry; index: number }) {
  const Icon = ICONS[guide.icon];
  return (
    <li
      data-topic={guide.topic}
      className="guides-item animate-in"
      style={{ '--i': index } as React.CSSProperties}
    >
      <Link
        href={guide.href}
        className={`guides-card spotlight hue-${guideTopicHue(guide.topic)}`}
      >
        <span className="guides-card-top">
          <span className="guides-card-icon" aria-hidden="true">
            <Icon size={18} />
          </span>
          <span className="guides-card-topic">{topicLabel(guide.topic)}</span>
          <span className="guides-card-time tabular">
            {guide.readMinutes} min
          </span>
        </span>
        <h2 className="guides-card-title">{guide.title}</h2>
        <p className="guides-card-desc">{guide.description}</p>
        <span className="guides-card-cta">
          Read guide <ArrowRight size={14} aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

export default function GuidesLandingPage() {
  const [featured, ...rest] = GUIDES;
  const FeaturedIcon = ICONS[featured.icon];
  const topics = GUIDE_TOPICS.map((t) => ({
    ...t,
    count: rest.filter((g) => g.topic === t.id).length,
  })).filter((t) => t.count > 0);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <main className="page-shell content-page content-hub">
        <div className="page-shell-inner">
          <header className="content-hub-head animate-in">
            <h1 className="content-hub-title">Model Context Protocol Guides</h1>
            <p className="content-hub-lede">
              Master MCP from the ground up: understand the protocol, connect
              your favorite AI client, build production-ready servers, or fix
              connection failures when something breaks.
            </p>
          </header>

          <section
            aria-label="Start here"
            className="guides-featured animate-in"
            style={{ '--i': 1 } as React.CSSProperties}
          >
            <div className="guides-featured-main">
              <p className="guides-featured-kicker">
                <FeaturedIcon
                  size={16}
                  aria-hidden="true"
                  className={`tint-text hue-${guideTopicHue(featured.topic)}`}
                />{' '}
                Start here · {featured.level} · {featured.readMinutes} min read
              </p>
              <h2 className="guides-featured-title">
                <Link href={featured.href}>{featured.title}</Link>
              </h2>
              <p className="guides-featured-desc">{featured.description}</p>
              <Link href={featured.href} className="btn btn-primary btn-md">
                Read the guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="guides-featured-side">
              <p className="guides-featured-side-label">You&rsquo;ll learn</p>
              <ul className="guides-featured-list">
                {featured.highlights.map((h) => (
                  <li key={h}>
                    <Check size={15} aria-hidden="true" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section aria-labelledby="all-guides" className="guides-all">
            <h2 id="all-guides" className="content-section-title">
              All guides
            </h2>
            <TopicFilter
              topics={topics}
              total={rest.length}
              label="Filter guides by topic"
            >
              <ul className="guides-grid">
                {rest.map((g, i) => (
                  <GuideCard key={g.href} guide={g} index={i} />
                ))}
              </ul>
            </TopicFilter>
          </section>

          <section aria-labelledby="deep-dives" className="guides-deep">
            <h2 id="deep-dives" className="content-section-title">
              Troubleshooting deep dives
            </h2>
            <p className="guides-deep-lede">
              Start with the{' '}
              <Link href="/mcp-troubleshooting">MCP troubleshooting hub</Link>{' '}
              for a symptom map, then dig into these focused write-ups when you
              need more detail.
            </p>
            <ul className="content-related">
              {troubleshootingDeepDives.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="content-related-card">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="content-cta">
            <div>
              <h2 className="content-cta-title">
                Ready to test these guides with real servers?
              </h2>
              <p className="content-cta-text">
                Explore thousands of open-source and official MCP servers listed
                on AllMCPs, or use our free configuration generator tool.
              </p>
            </div>
            <div className="content-cta-actions">
              <Link href="/browse" className="btn btn-primary btn-md">
                Browse servers
              </Link>
              <Link href="/submit" className="btn btn-ghost btn-md">
                Submit your MCP
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
