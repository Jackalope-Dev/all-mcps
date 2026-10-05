import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CopyBlock } from '@/components/ui/CopyBlock';
import { FaqSection } from '@/components/ui/FaqSection';
import { SectionKicker } from '@/components/ui/SectionKicker';
import { getEcosystemStats } from '@/lib/ecosystemStats';
import { serializeJsonLd } from '@/lib/jsonLd';
import {
  BarList,
  ColumnChart,
  fmt,
  pct,
  SplitBar,
  StatTile,
  sum,
} from './charts';
import { ShareBar, ShareStat } from './ShareControls';

// Live D1 aggregates — same reason as /trust: D1 is unreachable at build, so
// an ISR prerender would bake in an empty snapshot. lib/ecosystemStats caches
// the result per isolate, so dynamic rendering doesn't mean a scan per hit.
export const dynamic = 'force-dynamic';

const PAGE_URL = 'https://allmcps.com/state-of-mcp';
const TITLE = 'State of MCP: Live Model Context Protocol Ecosystem Statistics';
const DESCRIPTION =
  'Live statistics on the MCP server ecosystem from the AllMCPs index: how many servers exist, local vs remote transports, npx vs uvx, auth, licenses, health, and security advisories.';

// The share card itself comes from ./opengraph-image.tsx (live numbers), so
// no `images` here. `twitter` is set explicitly because the root layout's
// twitter title/description would otherwise win on X.
export const metadata: Metadata = {
  title: 'State of MCP: Ecosystem Statistics',
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: `${TITLE} | AllMCPs`,
    description: DESCRIPTION,
    url: PAGE_URL,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} | AllMCPs`,
    description: DESCRIPTION,
  },
};

const SECTIONS = 8;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const name = MONTHS[Number(m) - 1];
  return name ? `${name} ${y}` : ym;
}

function Section({
  id,
  index,
  kicker,
  title,
  takeaway,
  shareText,
  children,
}: {
  id: string;
  index: number;
  kicker: string;
  title: string;
  takeaway: ReactNode;
  shareText: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="som-section" aria-labelledby={`${id}-h`}>
      <SectionKicker index={index} total={SECTIONS} label={kicker} />
      <h2 id={`${id}-h`} className="som-h2">
        {title}
      </h2>
      <p className="som-takeaway">{takeaway}</p>
      <div className="som-card">{children}</div>
      <ShareStat anchor={id} text={shareText} />
    </section>
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
  const undetermined = Math.max(0, stats.total - stdio - remote);
  const determined = stdio + remote;
  const healthy = stats.health.find((h) => h.label === 'healthy')?.count ?? 0;
  const runnersTotal = sum(stats.runners);
  const npx = stats.runners.find((r) => r.label === 'npx')?.count ?? 0;
  const uvx = stats.runners.find((r) => r.label === 'uvx')?.count ?? 0;
  const authTotal = sum(stats.auth);
  const needsCreds = stats.auth
    .filter((a) => a.label !== 'none')
    .reduce((a, b) => a + b.count, 0);
  const pricingTotal = sum(stats.pricing);
  const free = stats.pricing.find((p) => p.label === 'free')?.count ?? 0;
  const licenseTotal = sum(stats.licenses);
  const topLicense = stats.licenses[0];
  const topCategory = stats.categories[0];
  const underTen = stats.stars.find((s) => s.label === '0–9')?.count ?? 0;
  const thousandPlus =
    stats.stars.find((s) => s.label === '1,000+')?.count ?? 0;
  const currentMonth = stats.generatedAt.slice(0, 7);
  const lastMonth = stats.monthly[stats.monthly.length - 1];
  const monthIsPartial = lastMonth?.label === currentMonth;

  const localShare = pct(stdio, determined);
  const npxShare = pct(npx, runnersTotal);
  const healthyShare = pct(healthy, stats.total);

  const citation = `AllMCPs. "State of MCP: Model Context Protocol Ecosystem Statistics." Updated ${updated}. ${PAGE_URL} (CC BY 4.0)`;

  // Every figure in these answers is computed, so they stay true as the index changes.
  const faqs = [
    {
      q: 'How many MCP servers are there?',
      a: `AllMCPs indexes ${fmt(stats.total)} active MCP servers as of ${updated}, with ${fmt(stats.added30d)} added in the last 30 days. The count covers public servers from the official MCP Registry, community server lists and direct submissions, after merging duplicates and removing archived projects.`,
    },
    {
      q: 'Are most MCP servers local or remote?',
      a: `Of the ${fmt(determined)} servers whose transport could be determined, ${localShare} run locally over stdio and ${pct(remote, determined)} are remote HTTP endpoints. Local servers are started by the client as a subprocess; remote servers are hosted and reached over Streamable HTTP.`,
    },
    {
      q: 'Are MCP servers mostly JavaScript or Python?',
      a: `Among stdio servers with a known runner, ${npxShare} launch with npx (Node.js packages) and ${pct(uvx, runnersTotal)} with uvx (Python packages). The runner reflects how the server is distributed, which is a close proxy for its implementation language.`,
    },
    {
      q: 'Do MCP servers need API keys?',
      a: `Where authentication could be determined (${fmt(authTotal)} servers), ${pct(needsCreds, authTotal)} require credentials such as an API key or OAuth, and the rest need none. Servers that wrap third-party SaaS APIs almost always need a key; local utilities usually do not.`,
    },
    {
      q: 'How healthy is the MCP ecosystem?',
      a: `${healthyShare} of indexed servers passed their most recent automated health check (repository and endpoint reachability, rechecked continuously). ${fmt(stats.vulnCriticalOrHigh)} of ${fmt(stats.vulnScanned)} scanned install packages have at least one critical or high advisory recorded against some version.`,
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

          <header className="som-hero">
            <p className="som-live">
              <span className="som-live-dot" aria-hidden="true" />
              Live data · updated {updated}
            </p>
            <h1 className="som-title">State of MCP</h1>
            <p className="som-hero-figure">
              <span className="som-hero-number">{fmt(stats.total)}</span>
              <span className="som-hero-unit">
                active Model Context Protocol servers indexed
              </span>
            </p>
            <p className="text-lead som-lead">
              {localShare} of those with a known transport run locally over
              stdio, npx is the most common launcher, and {healthyShare} passed
              their latest health check. Every number on this page is computed
              live from the AllMCPs directory.
            </p>
            <ShareBar
              text={`State of MCP: ${fmt(stats.total)} active MCP servers, ${localShare} run locally, ${npxShare} of local servers launch with npx. Live data:`}
            />
          </header>

          <div className="som-stats">
            <StatTile
              value={`+${fmt(stats.added30d)}`}
              label="servers added to the index in the last 30 days"
              href="#size"
            />
            <StatTile
              value={localShare}
              label="run locally over stdio (of known transport)"
              href="#transport"
            />
            <StatTile
              value={npxShare}
              label="of local servers launch with npx"
              href="#runners"
            />
            <StatTile
              value={healthyShare}
              label="passed their latest health check"
              href="#health"
            />
          </div>

          <nav className="som-toc" aria-label="On this page">
            <a href="#size">Growth</a>
            <a href="#transport">Local vs remote</a>
            <a href="#runners">Launchers</a>
            <a href="#auth">Auth &amp; pricing</a>
            <a href="#licenses">Licenses</a>
            <a href="#categories">Categories</a>
            <a href="#popularity">Popularity</a>
            <a href="#health">Health &amp; security</a>
            <a href="#method">Cite this data</a>
          </nav>

          <Section
            id="size"
            index={1}
            kicker="Growth"
            title="How big is the MCP ecosystem?"
            takeaway={
              <>
                <strong>{fmt(stats.total)}</strong> active servers,{' '}
                <strong>{fmt(stats.added30d)}</strong> added in the last 30
                days. {fmt(stats.official)} carry the Official badge, meaning
                their maintainers proved ownership of the listing.
              </>
            }
            shareText={`${fmt(stats.total)} active MCP servers, ${fmt(stats.added30d)} added in the last 30 days — State of MCP`}
          >
            <ColumnChart
              rows={stats.monthly}
              formatLabel={monthLabel}
              partialLast={monthIsPartial}
              caption="Servers added to the AllMCPs index per month. This measures when we indexed a server, not when it was created — the index began in mid-2026, so early months include the backlog of existing servers."
            />
          </Section>

          <Section
            id="transport"
            index={2}
            kicker="Transport"
            title="Local vs remote servers"
            takeaway={
              <>
                <strong>{localShare}</strong> of servers with a known transport
                run locally; <strong>{pct(remote, determined)}</strong> are
                hosted remote endpoints.
              </>
            }
            shareText={`${localShare} of MCP servers run locally over stdio; ${pct(remote, determined)} are remote HTTP endpoints — State of MCP`}
          >
            <SplitBar
              segments={[
                { label: 'Local (stdio)', count: stdio, tone: 'primary' },
                { label: 'Remote (HTTP)', count: remote, tone: 'secondary' },
                {
                  label: 'Not determined',
                  count: undetermined,
                  tone: 'neutral',
                },
              ]}
              caption="Install transport across all active servers, as extracted from each server's documentation. Local servers run as a client subprocess; remote servers are reached over HTTP."
            />
            <p className="som-note">
              See <Link href="/mcp-transports">MCP transports explained</Link>{' '}
              for the trade-offs.
            </p>
          </Section>

          <Section
            id="runners"
            index={3}
            kicker="Launchers"
            title="How local servers are launched"
            takeaway={
              <>
                <strong>{npxShare}</strong> launch with npx (Node.js) and{' '}
                <strong>{pct(uvx, runnersTotal)}</strong> with uvx (Python).
              </>
            }
            shareText={`${npxShare} of local MCP servers launch with npx, ${pct(uvx, runnersTotal)} with uvx — State of MCP`}
          >
            <BarList
              rows={stats.runners}
              total={runnersTotal}
              labelHeader="Launcher"
              caption="Launcher for stdio servers with a verified install command."
            />
          </Section>

          <Section
            id="auth"
            index={4}
            kicker="Access"
            title="Authentication and pricing"
            takeaway={
              <>
                <strong>{pct(needsCreds, authTotal)}</strong> need credentials;{' '}
                <strong>{pct(free, pricingTotal)}</strong> are free to use.
              </>
            }
            shareText={`${pct(needsCreds, authTotal)} of MCP servers need an API key or OAuth; ${pct(free, pricingTotal)} are free — State of MCP`}
          >
            <div className="som-pair">
              <BarList
                rows={stats.auth}
                total={authTotal}
                labelHeader="Auth"
                caption={`Authentication required, of ${fmt(authTotal)} servers where it could be determined.`}
              />
              <BarList
                rows={stats.pricing}
                total={pricingTotal}
                labelHeader="Pricing"
                caption={`Pricing model, of ${fmt(pricingTotal)} servers where it could be determined.`}
              />
            </div>
          </Section>

          <Section
            id="licenses"
            index={5}
            kicker="Licenses"
            title="Licenses"
            takeaway={
              topLicense ? (
                <>
                  <strong>{topLicense.label}</strong> covers{' '}
                  <strong>{pct(topLicense.count, licenseTotal)}</strong> of
                  servers with a detected license.
                </>
              ) : (
                'License breakdown of servers with a detected license.'
              )
            }
            shareText={
              topLicense
                ? `${pct(topLicense.count, licenseTotal)} of open MCP servers use the ${topLicense.label} license — State of MCP`
                : 'MCP server licenses — State of MCP'
            }
          >
            <BarList
              rows={stats.licenses}
              total={licenseTotal}
              labelHeader="License"
              caption="Top licenses among servers with a detected license."
            />
          </Section>

          <Section
            id="categories"
            index={6}
            kicker="Categories"
            title="What MCP servers do"
            takeaway={
              topCategory ? (
                <>
                  <strong>{topCategory.label}</strong> make up{' '}
                  <strong>{pct(topCategory.count, stats.total)}</strong> of the
                  index.
                </>
              ) : (
                'Largest categories in the directory.'
              )
            }
            shareText={
              topCategory
                ? `${pct(topCategory.count, stats.total)} of MCP servers are ${topCategory.label.replace(/^\P{L}+/u, '')} — State of MCP`
                : 'What MCP servers do — State of MCP'
            }
          >
            <BarList
              rows={stats.categories}
              total={stats.total}
              labelHeader="Category"
              caption="Largest categories, share of all active servers."
            />
            <p className="som-note">
              Each has a full list in the{' '}
              <Link href="/categories">category index</Link>, and the{' '}
              <Link href="/best">best-of rankings</Link> cover the most-used
              servers per topic.
            </p>
          </Section>

          <Section
            id="popularity"
            index={7}
            kicker="Popularity"
            title="Popularity"
            takeaway={
              <>
                <strong>{pct(underTen, stats.total)}</strong> have fewer than 10
                GitHub stars; only <strong>{fmt(thousandPlus)}</strong> have
                1,000+.
              </>
            }
            shareText={`${pct(underTen, stats.total)} of MCP servers have fewer than 10 GitHub stars; only ${fmt(thousandPlus)} have 1,000+ — State of MCP`}
          >
            <BarList
              rows={stats.stars}
              total={stats.total}
              labelHeader="GitHub stars"
              caption="GitHub stars per server. Most servers are small, single-maintainer projects."
            />
          </Section>

          <Section
            id="health"
            index={8}
            kicker="Health"
            title="Health and security"
            takeaway={
              <>
                <strong>{healthyShare}</strong> passed their latest health
                check; <strong>{fmt(stats.vulnCriticalOrHigh)}</strong> of{' '}
                {fmt(stats.vulnScanned)} scanned packages (
                {pct(stats.vulnCriticalOrHigh, stats.vulnScanned)}) have a
                critical or high advisory on record.
              </>
            }
            shareText={`${healthyShare} of MCP servers passed their latest health check; ${pct(stats.vulnCriticalOrHigh, stats.vulnScanned)} of scanned packages have a critical/high advisory on record — State of MCP`}
          >
            <BarList
              rows={stats.health}
              total={stats.total}
              labelHeader="Status"
              caption="Latest health check result, rechecked continuously by the directory's health monitor."
            />
            <p className="som-note">
              Advisories come from{' '}
              <a href="https://osv.dev" rel="noopener">
                OSV.dev
              </a>{' '}
              for each server&apos;s install package and count any version, not
              necessarily the current one. See{' '}
              <Link href="/mcp-security">MCP security best practices</Link>.
            </p>
          </Section>

          <section
            id="method"
            className="som-section markdown-body"
            aria-labelledby="method-h"
          >
            <h2 id="method-h" className="som-h2">
              Methodology and citing this data
            </h2>
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
            <CopyBlock
              code={citation}
              title="Citation"
              language="text"
              snippetType="state_of_mcp_citation"
              toastMessage="Citation copied"
            />
          </section>

          <FaqSection items={faqs} />
        </div>
      </div>
    </main>
  );
}
