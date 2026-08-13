import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ChevronRight,
  ArrowRight,
  Database,
  Code2,
  Globe,
  ShieldCheck,
  Bot,
  MessageSquare,
  Brain,
  TrendingUp,
  Cloud,
  Sparkles,
  Activity,
  FolderTree,
  GitBranch,
  Briefcase,
  Megaphone,
  Share2,
  Users,
  Layers,
  Microscope,
  FlaskConical,
  Terminal,
  ShoppingCart,
  Scale,
  Video,
  Gamepad2,
  MapPin,
  Plane,
  HardDrive,
  GitFork,
  Box,
  Network,
  FileCode2,
  BookOpen,
  CheckSquare,
  Mail,
  MessageCircle,
  FileText,
  CreditCard,
  MonitorPlay,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { BEST_TOPICS, CATEGORY_TOPICS, KEYWORD_TOPICS } from '../../lib/bestTopics';

const SITE = 'https://allmcps.com';

export const metadata: Metadata = {
  title: 'Best MCP Servers by Use Case',
  description:
    'Curated, ranked guides to the best Model Context Protocol (MCP) servers for databases, developers, web search, security, browser automation, and more.',
  alternates: { canonical: `${SITE}/best` },
  openGraph: {
    images: [{ url: 'https://allmcps.com/opengraph-image', width: 1200, height: 630, alt: 'AllMCPs' }],
    title: 'Best MCP Servers by Use Case | AllMCPs',
    description:
      'Curated, ranked guides to the best MCP servers for databases, developers, web search, security, browser automation, and more.',
    url: `${SITE}/best`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best MCP Servers by Use Case | AllMCPs',
    description: 'Curated, ranked guides to the best MCP servers for every use case.',
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

export default function BestIndexPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Best MCP Servers by Use Case',
        description: 'Curated, ranked guides to the best MCP servers for every use case.',
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
          { '@type': 'ListItem', position: 2, name: 'Best MCP Servers', item: `${SITE}/best` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="page-shell page-shell--default" style={{ paddingBottom: '4rem' }}>
        <div className="page-shell-inner">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb" style={{ marginBottom: '2rem' }}>
              <li><Link href="/">Home</Link></li>
              <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
              <li className="breadcrumb-current">Best MCP Servers</li>
            </ol>
          </nav>

          {/* Hero Header */}
          <section style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 3rem', padding: '0 1rem' }}>
            <h1 className="text-display" style={{ marginBottom: '1rem' }}>
              Best MCP Servers by Use Case
            </h1>
            <p className="text-lead" style={{ margin: '0 auto', maxWidth: '680px' }}>
              Hand-picked, usage-ranked guides to the best Model Context Protocol servers for the jobs
              people reach for most &mdash; each list is drawn live from the AllMCPs directory.
            </p>
          </section>

          {/* Category Topics Grid */}
          <ul className="directory-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {CATEGORY_TOPICS.map((t) => {
              const Icon = CATEGORY_ICONS[t.slug] || Sparkles;
              return (
                <li key={t.slug}>
                  <Link
                    href={`/best/${t.slug}`}
                    className="surface-interactive"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '1.5rem',
                      borderRadius: '14px',
                      textDecoration: 'none',
                      color: 'inherit',
                      border: '1px solid var(--border-color)',
                      height: '100%',
                      transition: 'all var(--transition-normal)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.875rem' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: 'rgba(0, 229, 255, 0.08)',
                          border: '1px solid rgba(0, 229, 255, 0.2)',
                          color: 'var(--accent-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={20} />
                      </div>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                        Best for {t.title}
                      </h2>
                    </div>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        margin: '0 0 1.25rem',
                        lineHeight: 1.55,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        flexGrow: 1,
                      }}
                    >
                      {t.lead}
                    </p>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        color: 'var(--accent-color)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        marginTop: 'auto',
                        paddingTop: '0.5rem',
                      }}
                    >
                      View ranking <ArrowRight size={15} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Integration Topics Section */}
          <section style={{ marginTop: '4.5rem' }}>
            <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 2.5rem', padding: '0 1rem' }}>
              <h2 className="text-display" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', marginBottom: '0.75rem' }}>
                By Integration &amp; Tool
              </h2>
              <p className="text-lead" style={{ margin: '0 auto', maxWidth: '640px', fontSize: '1.05rem' }}>
                Looking for a specific tool? Jump straight to the best MCP servers for the platforms and
                databases people connect most.
              </p>
            </div>
            <ul className="directory-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {KEYWORD_TOPICS.map((t) => {
                const Icon = KEYWORD_ICONS[t.slug] || Sparkles;
                return (
                  <li key={t.slug}>
                    <Link
                      href={`/best/${t.slug}`}
                      className="surface-interactive"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '1.5rem',
                        borderRadius: '14px',
                        textDecoration: 'none',
                        color: 'inherit',
                        border: '1px solid var(--border-color)',
                        height: '100%',
                        transition: 'all var(--transition-normal)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.875rem' }}>
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '10px',
                            background: 'rgba(0, 229, 255, 0.08)',
                            border: '1px solid rgba(0, 229, 255, 0.2)',
                            color: 'var(--accent-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={20} />
                        </div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                          Best {t.title} MCP servers
                        </h3>
                      </div>
                      <p
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                          margin: '0 0 1.25rem',
                          lineHeight: 1.55,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          flexGrow: 1,
                        }}
                      >
                        {t.lead}
                      </p>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          color: 'var(--accent-color)',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          marginTop: 'auto',
                          paddingTop: '0.5rem',
                        }}
                      >
                        View ranking <ArrowRight size={15} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
