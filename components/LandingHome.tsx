import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Brain,
  Check,
  Cloud,
  Code2,
  Database,
  FileText,
  Globe,
  MessageSquare,
  Search,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import type { Hue } from '../lib/palette';
import type { SiteStats } from '../lib/siteStats';
import { CopyCommand, HomeStats } from './HomeStats';
import { JackalopeCallout } from './JackalopeCallout';
import { FaqSection } from './ui/FaqSection';
import { OutboundLink } from './ui/OutboundLink';
import { ServerAvatar } from './ui/ServerAvatar';

const INTENTS = [
  {
    label: 'Query databases',
    hue: 'violet' as Hue,
    icon: Database,
    href: '/browse?category=databases&q=postgres+mysql+sqlite+database',
    hint: 'Postgres, SQLite, MySQL, Supabase, Neon',
  },
  {
    label: 'Scrape & search the web',
    hue: 'teal' as Hue,
    icon: Globe,
    href: '/browse?category=search-and-data-extraction&q=browser+scrape+search+playwright',
    hint: 'Playwright, Brave, Puppeteer, Firecrawl',
  },
  {
    label: 'Git, GitHub & PR review',
    hue: 'blue' as Hue,
    icon: Code2,
    href: '/browse?category=version-control&q=github+git+gitlab+repository',
    hint: 'GitHub, GitLab, Linear, code review',
  },
  {
    label: 'Memory, vectors & RAG',
    hue: 'amber' as Hue,
    icon: Brain,
    href: '/browse?category=knowledge-and-memory&q=memory+vector+embeddings+knowledge',
    hint: 'Vector DBs, long-term memory, Obsidian',
  },
  {
    label: 'Cloud & infrastructure',
    hue: 'indigo' as Hue,
    icon: Cloud,
    href: '/browse?category=cloud-platforms&q=aws+kubernetes+docker+cloudflare',
    hint: 'AWS, Kubernetes, Cloudflare, Docker',
  },
  {
    label: 'Run code & terminals',
    hue: 'orange' as Hue,
    icon: Terminal,
    href: '/browse?category=code-execution',
    hint: 'Python sandboxes, shell runners, Docker exec',
  },
  {
    label: 'Docs, PDFs & office files',
    hue: 'pink' as Hue,
    icon: FileText,
    href: '/browse?category=developer-tools&q=pdf+markdown+document+excel+word',
    hint: 'PDF parsing, Notion, Excel, Google Docs',
  },
  {
    label: 'Security & secrets',
    hue: 'red' as Hue,
    icon: ShieldCheck,
    href: '/browse?category=security',
    hint: 'Vulnerability scans, secret audits, CVEs',
  },
  {
    label: 'Chat, email & alerts',
    hue: 'green' as Hue,
    icon: MessageSquare,
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
    a: 'Search by the job, not the repo name. Filter on /browse by category, client, and tested-working status. Compare two listings when you need a side-by-side.',
  },
  {
    q: 'What does verified mean?',
    a: 'The owner claimed the listing, or it is a paid listing. Many also have live health checks. It is a signal, not a guarantee. Read the listing before you install.',
  },
  {
    q: 'How do I list my server?',
    a: 'Submit at /submit, or POST to the catalog API at /api/v1/submit, which also makes it easy to have your coding agent file the listing for you.',
  },
];

export function LandingIntents() {
  return (
    <section className="section home-intents" aria-labelledby="home-intents">
      <div className="container">
        <div className="section-head">
          <h2 id="home-intents" className="section-title">
            What do you need your agent to do?
          </h2>
          <p className="section-sub">
            Start from the task. Each shelf opens a filtered view of the catalog
            with install configs ready to paste.
          </p>
        </div>
        <ul className="home-intent-grid reveal-stagger">
          {INTENTS.map((intent, i) => {
            const Icon = intent.icon;
            return (
              <li
                key={intent.label}
                style={{ '--i': i } as React.CSSProperties}
              >
                <Link
                  href={intent.href}
                  className={`home-intent spotlight tint-card hue-${intent.hue}`}
                >
                  <span className="home-intent-icon tint-tile">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="home-intent-copy">
                    <span className="home-intent-label">{intent.label}</span>
                    <span className="home-intent-hint">{intent.hint}</span>
                  </span>
                  <ArrowRight
                    size={16}
                    className="home-intent-arrow"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="home-intents-foot">
          <Link href="/categories" className="link-arrow">
            All categories <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── How it works ────────────────────────────────────────────────────── */

function FindVisual() {
  return (
    <div className="home-viz" aria-hidden="true">
      <div className="home-viz-search">
        <Search size={13} />
        <span className="home-viz-typed">query postgres</span>
      </div>
      <ul className="home-viz-results">
        {[
          ['Postgres MCP', 'Databases', 'w-80'],
          ['Supabase', 'Databases', 'w-65'],
          ['Neon', 'Databases', 'w-50'],
        ].map(([name, cat, w], i) => (
          <li
            key={name}
            className="home-viz-row"
            style={{ '--i': i } as React.CSSProperties}
          >
            <span className="home-viz-avatar">{name[0]}</span>
            <span className="home-viz-row-text">
              <span className="home-viz-row-name">{name}</span>
              <span className={`home-viz-bar ${w}`} />
            </span>
            <span className="home-viz-tag">{cat}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InspectVisual() {
  return (
    <div className="home-viz" aria-hidden="true">
      <div className="home-viz-title">
        <span>tools/list</span>
        <span className="home-viz-ok">
          <span className="home-viz-ok-dot" /> healthy
        </span>
      </div>
      <ul className="home-viz-tools">
        {['query', 'list_tables', 'describe_table', 'explain_plan'].map(
          (tool, i) => (
            <li key={tool} style={{ '--i': i } as React.CSSProperties}>
              <Check size={12} />
              <code>{tool}</code>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function InstallVisual() {
  return (
    <div className="home-viz" aria-hidden="true">
      <div className="home-viz-tabs">
        <span className="is-active">Cursor</span>
        <span>Claude</span>
        <span>VS Code</span>
      </div>
      <pre className="home-viz-code">
        {
          '{\n  "mcpServers": {\n    "postgres": {\n      "command": "npx",\n      "args": ["-y", "…"]\n    }\n  }\n}'
        }
      </pre>
      <span className="home-viz-installed">
        <Check size={12} /> Added to Cursor
      </span>
    </div>
  );
}

const STEPS = [
  {
    n: '01',
    hue: 'blue' as Hue,
    title: 'Find',
    body: 'Search by the job, not the repo name. Filter by category, client, and transport.',
    href: '/browse',
    cta: 'Browse servers',
    Visual: FindVisual,
  },
  {
    n: '02',
    hue: 'violet' as Hue,
    title: 'Inspect',
    body: 'See the tools a server exposes, its health, and security signals before you trust it.',
    href: '/tools/protocol-inspector',
    cta: 'Protocol inspector',
    Visual: InspectVisual,
  },
  {
    n: '03',
    hue: 'green' as Hue,
    title: 'Install',
    body: 'One click into Cursor, Claude, Windsurf, or VS Code. Or bundle several into one stack.',
    href: '/stack',
    cta: 'Stack builder',
    Visual: InstallVisual,
  },
] as const;

export function LandingHowItWorks() {
  return (
    <section className="section home-how" aria-labelledby="home-how">
      <div className="container">
        <div className="section-head section-head--center">
          <h2 id="home-how" className="section-title">
            From search to installed in three steps
          </h2>
        </div>
        <ol className="home-steps reveal-stagger">
          {STEPS.map(({ n, hue, title, body, href, cta, Visual }, i) => (
            <li
              key={n}
              className={`home-step hue-${hue}`}
              style={{ '--i': i * 2 } as React.CSSProperties}
            >
              <Visual />
              <div className="home-step-copy">
                <span className="home-step-n">{n}</span>
                <h3 className="home-step-title">{title}</h3>
                <p className="home-step-body">{body}</p>
                <Link href={href} className="link-arrow">
                  {cta} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ol>
        <p className="home-how-more">
          Also: <Link href="/compare">compare servers side by side</Link>,{' '}
          <Link href="/tools/config-validator">validate a config</Link>, or{' '}
          <Link href="/clients">set up your client</Link>.
        </p>
      </div>
    </section>
  );
}

/* ── Trust / proof ───────────────────────────────────────────────────── */

export function LandingTrust({
  stats,
  totalCount,
}: {
  stats?: SiteStats;
  totalCount: number;
}) {
  return (
    <section className="section home-trust" aria-labelledby="home-trust">
      <div className="container">
        <div className="section-head section-head--split">
          <div className="home-head-stack">
            <h2 id="home-trust" className="section-title">
              Built in the open, read by agents
            </h2>
            <p className="section-sub">
              Every listing is public, exportable, and searchable by the AI
              assistants you already use.
            </p>
          </div>
          <Link href="/trust" className="link-arrow">
            Live trust dashboard <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <HomeStats stats={stats} fallbackServers={totalCount} />

        <div className="home-trust-cards">
          <div className="home-promo">
            <div className="home-promo-head">
              <ServerAvatar
                name="AllMCPs Server"
                logoUrl="/logos/allmcps-server"
                size={40}
              />
              <div>
                <h3 className="home-promo-title">
                  AllMCPs, inside your agent
                  <span className="home-promo-badge">
                    <BadgeCheck size={12} aria-hidden="true" /> Official
                  </span>
                </h3>
                <p className="home-promo-body">
                  Search, compare, and install listings from Claude, Cursor, or
                  any MCP client with our own MCP server.
                </p>
              </div>
            </div>
            <CopyCommand command="npx -y allmcps-server" />
            <div className="home-promo-actions">
              <Link href="/mcp/allmcps-server" className="link-arrow">
                View listing <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <OutboundLink
                href="https://github.com/Jackalope-Dev/allmcps-server"
                destinationType="github"
                serverId="allmcps-server"
                target="_blank"
                rel="noopener noreferrer"
                className="home-promo-gh"
              >
                GitHub <ArrowUpRight size={13} aria-hidden="true" />
              </OutboundLink>
            </div>
          </div>
          <JackalopeCallout />
        </div>
      </div>
    </section>
  );
}

/* ── FAQ + final CTA ─────────────────────────────────────────────────── */

export function LandingFaq() {
  return (
    <section className="section home-faq" aria-labelledby="home-faq">
      <div className="container home-faq-inner">
        <div className="home-head-stack">
          <h2 id="home-faq" className="section-title">
            Questions, answered
          </h2>
          <p className="section-sub">
            New to MCP? Start with <Link href="/what-is-mcp">what MCP is</Link>{' '}
            or the <Link href="/guides">install guides</Link>.
          </p>
        </div>
        <FaqSection
          items={FAQ_ITEMS}
          defaultOpenIndex={0}
          renderJsonLd={false}
        />
      </div>
    </section>
  );
}

export function LandingCta({ totalCount }: { totalCount?: number }) {
  const catalogLabel =
    typeof totalCount === 'number' && totalCount > 0
      ? `${totalCount.toLocaleString('en-US')} servers`
      : 'Thousands of servers';

  return (
    <section className="home-cta" aria-labelledby="home-cta">
      <div className="container">
        <div className="home-cta-card reveal">
          <h2 id="home-cta" className="home-cta-title">
            Give your agent superpowers.
          </h2>
          <p className="home-cta-lede">
            {catalogLabel}, ready to install. Or list your own in minutes.
          </p>
          <div className="home-cta-actions">
            <Link href="/browse" className="btn btn-primary btn-lg">
              Browse MCP servers <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/submit" className="btn btn-secondary btn-lg">
              Submit a server
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
