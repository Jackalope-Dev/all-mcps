import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  Box,
  Brain,
  Briefcase,
  CheckSquare,
  Cloud,
  Code2,
  CreditCard,
  Database,
  FileCode2,
  FileText,
  FlaskConical,
  FolderTree,
  Gamepad2,
  GitBranch,
  GitFork,
  Globe,
  HardDrive,
  Layers,
  type LucideIcon,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Microscope,
  MonitorPlay,
  Network,
  Plane,
  Scale,
  Search,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Terminal,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { serializeJsonLd } from '@/lib/jsonLd';
import { PageShell } from '../../components/PageShell';
import {
  BEST_TOPICS,
  bestTopicHue,
  CATEGORY_TOPICS,
  KEYWORD_TOPICS,
} from '../../lib/bestTopics';
import type { Hue } from '../../lib/palette';

const SITE = 'https://allmcps.com';

export const metadata: Metadata = {
  title: 'Best MCP Servers by Use Case',
  description:
    'Curated, ranked guides to the best Model Context Protocol (MCP) servers for databases, developers, web search, security, browser automation, and more.',
  alternates: { canonical: `${SITE}/best` },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Best MCP Servers by Use Case | AllMCPs',
    description:
      'Curated, ranked guides to the best MCP servers for databases, developers, web search, security, browser automation, and more.',
    url: `${SITE}/best`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best MCP Servers by Use Case | AllMCPs',
    description:
      'Curated, ranked guides to the best MCP servers for every use case.',
  },
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  databases: Database,
  'developer-tools': Code2,
  'web-search': Globe,
  security: ShieldCheck,
  'browser-automation': Bot,
  communication: MessageSquare,
  'memory-knowledge': Brain,
  finance: TrendingUp,
  cloud: Cloud,
  'coding-agents': Sparkles,
  monitoring: Activity,
  'file-systems': FolderTree,
  'version-control': GitBranch,
  'workplace-productivity': Briefcase,
  marketing: Megaphone,
  'social-media': Share2,
  'customer-data-platforms': Users,
  'data-platforms': Layers,
  research: Microscope,
  'data-science': FlaskConical,
  'code-execution': Terminal,
  'command-line': Terminal,
  'e-commerce': ShoppingCart,
  legal: Scale,
  multimedia: Video,
  gaming: Gamepad2,
  'location-services': MapPin,
  travel: Plane,
};

const KEYWORD_ICONS: Record<string, LucideIcon> = {
  postgres: Database,
  sqlite: HardDrive,
  mysql: Database,
  mongodb: Layers,
  github: GitBranch,
  gitlab: GitFork,
  docker: Box,
  kubernetes: Network,
  aws: Cloud,
  openapi: FileCode2,
  notion: BookOpen,
  jira: CheckSquare,
  'google-workspace': Mail,
  slack: MessageSquare,
  discord: MessageCircle,
  youtube: Video,
  pdf: FileText,
  stripe: CreditCard,
  playwright: MonitorPlay,
  seo: Search,
};

function TopicTile({
  href,
  Icon,
  hue,
  title,
  lead,
  level = 2,
  compact = false,
}: {
  href: string;
  Icon: LucideIcon;
  hue: Hue;
  title: string;
  lead: string;
  /** Heading level — the category grid is under the page h1, the keyword grid is under its own h2. */
  level?: 2 | 3;
  /** Integration tiles: title only, no lead paragraph. */
  compact?: boolean;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <Link
      href={href}
      className={`dir-topic spotlight tint-card hue-${hue}${compact ? ' dir-topic--compact' : ''}`}
    >
      <span className="dir-topic-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="dir-topic-body">
        <Heading className="dir-topic-title">{title}</Heading>
        {!compact && <span className="dir-topic-lead">{lead}</span>}
      </span>
      <ArrowRight size={15} className="dir-topic-arrow" aria-hidden="true" />
    </Link>
  );
}

export default function BestIndexPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Best MCP Servers by Use Case',
        description:
          'Curated, ranked guides to the best MCP servers for every use case.',
        url: `${SITE}/best`,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: BEST_TOPICS.length,
          itemListElement: BEST_TOPICS.map((t, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `Best MCP Servers for ${t.title}`,
            url: `${SITE}/best/${t.slug}`,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Best MCP Servers',
            item: `${SITE}/best`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <PageShell variant="default">
        <nav aria-label="Breadcrumb">
          <ol className="crumbs">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li aria-current="page">Best MCP servers</li>
          </ol>
        </nav>

        <header className="dir-page-head animate-in">
          <h1 className="text-page-title">Best MCP servers by use case</h1>
          <p className="text-lead">
            Hand-picked, usage-ranked guides to the Model Context Protocol
            servers people reach for most. Every list is drawn live from the
            AllMCPs directory and refreshed hourly.
          </p>
        </header>

        <ul className="dir-topics">
          {CATEGORY_TOPICS.map((t) => (
            <li key={t.slug}>
              <TopicTile
                href={`/best/${t.slug}`}
                Icon={CATEGORY_ICONS[t.slug] || Sparkles}
                hue={bestTopicHue(t)}
                title={`Best for ${t.title}`}
                lead={t.lead}
              />
            </li>
          ))}
        </ul>

        <section className="dir-section" aria-labelledby="by-integration">
          <div className="dir-section-head">
            <h2 id="by-integration" className="dir-section-title">
              By integration &amp; tool
            </h2>
            <p className="dir-section-sub">
              Looking for a specific platform? Jump straight to the best servers
              for the tools and databases people connect most.
            </p>
          </div>
          <ul className="dir-topics dir-topics--compact">
            {KEYWORD_TOPICS.map((t) => (
              <li key={t.slug}>
                <TopicTile
                  href={`/best/${t.slug}`}
                  Icon={KEYWORD_ICONS[t.slug] || Sparkles}
                  hue={bestTopicHue(t)}
                  title={`Best ${t.title} MCP servers`}
                  lead={t.lead}
                  level={3}
                  compact
                />
              </li>
            ))}
          </ul>
        </section>
      </PageShell>
    </>
  );
}
