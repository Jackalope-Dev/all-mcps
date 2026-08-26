import React from 'react';
import Link from 'next/link';
import {
  Database,
  Globe,
  Code2,
  Brain,
  Cloud,
  FileText,
  Terminal,
  ShieldCheck,
  MessageSquare,
  ArrowRight,
  BadgeCheck,
  Zap,
} from 'lucide-react';
import { SectionKicker } from './ui/SectionKicker';
import { FaqSection } from './ui/FaqSection';
import { Reveal } from './ui/Reveal';
import { ServerAvatar } from './ui/ServerAvatar';
import { OutboundLink } from './ui/OutboundLink';
import { NewsletterSignupForm } from './forms/NewsletterSignupForm';

const INTENTS = [
  {
    label: 'Query SQL & Databases',
    icon: Database,
    colorVar: 'var(--intent-database, #00e5ff)',
    href: '/browse?category=databases&q=postgres+mysql+sqlite+database',
    hint: 'Postgres, SQLite, MySQL, Supabase, Neon',
  },
  {
    label: 'Scrape & Search the Web',
    icon: Globe,
    colorVar: 'var(--intent-search, #38bdf8)',
    href: '/browse?category=search-and-data-extraction&q=browser+scrape+search+playwright',
    hint: 'Playwright, Brave, Puppeteer, Firecrawl',
  },
  {
    label: 'Git, GitHub & PR Review',
    icon: Code2,
    colorVar: 'var(--intent-git, #c084fc)',
    href: '/browse?category=version-control&q=github+git+gitlab+repository',
    hint: 'GitHub, GitLab, Linear, PR review',
  },
  {
    label: 'Memory, Vectors & RAG',
    icon: Brain,
    colorVar: 'var(--intent-memory, #f472b6)',
    href: '/browse?category=knowledge-and-memory&q=memory+vector+embeddings+knowledge',
    hint: 'Vector DBs, long-term memory, Obsidian',
  },
  {
    label: 'Cloud & Infrastructure',
    icon: Cloud,
    colorVar: 'var(--intent-cloud, #818cf8)',
    href: '/browse?category=cloud-platforms&q=aws+kubernetes+docker+cloudflare',
    hint: 'AWS, Kubernetes, Cloudflare, Docker',
  },
  {
    label: 'Terminal & Code Execution',
    icon: Terminal,
    colorVar: 'var(--intent-terminal, #34d399)',
    href: '/browse?category=code-execution',
    hint: 'Python sandbox, bash runner, Docker exec',
  },
  {
    label: 'Documents, PDFs & Office',
    icon: FileText,
    colorVar: 'var(--intent-docs, #fbbf24)',
    href: '/browse?category=developer-tools&q=pdf+markdown+document+excel+word',
    hint: 'PDF parser, Notion, Excel, Google Docs',
  },
  {
    label: 'Security & Secret Auditing',
    icon: ShieldCheck,
    colorVar: 'var(--intent-security, #fb7185)',
    href: '/browse?category=security',
    hint: 'Vulnerability scan, secrets audit, CVEs',
  },
  {
    label: 'Team Chat, Email & Alerts',
    icon: MessageSquare,
    colorVar: 'var(--intent-comm, #38bdf8)',
    href: '/browse?category=communication&q=slack+discord+telegram+email+gmail',
    hint: 'Slack, Discord, Telegram, Gmail, Resend',
  },
] as const;

const FAQ_ITEMS = [
  {
    q: 'What is an MCP server?',
    a: 'A Model Context Protocol server gives an AI agent a tool: query a database, open a browser, read a repo. AllMCPs is the directory of those servers, with install configs for Claude, Cursor, and other clients.',
  },
  {
    q: 'How do I install a server?',
    a: 'Open a listing and use one-click install for Cursor, Claude Desktop, Windsurf, or Cline. Or copy the JSON. For several servers at once, use the stack builder.',
  },
  {
    q: 'How do I find the right MCP server?',
    a: 'Search by the job, not the repo name. Filter on /browse by category, client, and verified status. Compare two listings when you need a side-by-side.',
  },
  {
    q: 'What does verified mean?',
    a: 'The owner claimed the listing, or it is a paid listing. Many also have live health checks. It is a signal, not a guarantee. Read the listing before you install.',
  },
  {
    q: 'How do I list my server?',
    a: 'Submit at /submit, or POST to the catalog API. You can also copy the prompt from the Publish tab and let your coding agent file it.',
  },
];

export function LandingIntents() {
  return (
    <Reveal as="section" className="container landing-intents" style={{ marginBottom: '3.5rem' }}>
      <SectionKicker label="Browse by goal" />
      <h2 className="landing-section-title" style={{ marginBottom: '0.5rem' }}>What do you need done?</h2>
      <p className="landing-section-sublead" style={{ maxWidth: '640px', margin: '0 auto 2rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
        Jump straight to verified tools with ready-to-paste configurations for your agents.
      </p>
      <div className="landing-intent-grid">
        {INTENTS.map((intent) => {
          const Icon = intent.icon;
          return (
            <Link
              key={intent.label}
              href={intent.href}
              className="landing-intent-card surface-interactive"
              style={{
                '--intent-color': intent.colorVar,
              } as React.CSSProperties}
            >
              <span className="landing-intent-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="landing-intent-copy">
                <span className="landing-intent-label">{intent.label}</span>
                <span className="landing-intent-hint">{intent.hint}</span>
              </span>
              <ArrowRight size={16} className="landing-intent-arrow" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </Reveal>
  );
}

export function LandingFaq() {
  return (
    <Reveal as="section" className="container landing-faq">
      <h2 className="landing-section-title">FAQ</h2>
      <FaqSection items={FAQ_ITEMS} defaultOpenIndex={0} renderJsonLd={false} />
    </Reveal>
  );
}

export function LandingCta({ totalCount }: { totalCount?: number }) {
  const catalogLabel =
    typeof totalCount === 'number' && totalCount > 0
      ? `${totalCount.toLocaleString('en-US')} servers`
      : 'the full catalog';

  return (
    <Reveal as="section" className="landing-final-cta">
      <div className="container landing-final-cta-inner grid-crosshair grid-crosshair-tl grid-crosshair-br">
        <h2 className="landing-final-title">Find an MCP server</h2>
        <p className="landing-final-lede">
          {catalogLabel} in the directory. Or submit yours.
        </p>
        <div className="landing-final-actions">
          <Link href="/browse" className="btn btn-primary">
            Browse MCP servers <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/submit" className="btn btn-secondary">
            Submit a server
          </Link>
        </div>
      </div>
    </Reveal>
  );
}

export function LandingMcpPromo() {
  return (
    <section className="container mcp-promo-section" style={{ margin: '1.5rem auto 2.5rem' }}>
      <div className="mcp-promo-card">
        <ServerAvatar name="AllMCPs Server" logoUrl="/logos/allmcps-server" size={44} />
        <div className="mcp-promo-content">
          <h2 className="mcp-promo-title">
            AllMCPs MCP server
            <span className="mcp-promo-official-badge">
              <BadgeCheck size={13} aria-hidden="true" /> Official
            </span>
          </h2>
          <p className="mcp-promo-desc">
            Search, install, and submit listings from Claude, Cursor, or any MCP client.
          </p>
        </div>
        <div className="mcp-promo-actions">
          <code className="mcp-promo-install">
            <Zap size={12} aria-hidden="true" /> npx -y allmcps-server
          </code>
          <div className="mcp-promo-buttons">
            <Link href="/mcp/allmcps-server" className="btn btn-primary btn-sm">
              View listing <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <OutboundLink
              href="https://github.com/Jackalope-Dev/allmcps-server"
              destinationType="github"
              serverId="allmcps-server"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              GitHub
            </OutboundLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingNewsletter() {
  return (
    <section className="container newsletter-homepage-section">
      <div>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem' }}>New MCP servers, weekly</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          New and notable listings in your inbox.
        </p>
      </div>
      <NewsletterSignupForm source="homepage" compact />
    </section>
  );
}
