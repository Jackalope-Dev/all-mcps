import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { CompareSelector } from '@/components/CompareSelector';
import { PageHeader, PageShell } from '@/components/PageShell';
import { comparePath, INDEXABLE_COMPARE_PAIRS } from '@/lib/comparePairs';
import { toPickServer } from '@/lib/comparePick';
import { getNewestActiveServers } from '@/lib/servers';

export const metadata: Metadata = {
  title: 'Compare MCP Servers Side-by-Side',
  description:
    'Compare Model Context Protocol (MCP) servers side-by-side. Evaluate feature matrices, tools, GitHub stars, authentication models, and install configurations.',
  alternates: {
    canonical: 'https://allmcps.com/compare',
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
    title: 'Compare MCP Servers Side-by-Side | AllMCPs',
    description:
      'Compare Model Context Protocol (MCP) servers side-by-side. Evaluate feature matrices, tools, GitHub stars, authentication models, and install configurations.',
    url: 'https://allmcps.com/compare',
  },
};

const FEATURED_PAIRS = [
  {
    href: '/mcp/crystaldba-postgres-mcp/vs/jparkerweb-mcp-sqlite',
    label: 'Postgres MCP vs. SQLite MCP',
    blurb: 'Compare relational database tools',
  },
  {
    href: '/mcp/github-github-mcp-server/vs/jmrplens-gitlab-mcp-server',
    label: 'GitHub MCP vs. GitLab MCP',
    blurb: 'Compare Git platform tools & APIs',
  },
  {
    href: '/mcp/automatalabs-mcp-server-playwright/vs/microsoft-playwright-mcp',
    label: 'Automata Playwright vs. Microsoft Playwright',
    blurb: 'Compare browser automation tools',
  },
];

export default async function CompareIndexPage() {
  const servers = await getNewestActiveServers(300);
  const pairs = [
    ...FEATURED_PAIRS,
    ...INDEXABLE_COMPARE_PAIRS.map((pair) => ({
      href: comparePath(pair),
      label: pair.label,
      blurb: pair.blurb,
    })),
  ];

  return (
    <PageShell>
      <div className="cmp-index">
        <PageHeader
          centered
          title="Compare MCP servers"
          description="Pick 2 to 4 servers to see tools, install requirements, trust signals and adoption side by side."
        />

        <CompareSelector servers={servers.map(toPickServer)} />

        <section className="cmp-popular" aria-labelledby="cmp-popular-h">
          <h2 id="cmp-popular-h" className="lst-subhead">
            Popular comparisons
          </h2>
          <ul className="cmp-popular-grid reveal-stagger">
            {pairs.map((pair, i) => (
              <li key={pair.href} style={{ '--i': i } as CSSProperties}>
                <Link href={pair.href} className="cmp-popular-card spotlight">
                  <span>
                    <span className="cmp-popular-title">{pair.label}</span>
                    <span className="cmp-popular-blurb">{pair.blurb}</span>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
