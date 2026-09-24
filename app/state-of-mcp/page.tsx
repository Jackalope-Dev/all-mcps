import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqSection } from '@/components/ui/FaqSection';
import { type Bucket, getEcosystemStats } from '@/lib/ecosystemStats';
import { serializeJsonLd } from '@/lib/jsonLd';

// Live D1 aggregates — same reason as /trust: D1 is unreachable at build, so
// an ISR prerender would bake in an empty snapshot. lib/ecosystemStats caches
// the result per isolate, so dynamic rendering doesn't mean a scan per hit.
export const dynamic = 'force-dynamic';

const PAGE_URL = 'https://allmcps.com/state-of-mcp';
const TITLE = 'State of MCP: Live Model Context Protocol Ecosystem Statistics';
const DESCRIPTION =
  'Live statistics on the MCP server ecosystem from the AllMCPs index: how many servers exist, local vs remote transports, npx vs uvx, auth, licenses, health, and security advisories.';

export const metadata: Metadata = {
  title: 'State of MCP: Ecosystem Statistics',
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: `${TITLE} | AllMCPs`,
    description: DESCRIPTION,
    url: PAGE_URL,
  },
};

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  const p = (part / total) * 100;
  return `${p > 0 && p < 1 ? p.toFixed(1) : Math.round(p)}%`;
}

function sum(buckets: Bucket[]): number {
  return buckets.reduce((a, b) => a + b.count, 0);
}

function BarTable({
  caption,
  rows,
  total,
}: {
  caption: string;
  rows: Bucket[];
  total: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <table>
      <caption
        style={{
          textAlign: 'left',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          paddingBottom: '0.5rem',
        }}
      >
        {caption}
      </caption>
      <thead>
        <tr>
          <th scope="col">Value</th>
          <th scope="col">Listings</th>
          <th scope="col">Share</th>
          <th scope="col" style={{ width: '35%' }}>
            <span className="sr-only">Relative size</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td>{fmt(r.count)}</td>
            <td>{pct(r.count, total)}</td>
            <td aria-hidden="true">
              <div
                style={{
                  height: '0.55rem',
                  borderRadius: '999px',
                  background: 'var(--accent)',
                  width: `${Math.max(2, (r.count / max) * 100)}%`,
                }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function StateOfMcpPage() {
  const stats = await getEcosystemStats();

  if (!stats || stats.total === 0) {
    return (
      <main className="page-shell page-shell--default">
        <div className="page-shell-inner">
          <div className="surface page-panel">
            <h1 className="text-page-title">State of MCP</h1>
            <p className="text-lead">
              Statistics are temporarily unavailable. Browse the{' '}
              <Link href="/browse">MCP server directory</Link> in the meantime.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const updated = stats.generatedAt.slice(0, 10);
  const stdio =
    stats.transport.find((t) => t.label === 'Local (stdio)')?.count ?? 0;
  const remote =
    stats.transport.find((t) => t.label === 'Remote (HTTP)')?.count ?? 0;
  const determined = stdio + remote;
  const healthy = stats.health.find((h) => h.label === 'healthy')?.count ?? 0;
  const runnersTotal = sum(stats.runners);
  const npx = stats.runners.find((r) => r.label === 'npx')?.count ?? 0;
  const uvx = stats.runners.find((r) => r.label === 'uvx')?.count ?? 0;
  const authTotal = sum(stats.auth);
  const needsCreds = stats.auth
    .filter((a) => a.label !== 'none')
    .reduce((a, b) => a + b.count, 0);
  const licenseTotal = sum(stats.licenses);
  const topLicense = stats.licenses[0];

  // Every figure in these answers is computed, so they stay true as the index changes.
  const faqs = [
    {
      q: 'How many MCP servers are there?',
      a: `AllMCPs indexes ${fmt(stats.total)} active MCP servers as of ${updated}, with ${fmt(stats.added30d)} added in the last 30 days. The count covers public servers from the official MCP Registry, community server lists and direct submissions, after merging duplicates and removing archived projects.`,
    },
    {
      q: 'Are most MCP servers local or remote?',
      a: `Of the ${fmt(determined)} servers whose transport could be determined, ${pct(stdio, determined)} run locally over stdio and ${pct(remote, determined)} are remote HTTP endpoints. Local servers are started by the client as a subprocess; remote servers are hosted and reached over Streamable HTTP.`,
    },
    {
      q: 'Are MCP servers mostly JavaScript or Python?',
      a: `Among stdio servers with a known runner, ${pct(npx, runnersTotal)} launch with npx (Node.js packages) and ${pct(uvx, runnersTotal)} with uvx (Python packages). The runner reflects how the server is distributed, which is a close proxy for its implementation language.`,
    },
    {
      q: 'Do MCP servers need API keys?',
      a: `Where authentication could be determined (${fmt(authTotal)} servers), ${pct(needsCreds, authTotal)} require credentials such as an API key or OAuth, and the rest need none. Servers that wrap third-party SaaS APIs almost always need a key; local utilities usually do not.`,
    },
    {
      q: 'How healthy is the MCP ecosystem?',
      a: `${pct(healthy, stats.total)} of indexed servers passed their most recent automated health check (repository and endpoint reachability, rechecked continuously). ${fmt(stats.vulnCriticalOrHigh)} of ${fmt(stats.vulnScanned)} scanned install packages have at least one critical or high advisory recorded against some version.`,
    },
  ];

  const datasetJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'State of MCP — Model Context Protocol ecosystem statistics',
    description: DESCRIPTION,
    url: PAGE_URL,
    dateModified: stats.generatedAt,
    creator: {
      '@type': 'Organization',
      name: 'AllMCPs',
      url: 'https://allmcps.com',
    },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    variableMeasured: [
      'Active MCP servers',
      'Transport (stdio vs remote)',
      'Package runner',
      'Authentication type',
      'License',
      'Health status',
      'Security advisories',
    ],
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://allmcps.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Guides',
        item: 'https://allmcps.com/guides',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'State of MCP',
        item: PAGE_URL,
      },
    ],
  };

  return (
    <main className="page-shell page-shell--default">
      <div className="page-shell-inner">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(datasetJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(breadcrumbJsonLd),
          }}
        />

        <div className="surface page-panel min-w-0">
          <nav
            aria-label="Breadcrumb"
            style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}
          >
            <Link href="/guides" style={{ color: 'var(--text-secondary)' }}>
              Guides
            </Link>
            <span
              style={{ color: 'var(--text-secondary)', margin: '0 0.4rem' }}
            >
              /
            </span>
            <span style={{ color: 'var(--text-primary)' }}>State of MCP</span>
          </nav>

          <div
            style={{
              textAlign: 'center',
              maxWidth: '760px',
              margin: '0 auto 2.5rem',
            }}
          >
            <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
              State of MCP
            </h1>
            <p className="text-lead" style={{ margin: 0 }}>
              There are <strong>{fmt(stats.total)}</strong> active Model Context
              Protocol servers in the AllMCPs index as of {updated}.{' '}
              {pct(stdio, determined)} of those with a known transport run
              locally over stdio, npx is the most common launcher, and{' '}
              {pct(healthy, stats.total)} passed their latest health check.
              Every number on this page is computed live from the directory.
            </p>
          </div>

          <div className="markdown-body">
            <h2 id="size">How big is the MCP ecosystem?</h2>
            <p>
              {fmt(stats.total)} active servers, {fmt(stats.added30d)} added in
              the last 30 days and {fmt(stats.added90d)} in the last 90.{' '}
              {fmt(stats.official)} carry the Official badge, meaning their
              maintainers proved ownership of the listing.
            </p>
            <BarTable
              caption="Servers added to the AllMCPs index per month. This measures when we indexed a server, not when it was created — the index began in mid-2026, so early months include the backlog of existing servers."
              rows={stats.monthly}
              total={sum(stats.monthly)}
            />

            <h2 id="transport">Local vs remote servers</h2>
            <p>
              Local servers run as a subprocess of the client over stdio; remote
              servers are hosted endpoints reached over HTTP. See{' '}
              <Link href="/mcp-transports">MCP transports explained</Link> for
              the trade-offs.
            </p>
            <BarTable
              caption="Install transport, as extracted from each server's documentation."
              rows={stats.transport}
              total={stats.total}
            />

            <h2 id="runners">How local servers are launched</h2>
            <BarTable
              caption="Launcher for stdio servers with a verified install command."
              rows={stats.runners}
              total={runnersTotal}
            />

            <h2 id="auth">Authentication and pricing</h2>
            <p>
              Shares below are of servers where the value could be determined
              from documentation ({fmt(authTotal)} for auth,{' '}
              {fmt(sum(stats.pricing))} for pricing), not of the whole index.
            </p>
            <BarTable
              caption="Authentication required."
              rows={stats.auth}
              total={authTotal}
            />
            <BarTable
              caption="Pricing model."
              rows={stats.pricing}
              total={sum(stats.pricing)}
            />

            <h2 id="licenses">Licenses</h2>
            {topLicense && (
              <p>
                {topLicense.label} is the most common license, on{' '}
                {pct(topLicense.count, licenseTotal)} of servers with a detected
                license.
              </p>
            )}
            <BarTable
              caption="Top licenses."
              rows={stats.licenses}
              total={licenseTotal}
            />

            <h2 id="categories">What MCP servers do</h2>
            <p>
              Largest categories in the directory. Each links to its full list
              from the <Link href="/categories">category index</Link>, and the{' '}
              <Link href="/best">best-of rankings</Link> cover the most-used
              servers per topic.
            </p>
            <BarTable
              caption="Top categories."
              rows={stats.categories}
              total={stats.total}
            />

            <h2 id="popularity">Popularity</h2>
            <BarTable
              caption="GitHub stars per server. Most servers are small, single-maintainer projects."
              rows={stats.stars}
              total={stats.total}
            />

            <h2 id="health">Health and security</h2>
            <p>
              Health is rechecked continuously by the directory&apos;s health
              monitor. Security advisories come from{' '}
              <a href="https://osv.dev" rel="noopener">
                OSV.dev
              </a>{' '}
              for each server&apos;s install package:{' '}
              {fmt(stats.vulnCriticalOrHigh)} of {fmt(stats.vulnScanned)}{' '}
              scanned packages (
              {pct(stats.vulnCriticalOrHigh, stats.vulnScanned)}) have a
              critical or high advisory filed against at least one version — not
              necessarily the current one. See{' '}
              <Link href="/mcp-security">MCP security best practices</Link>.
            </p>
            <BarTable
              caption="Latest health check result."
              rows={stats.health}
              total={stats.total}
            />

            <h2 id="method">Methodology and citing this data</h2>
            <p>
              Figures cover listings with active status in AllMCPs, which
              ingests public MCP servers from the official MCP Registry,
              community server lists and direct submissions, merges duplicates,
              and removes archived or deleted repositories. Transport, runner,
              auth, pricing and license are extracted from each server&apos;s
              documentation and verified where possible; values that could not
              be determined are excluded from the shares that depend on them.
              Numbers refresh every few hours; last computed{' '}
              {stats.generatedAt.replace('T', ' ').slice(0, 16)} UTC.
            </p>
            <p>
              You are welcome to cite these figures with a link to this page (CC
              BY 4.0). Programmatic access is available through the{' '}
              <Link href="/docs/api">AllMCPs API</Link>.
            </p>
          </div>

          <FaqSection items={faqs} />
        </div>
      </div>
    </main>
  );
}
