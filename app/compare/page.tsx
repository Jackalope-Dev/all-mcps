import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { CompareSelector } from '@/components/CompareSelector';
import { CompareLink } from '@/components/listing/CompareLink';
import { PageHeader, PageShell } from '@/components/PageShell';
import { INDEXABLE_COMPARE_PAIRS } from '@/lib/comparePairs';
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

// Hand-picked pairs beyond the curated (indexable) set. They stay reachable
// for people, but only curated pairs get a crawlable href (CompareLink): the
// others are noindexed, and a pair whose listing was later removed became a
// broken link here.
const FEATURED_PAIRS = [
  {
    a: 'crystaldba-postgres-mcp',
    b: 'jparkerweb-mcp-sqlite',
    label: 'Postgres MCP vs. SQLite MCP',
    blurb: 'Compare relational database tools',
  },
  {
    a: 'github-github-mcp-server',
    b: 'jmrplens-gitlab-mcp-server',
    label: 'GitHub MCP vs. GitLab MCP',
    blurb: 'Compare Git platform tools & APIs',
  },
  {
    a: 'automatalabs-mcp-server-playwright',
    b: 'microsoft-playwright-mcp',
    label: 'Automata Playwright vs. Microsoft Playwright',
    blurb: 'Compare browser automation tools',
  },
];

export default async function CompareIndexPage() {
  const servers = await getNewestActiveServers(300);
  const pairs = [...INDEXABLE_COMPARE_PAIRS, ...FEATURED_PAIRS].map((p) => {
    const [a, b] = p.a < p.b ? [p.a, p.b] : [p.b, p.a];
    return { a, b, label: p.label, blurb: p.blurb };
  });

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
              <li
                key={`${pair.a}|${pair.b}`}
                style={{ '--i': i } as CSSProperties}
              >
                <CompareLink
                  a={pair.a}
                  b={pair.b}
                  className="cmp-popular-card spotlight"
                >
                  <span>
                    <span className="cmp-popular-title">{pair.label}</span>
                    <span className="cmp-popular-blurb">{pair.blurb}</span>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </CompareLink>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
