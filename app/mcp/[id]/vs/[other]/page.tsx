import { ArrowRight, BadgeCheck, Download, Eye, Heart } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { type CSSProperties, Fragment, type ReactNode } from 'react';
import { serializeJsonLd } from '@/lib/jsonLd';
import { CopyBlock } from '../../../../../components/ui/CopyBlock';
import { FaqSection } from '../../../../../components/ui/FaqSection';
import { SafeMarkdown } from '../../../../../components/ui/SafeMarkdown';
import { ServerAvatar } from '../../../../../components/ui/ServerAvatar';
import {
  categoryHueClass,
  categorySlug,
  parseCategoryLabel,
} from '../../../../../lib/categories';
import { isIndexableCompare } from '../../../../../lib/comparePairs';
import { parseServerName } from '../../../../../lib/displayName';
import {
  isFeaturedListing,
  isVerifiedListing,
} from '../../../../../lib/featuredStatus';
import {
  isUnverifiedInstall,
  resolveInstallConfig,
} from '../../../../../lib/installConfig';
import { compareRedirectPath } from '../../../../../lib/listingRedirect';
import {
  computeQualityScore,
  tierColor,
} from '../../../../../lib/qualityScore';
import {
  getRelatedServers,
  getServerById,
  type Server,
} from '../../../../../lib/servers';

const SITE = 'https://allmcps.com';

/** Stable canonical for a pair so A/vs/B and B/vs/A consolidate in search. */
function canonicalPair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

function buildConfigSnippet(s: Server): string {
  const install = resolveInstallConfig({
    id: s.id,
    name: s.name,
    url: s.url,
    description: s.description,
    installKind: s.installKind,
    installCommand: s.installCommand,
    installArgs: s.installArgs,
    installPackage: s.installPackage,
    installConfidence: s.installConfidence,
  });

  const key = s.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  if (install.kind === 'remote') {
    return JSON.stringify(
      {
        mcpServers: {
          [key]: {
            url: install.url,
          },
        },
      },
      null,
      2,
    );
  }

  const envObj: Record<string, string> = {};
  if (s.aiEnvVars && s.aiEnvVars.length > 0) {
    s.aiEnvVars.forEach((v: string) => {
      envObj[v] = `YOUR_${v}_HERE`;
    });
  }

  return JSON.stringify(
    {
      mcpServers: {
        [key]: {
          command: install.command,
          args: install.args,
          ...(Object.keys(envObj).length > 0 ? { env: envObj } : {}),
        },
      },
    },
    null,
    2,
  );
}

function toolNames(s: Server, max = 12): string[] {
  if (s.tools?.length) {
    return s.tools
      .map((t) => t.name)
      .filter(Boolean)
      .slice(0, max);
  }
  // Real tool names only — aiFeatures are prose capabilities, not callable tools.
  return [];
}

/** Says what was declared — an unset field is "not declared", never a guess. */
function authLabel(auth?: string | null): string {
  if (!auth) return 'Not declared';
  if (auth === 'none') return 'No auth required';
  if (auth === 'api_key') return 'API key required';
  if (auth === 'oauth') return 'OAuth 2.0';
  if (auth === 'byok') return 'Bring your own key';
  return auth;
}

function pricingLabel(pricing?: string | null): string {
  if (!pricing) return 'Not declared';
  if (pricing === 'free') return 'Free';
  if (pricing === 'freemium') return 'Freemium';
  if (pricing === 'paid') return 'Paid service';
  if (pricing === 'byok') return 'BYOK (pay the provider)';
  return pricing;
}

function pricingSentence(name: string, s: Server): string {
  const auth = s.authType
    ? ` Auth: ${authLabel(s.authType).toLowerCase()}.`
    : '';
  switch (s.pricingModel) {
    case 'free':
      return `${name} is listed as free.${auth}`;
    case 'freemium':
      return `${name} is listed as freemium — a free tier with paid plans.${auth}`;
    case 'paid':
      return `${name} is listed as a paid service.${auth}`;
    case 'byok':
      return `${name} is bring-your-own-key: usage is billed by the API provider you supply a key for.${auth}`;
    default:
      return `${name} has no declared pricing — check the project's own site.${auth}`;
  }
}

/** Keeps a display name short enough that the compare title stays inside the SEO budget. */
function truncateName(name: string, max: number): string {
  if (name.length <= max) return name;
  return `${name.slice(0, Math.max(6, max - 1)).trimEnd()}…`;
}

/** Builds "A vs B — MCP Server Comparison", dropping the suffix if the pair of names is long. */
function buildCompareTitle(nameA: string, nameB: string): string {
  const a = truncateName(nameA, 22);
  const b = truncateName(nameB, 22);
  const base = `${a} vs ${b}`;
  const withSuffix = `${base} — MCP Server Comparison`;
  return withSuffix.length <= 55 ? withSuffix : base;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; other: string }>;
}): Promise<Metadata> {
  const { id, other } = await params;
  if (id === other) return { title: 'Not Found', robots: { index: false } };

  const [a, b] = await Promise.all([getServerById(id), getServerById(other)]);
  const compareHop = compareRedirectPath(id, other, a, b);
  if (compareHop) permanentRedirect(compareHop);
  if (!a || !b || a.status !== 'active' || b.status !== 'active') {
    return { title: 'Not Found', robots: { index: false } };
  }

  const nameA = parseServerName(a.name).displayName;
  const nameB = parseServerName(b.name).displayName;
  const [c0, c1] = canonicalPair(id, other);
  const shortA = truncateName(nameA, 22);
  const shortB = truncateName(nameB, 22);
  const title = buildCompareTitle(nameA, nameB);
  const description = `Compare ${shortA} vs ${shortB} MCP servers side-by-side: tools, transport specs, install commands, auth requirements, and Claude/Cursor config snippets.`;
  const url = `${SITE}/mcp/${c0}/vs/${c1}`;

  return {
    title,
    description,
    // Curated pairs only — see lib/comparePairs.ts for why everything else stays noindex.
    robots: {
      index: isIndexableCompare(id, other, a, b),
      follow: true,
    },
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      images: [
        {
          url: 'https://allmcps.com/opengraph-image',
          width: 1200,
          height: 630,
          alt: 'AllMCPs',
        },
      ],
      title: `${title} | AllMCPs`,
      description,
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | AllMCPs`,
      description,
    },
  };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string; other: string }>;
}) {
  const { id, other } = await params;
  if (!id || !other || id === other) notFound();

  const [left, right] = await Promise.all([
    getServerById(id),
    getServerById(other),
  ]);
  const compareHop = compareRedirectPath(id, other, left, right);
  if (compareHop) permanentRedirect(compareHop);
  if (!left || !right) notFound();
  if (left.status !== 'active' || right.status !== 'active') notFound();

  const nameL = parseServerName(left.name).displayName;
  const nameR = parseServerName(right.name).displayName;
  const [c0, c1] = canonicalPair(id, other);
  const canonicalUrl = `${SITE}/mcp/${c0}/vs/${c1}`;
  const pageUrl = `${SITE}/mcp/${id}/vs/${other}`;

  const qL = computeQualityScore(left);
  const qR = computeQualityScore(right);
  const toolsL = toolNames(left);
  const toolsR = toolNames(right);
  const installL = resolveInstallConfig(left);
  const installR = resolveInstallConfig(right);

  const snippetL = buildConfigSnippet(left);
  const snippetR = buildConfigSnippet(right);
  const confirmedL = !isUnverifiedInstall(installL);
  const confirmedR = !isUnverifiedInstall(installR);
  const modeText = (i: typeof installL, ok: boolean) =>
    !ok
      ? 'an install path we have not confirmed yet'
      : i.kind === 'remote'
        ? 'a remote HTTP/SSE transport'
        : 'a local stdio subprocess';

  const catL = parseCategoryLabel(left.category).label;
  const catR = parseCategoryLabel(right.category).label;

  // One FAQ list drives both the visible section and the FAQPage JSON-LD, so
  // structured data always matches what's on the page.
  const faqItems = [
    {
      question: `What is the main functional difference between ${nameL} and ${nameR}?`,
      answer: `${nameL} is categorized under ${catL} and uses ${modeText(installL, confirmedL)}. ${nameR} belongs to ${catR} and uses ${modeText(installR, confirmedR)}. Pick ${nameL} for ${catL.toLowerCase()} work and ${nameR} for ${catR.toLowerCase()}.`,
    },
    {
      question: `How do I install ${nameL} or ${nameR} in Claude Desktop, Cursor, or Windsurf?`,
      answer:
        confirmedL || confirmedR
          ? `Copy the mcpServers block from the config section on this page into your client's config (for example claude_desktop_config.json or ~/.cursor/mcp.json), then fully restart the client.${!confirmedL ? ` ${nameL} has no confirmed install command yet — follow its own setup instructions.` : ''}${!confirmedR ? ` ${nameR} has no confirmed install command yet — follow its own setup instructions.` : ''}`
          : `Neither server has a confirmed install command yet, so we don't publish a guessed config. Follow each project's own setup instructions, linked from its listing page.`,
    },
    {
      question: `Are ${nameL} and ${nameR} free to use, or do they require API keys?`,
      answer: `${pricingSentence(nameL, left)} ${pricingSentence(nameR, right)} If a server needs environment variables such as API keys, define them under the env key in your client's MCP config.`,
    },
    {
      question: `Can I run both ${nameL} and ${nameR} at the same time in my AI client?`,
      answer: `Yes. MCP clients support multiple servers: add ${left.id} and ${right.id} as separate keys in the same mcpServers object, and your assistant will call tools from either one.`,
    },
    {
      question:
        'Which MCP server has higher directory engagement and quality ratings?',
      answer: `On AllMCPs, ${nameL} has a quality signal of ${qL.score}/100 (${qL.tier}) with ${(left.views || 0).toLocaleString()} views, ${(left.copies || 0).toLocaleString()} installs and ${(left.githubStars || 0).toLocaleString()} GitHub stars. ${nameR} has ${qR.score}/100 (${qR.tier}) with ${(right.views || 0).toLocaleString()} views, ${(right.copies || 0).toLocaleString()} installs and ${(right.githubStars || 0).toLocaleString()} GitHub stars.`,
    },
  ];

  const [moreAltsLeft, moreAltsRight] = await Promise.all([
    getRelatedServers(left, 8).then((list) =>
      list.filter((s) => s.id !== right.id).slice(0, 4),
    ),
    getRelatedServers(right, 8).then((list) =>
      list.filter((s) => s.id !== left.id).slice(0, 4),
    ),
  ]);

  // Structured Data (Schema.org) for Search Engines & AI Search Crawlers
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: `${nameL} vs ${nameR} — MCP Server Comparison`,
        description: `Detailed comparison between ${nameL} and ${nameR} Model Context Protocol (MCP) servers: tools, install specs, auth models, and client configs.`,
        url: canonicalUrl,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Browse',
            item: `${SITE}/browse`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: nameL,
            item: `${SITE}/mcp/${left.id}`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: `vs ${nameR}`,
            item: pageUrl,
          },
        ],
      },
      {
        '@type': 'SoftwareApplication',
        name: nameL,
        applicationCategory: catL,
        operatingSystem: 'Cross-platform',
        url: `${SITE}/mcp/${left.id}`,
      },
      {
        '@type': 'SoftwareApplication',
        name: nameR,
        applicationCategory: catR,
        operatingSystem: 'Cross-platform',
        url: `${SITE}/mcp/${right.id}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ],
  };

  const sides = [
    {
      s: left,
      name: nameL,
      cat: catL,
      q: qL,
      install: installL,
      tools: toolsL,
      snippet: snippetL,
    },
    {
      s: right,
      name: nameR,
      cat: catR,
      q: qR,
      install: installR,
      tools: toolsR,
      snippet: snippetR,
    },
  ];
  const transportText = (i: typeof installL, confirmed: boolean) =>
    !confirmed
      ? null
      : i.kind === 'remote'
        ? 'Remote HTTP/SSE'
        : 'Local subprocess (stdio)';
  type VsRow = {
    label: string;
    cells: [ReactNode, ReactNode];
    keys: [string, string];
  };
  const rows: VsRow[] = [
    {
      label: 'Category',
      cells: [
        <Link
          key="l"
          href={`/categories/${categorySlug(left.category)}`}
          className={`tint-pill cmp-cat ${categoryHueClass(left.category)}`}
        >
          {catL}
        </Link>,
        <Link
          key="r"
          href={`/categories/${categorySlug(right.category)}`}
          className={`tint-pill cmp-cat ${categoryHueClass(right.category)}`}
        >
          {catR}
        </Link>,
      ],
      keys: [catL, catR],
    },
    {
      label: 'Quality signal',
      cells: sides.map((x) => (
        <span key={x.s.id} className="cmp-quality">
          <span
            className="cmp-quality-score tabular"
            style={{ color: tierColor(x.q.tier) }}
          >
            {x.q.score}
          </span>
          <span className="cmp-muted">/100 · {x.q.tier}</span>
        </span>
      )) as [ReactNode, ReactNode],
      keys: [String(qL.score), String(qR.score)],
    },
    {
      label: 'Install command',
      cells: sides.map((x) =>
        isUnverifiedInstall(x.install) ? (
          <span key={x.s.id} className="cmp-muted">
            Not confirmed yet
          </span>
        ) : (
          <span key={x.s.id} className="cmp-yes">
            Confirmed
          </span>
        ),
      ) as [ReactNode, ReactNode],
      keys: [String(confirmedL), String(confirmedR)],
    },
    {
      label: 'Transport',
      cells: [
        transportText(installL, confirmedL) ?? (
          <span className="cmp-na">—</span>
        ),
        transportText(installR, confirmedR) ?? (
          <span className="cmp-na">—</span>
        ),
      ],
      keys: [
        String(transportText(installL, confirmedL)),
        String(transportText(installR, confirmedR)),
      ],
    },
    {
      label: 'Auth',
      cells: [authLabel(left.authType), authLabel(right.authType)],
      keys: [authLabel(left.authType), authLabel(right.authType)],
    },
    {
      label: 'Pricing',
      cells: [
        pricingLabel(left.pricingModel),
        pricingLabel(right.pricingModel),
      ],
      keys: [pricingLabel(left.pricingModel), pricingLabel(right.pricingModel)],
    },
    {
      label: 'Required env vars',
      cells: sides.map((x) =>
        x.s.aiEnvVars && x.s.aiEnvVars.length > 0 ? (
          <span key={x.s.id} className="cmp-tools">
            {x.s.aiEnvVars.map((v) => (
              <code key={v}>{v}</code>
            ))}
          </span>
        ) : (
          <span key={x.s.id} className="cmp-na">
            None listed
          </span>
        ),
      ) as [ReactNode, ReactNode],
      keys: [
        (left.aiEnvVars ?? []).join(','),
        (right.aiEnvVars ?? []).join(','),
      ],
    },
    {
      label: 'Verified owner',
      cells: sides.map((x) =>
        isVerifiedListing(x.s) && x.s.isOfficial ? (
          <span key={x.s.id} className="cmp-yes">
            <BadgeCheck size={14} aria-hidden="true" /> Verified
          </span>
        ) : (
          <span key={x.s.id} className="cmp-muted">
            Community listing
          </span>
        ),
      ) as [ReactNode, ReactNode],
      keys: [
        String(isVerifiedListing(left) && !!left.isOfficial),
        String(isVerifiedListing(right) && !!right.isOfficial),
      ],
    },
    {
      label: 'GitHub stars',
      cells: sides.map((x) =>
        typeof x.s.githubStars === 'number' ? (
          <span key={x.s.id} className="tabular">
            {x.s.githubStars.toLocaleString()}
          </span>
        ) : (
          <span key={x.s.id} className="cmp-na">
            —
          </span>
        ),
      ) as [ReactNode, ReactNode],
      keys: [String(left.githubStars), String(right.githubStars)],
    },
    {
      label: 'Directory activity',
      cells: sides.map((x) => (
        <span key={x.s.id} className="vs-activity">
          <span>
            <Eye size={13} aria-hidden="true" />{' '}
            {(x.s.views || 0).toLocaleString()} views
          </span>
          <span>
            <Download size={13} aria-hidden="true" />{' '}
            {(x.s.copies || 0).toLocaleString()} installs
          </span>
          <span>
            <Heart size={13} aria-hidden="true" />{' '}
            {(x.s.upvotes || 0).toLocaleString()} upvotes
          </span>
        </span>
      )) as [ReactNode, ReactNode],
      keys: [
        `${left.views}/${left.copies}/${left.upvotes}`,
        `${right.views}/${right.copies}/${right.upvotes}`,
      ],
    },
    {
      label: 'Tools',
      cells: [
        left.tools?.length || toolsL.length || (
          <span className="cmp-na">Not listed</span>
        ),
        right.tools?.length || toolsR.length || (
          <span className="cmp-na">Not listed</span>
        ),
      ],
      keys: [
        String(left.tools?.length || toolsL.length),
        String(right.tools?.length || toolsR.length),
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <main className="container lst-page vs-page">
        <nav aria-label="Breadcrumb">
          <ol className="crumbs">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/browse">Browse</Link>
            </li>
            <li>
              <Link href={`/mcp/${left.id}`}>{nameL}</Link>
            </li>
            <li aria-current="page">vs {nameR}</li>
          </ol>
        </nav>

        <header className="vs-hero animate-in">
          <h1 className="text-page-title">
            {nameL} <span className="vs-hero-vs">vs</span> {nameR}
          </h1>
          <p className="text-lead">
            A side-by-side look at the <strong>{nameL}</strong> and{' '}
            <strong>{nameR}</strong> MCP servers: transport, auth, tools,
            quality signals, and the config to install either one in Claude,
            Cursor, Windsurf or VS Code.
          </p>
        </header>

        {/* At a glance — the two contenders, then a one-line verdict. */}
        <section
          className="vs-glance animate-in"
          style={{ '--i': 1 } as CSSProperties}
          aria-label="At a glance"
        >
          {sides.map((x, i) => (
            <Fragment key={x.s.id}>
              {i === 1 && (
                <span className="vs-glance-vs" aria-hidden="true">
                  vs
                </span>
              )}
              <Link href={`/mcp/${x.s.id}`} className="vs-side spotlight">
                <span className="vs-side-top">
                  <ServerAvatar
                    name={x.s.name}
                    logoUrl={x.s.logoUrl}
                    category={x.s.category}
                    size={44}
                  />
                  <span className="vs-side-id">
                    <span className="vs-side-name">{x.name}</span>
                    <span className="cmp-muted">
                      {x.cat}
                      {transportText(x.install, !isUnverifiedInstall(x.install))
                        ? ` · ${transportText(x.install, !isUnverifiedInstall(x.install))}`
                        : ''}
                    </span>
                  </span>
                </span>
                <span className="vs-side-desc">
                  <SafeMarkdown content={x.s.description || '—'} isInline />
                </span>
                <span className="vs-side-stats">
                  <span className="cmp-quality">
                    <span
                      className="cmp-quality-score tabular"
                      style={{ color: tierColor(x.q.tier) }}
                    >
                      {x.q.score}
                    </span>
                    <span className="cmp-muted">{x.q.tier}</span>
                  </span>
                  <span className="cmp-muted">
                    Auth: {authLabel(x.s.authType).toLowerCase()}
                  </span>
                  {isFeaturedListing(x.s) && (
                    <span className="lst-pill lst-pill--accent">Featured</span>
                  )}
                </span>
              </Link>
            </Fragment>
          ))}
          <p className="vs-verdict">
            <strong>Verdict:</strong> choose <strong>{nameL}</strong> for{' '}
            {catL.toLowerCase()} work
            {confirmedL
              ? installL.kind === 'remote'
                ? ' over a hosted endpoint'
                : ' as a local process'
              : ''}
            ; choose <strong>{nameR}</strong> for {catR.toLowerCase()}
            {confirmedR
              ? installR.kind === 'remote'
                ? ' over a hosted endpoint'
                : ' as a local process'
              : ''}
            . You can also run both side by side in one <code>mcpServers</code>{' '}
            block.
          </p>
        </section>

        {/* Which should you choose? */}
        <section className="lst-section reveal" aria-labelledby="vs-choose-h">
          <header className="lst-section-head">
            <h2 id="vs-choose-h">Which MCP server should you choose?</h2>
          </header>
          <div className="lst-two-up">
            {sides.map((x) => (
              <div key={x.s.id} className="lst-card vs-choose">
                <h3 className="vs-choose-title">
                  <ServerAvatar
                    name={x.s.name}
                    logoUrl={x.s.logoUrl}
                    size={28}
                  />
                  Choose {x.name} when
                </h3>
                <ul className="lst-bullets">
                  <li>
                    You need dedicated capabilities in the{' '}
                    <strong>{x.cat}</strong> domain.
                  </li>
                  {!isUnverifiedInstall(x.install) && (
                    <li>
                      You prefer a{' '}
                      <strong>
                        {x.install.kind === 'remote'
                          ? 'remote HTTP/SSE'
                          : 'local stdio subprocess'}
                      </strong>{' '}
                      transport.
                    </li>
                  )}
                  {x.s.authType && (
                    <li>
                      Its auth model fits you:{' '}
                      <strong>{authLabel(x.s.authType)}</strong>.
                    </li>
                  )}
                  {x.s.aiEnvVars && x.s.aiEnvVars.length > 0 && (
                    <li>
                      You have the keys it needs:{' '}
                      <code>{x.s.aiEnvVars.join(', ')}</code>.
                    </li>
                  )}
                  {x.tools.length > 0 && (
                    <li>
                      You want tools like{' '}
                      <code>{x.tools.slice(0, 3).join(', ')}</code>.
                    </li>
                  )}
                </ul>
                <Link
                  href={`/mcp/${x.s.id}`}
                  className="btn btn-secondary btn-sm"
                >
                  Explore {x.name} <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Spec table */}
        <section className="lst-section reveal" aria-labelledby="vs-spec-h">
          <header className="lst-section-head">
            <h2 id="vs-spec-h">Feature &amp; specification comparison</h2>
            <p>Rows where the two servers differ are marked.</p>
          </header>
          <div className="cmp-table-wrap">
            <table
              className="cmp-table"
              style={{ '--cmp-cols': 2 } as CSSProperties}
            >
              <thead>
                <tr className="cmp-row cmp-row--head">
                  <th className="cmp-label" scope="col">
                    <span className="sr-only">Spec</span>
                  </th>
                  {sides.map((x) => (
                    <th key={x.s.id} className="cmp-col-head" scope="col">
                      <Link href={`/mcp/${x.s.id}`} className="cmp-col-id">
                        <ServerAvatar
                          name={x.s.name}
                          logoUrl={x.s.logoUrl}
                          category={x.s.category}
                          size={28}
                        />
                        <span className="cmp-col-name">{x.name}</span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="cmp-group">
                {rows.map((r) => (
                  <tr
                    key={r.label}
                    className={`cmp-row${r.keys[0] !== r.keys[1] ? ' is-diff' : ''}`}
                  >
                    <th className="cmp-label" scope="row">
                      {r.label}
                    </th>
                    {r.cells.map((c, i) => (
                      <td key={sides[i].s.id} className="cmp-cell">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tbody>
                <tr className="cmp-row cmp-row--links">
                  <th className="cmp-label" scope="row">
                    Full listing
                  </th>
                  {sides.map((x) => (
                    <td key={x.s.id} className="cmp-cell">
                      <Link href={`/mcp/${x.s.id}`} className="link-arrow">
                        View {x.name} <ArrowRight size={13} />
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Tools */}
        <section className="lst-section reveal" aria-labelledby="vs-tools-h">
          <header className="lst-section-head">
            <h2 id="vs-tools-h">Tools &amp; capabilities</h2>
          </header>
          <div className="lst-two-up">
            {sides.map((x) => (
              <div key={x.s.id} className="lst-card">
                <h3 className="lst-card-title">
                  {x.name} tools{' '}
                  {(x.s.tools?.length ?? 0) > 0 && (
                    <span className="lst-section-count">
                      {x.s.tools?.length}
                    </span>
                  )}
                </h3>
                {x.tools.length > 0 ? (
                  <ul className="vs-tools">
                    {x.tools.map((t) => {
                      const tool = x.s.tools?.find((item) => item.name === t);
                      return (
                        <li key={t}>
                          <code className="lst-tool-name">{t}</code>
                          {tool?.description && (
                            <span className="lst-tool-desc">
                              {tool.description}
                            </span>
                          )}
                        </li>
                      );
                    })}
                    {(x.s.tools?.length || 0) > x.tools.length && (
                      <li className="cmp-muted">
                        +{(x.s.tools?.length || 0) - x.tools.length} more on the{' '}
                        <Link href={`/mcp/${x.s.id}`}>listing page</Link>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="lst-muted-sm">
                    No tool names declared yet. Check the project README from
                    the <Link href={`/mcp/${x.s.id}`}>listing page</Link>.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Configs */}
        <section className="lst-section reveal" aria-labelledby="vs-config-h">
          <header className="lst-section-head">
            <h2 id="vs-config-h">Ready-to-paste client configs</h2>
            <p>
              Paste either block (or both) into your client config, e.g.{' '}
              <code>claude_desktop_config.json</code> or{' '}
              <code>~/.cursor/mcp.json</code>. We only show a config when the
              install command is confirmed.
            </p>
          </header>
          <div className="lst-two-up vs-configs">
            {sides.map((x) => (
              <div key={x.s.id} className="vs-config">
                <h3 className="lst-card-title">{x.name}</h3>
                {isUnverifiedInstall(x.install) ? (
                  <p className="cmp-config-empty">
                    No confirmed install command for {x.name} yet — follow the
                    setup steps linked from its{' '}
                    <Link href={`/mcp/${x.s.id}`}>listing page</Link> rather
                    than a guessed package name.
                  </p>
                ) : (
                  <CopyBlock
                    className="copyblock--flush"
                    code={x.snippet}
                    serverId={x.s.id}
                    title="mcpServers (Claude Desktop / Cursor)"
                    language="json"
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="lst-section reveal">
          <FaqSection
            className="lst-faq"
            title="Frequently asked questions"
            renderJsonLd={false}
            items={faqItems}
          />
        </section>

        <nav className="vs-more" aria-label="More comparisons">
          <Link
            href={`/mcp/${left.id}/alternatives`}
            className="btn btn-secondary btn-sm"
          >
            More alternatives to {nameL}
          </Link>
          <Link
            href={`/mcp/${right.id}/alternatives`}
            className="btn btn-secondary btn-sm"
          >
            More alternatives to {nameR}
          </Link>
          <Link
            href={`/categories/${categorySlug(left.category)}`}
            className="btn btn-secondary btn-sm"
          >
            {catL} category hub
          </Link>
          {id !== c0 && (
            <Link href={`/mcp/${c0}/vs/${c1}`} className="btn btn-ghost btn-sm">
              Canonical compare URL
            </Link>
          )}
        </nav>

        {(moreAltsLeft.length > 0 || moreAltsRight.length > 0) && (
          <section
            className="lst-section reveal vs-related"
            aria-labelledby="vs-related-h"
          >
            <header className="lst-section-head">
              <h2 id="vs-related-h">Related comparisons</h2>
            </header>
            <div className="lst-two-up">
              {[
                { base: left, baseName: nameL, list: moreAltsLeft },
                { base: right, baseName: nameR, list: moreAltsRight },
              ]
                .filter((g) => g.list.length > 0)
                .map((g) => (
                  <div key={g.base.id}>
                    <h3 className="vs-related-title">
                      Popular comparisons with {g.baseName}
                    </h3>
                    <ul className="vs-related-list">
                      {g.list.map((alt) => {
                        const n = parseServerName(alt.name).displayName;
                        const [a0, a1] = canonicalPair(g.base.id, alt.id);
                        return (
                          <li key={alt.id}>
                            <Link href={`/mcp/${a0}/vs/${a1}`}>
                              <ServerAvatar
                                name={alt.name}
                                logoUrl={alt.logoUrl}
                                size={24}
                              />
                              <span>
                                {g.baseName} vs {n}
                              </span>
                              <ArrowRight size={14} aria-hidden="true" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
