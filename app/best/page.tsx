import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  Box,
  Brain,
  Briefcase,
  CheckSquare,
  ChevronRight,
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
import { PageHeader, PageShell } from '../../components/PageShell';
import { Card } from '../../components/ui/Card';
import {
  BEST_TOPICS,
  CATEGORY_TOPICS,
  KEYWORD_TOPICS,
} from '../../lib/bestTopics';

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
  title,
  lead,
  level = 2,
}: {
  href: string;
  Icon: LucideIcon;
  title: string;
  lead: string;
  /** Heading level — the category grid is under the page h1, the keyword grid is under its own h2. */
  level?: 2 | 3;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <Card href={href} hoverable padding="md" className="topic-tile">
      <div className="topic-tile-header">
        <div className="topic-tile-icon">
          <Icon size={20} />
        </div>
        <Heading className="topic-tile-title">{title}</Heading>
      </div>
      <p className="topic-tile-lead">{lead}</p>
      <span className="topic-tile-link">
        View ranking <ArrowRight size={15} />
      </span>
    </Card>
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
          <ol className="breadcrumb" style={{ marginBottom: '2rem' }}>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li className="breadcrumb-current">Best MCP Servers</li>
          </ol>
        </nav>

        <PageHeader
          centered
          title="Best MCP Servers by Use Case"
          description="Hand-picked, usage-ranked guides to the best Model Context Protocol servers for the jobs people reach for most — each list is drawn live from the AllMCPs directory."
        />

        {/* Category Topics Grid */}
        <ul
          className="directory-grid"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {CATEGORY_TOPICS.map((t) => (
            <li key={t.slug}>
              <TopicTile
                href={`/best/${t.slug}`}
                Icon={CATEGORY_ICONS[t.slug] || Sparkles}
                title={`Best for ${t.title}`}
                lead={t.lead}
              />
            </li>
          ))}
        </ul>

        {/* Integration Topics Section */}
        <section style={{ marginTop: '4.5rem' }}>
          <div
            style={{
              textAlign: 'center',
              maxWidth: '780px',
              margin: '0 auto 2.5rem',
              padding: '0 1rem',
            }}
          >
            <h2
              className="text-display"
              style={{
                fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
                marginBottom: '0.75rem',
              }}
            >
              By Integration &amp; Tool
            </h2>
            <p
              className="text-lead"
              style={{
                margin: '0 auto',
                maxWidth: '640px',
                fontSize: '1.05rem',
              }}
            >
              Looking for a specific tool? Jump straight to the best MCP servers
              for the platforms and databases people connect most.
            </p>
          </div>
          <ul
            className="directory-grid"
            style={{ listStyle: 'none', margin: 0, padding: 0 }}
          >
            {KEYWORD_TOPICS.map((t) => (
              <li key={t.slug}>
                <TopicTile
                  href={`/best/${t.slug}`}
                  Icon={KEYWORD_ICONS[t.slug] || Sparkles}
                  title={`Best ${t.title} MCP servers`}
                  lead={t.lead}
                  level={3}
                />
              </li>
            ))}
          </ul>
        </section>
      </PageShell>
    </>
  );
}
