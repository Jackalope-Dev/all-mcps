import { ArrowRight, BadgeCheck, Download, Eye } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClientLogo } from '@/components/ClientLogo';
import { serializeJsonLd } from '@/lib/jsonLd';
import { ClientConfigSection } from '../../../components/clients/ClientConfigSection';
import { ServerConfigCopyButton } from '../../../components/clients/ServerConfigCopyButton';
import { FaqSection } from '../../../components/ui/FaqSection';
import { IconTooltip } from '../../../components/ui/IconTooltip';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import { ServerAvatar } from '../../../components/ui/ServerAvatar';
import { MCP_CLIENTS, mcpClientBySlug } from '../../../lib/clients';
import { parseServerName } from '../../../lib/displayName';
import { isVerifiedListing } from '../../../lib/featuredStatus';
import { formatCompactNumber } from '../../../lib/format';
import { getPopularServers } from '../../../lib/servers';

const SITE = 'https://allmcps.com';
const TOP_N = 12;

// ISR instead of force-dynamic: only 9 fixed client slugs, so pre-render all of
// them and refresh hourly instead of re-scanning and re-parsing the entire
// ~3k-listing catalog from D1 on every single visitor request.
export const revalidate = 3600;

export function generateStaticParams() {
  return MCP_CLIENTS.map((c) => ({ client: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ client: string }>;
}): Promise<Metadata> {
  const { client } = await params;
  const c = mcpClientBySlug(client);
  if (!c) return { title: 'Not Found' };

  // c.name / c.lead come from lib/clients.ts and aren't all sized for a search
  // snippet — override per-slug where the default would blow past the SEO
  // title/description budget, otherwise fall back to the generated defaults.
  const metaTitleOverrides: Record<string, string> = {
    cursor: 'How to Install MCP Servers in Cursor IDE',
    windsurf: 'How to Install MCP Servers in Windsurf IDE',
    'vs-code': 'MCP Servers for VS Code (GitHub Copilot)',
  };
  const metaDescriptionOverrides: Record<string, string> = {
    'claude-desktop':
      'How to install and configure MCP servers in Claude Desktop on macOS and Windows, including the config file location and JSON shape.',
  };

  const title =
    metaTitleOverrides[c.slug] ?? `How to Install MCP Servers in ${c.name}`;
  const description = metaDescriptionOverrides[c.slug] ?? c.lead;
  const url = `${SITE}/clients/${c.slug}`;
  return {
    title,
    description,
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

export default async function ClientPage({
  params,
}: {
  params: Promise<{ client: string }>;
}) {
  const { client } = await params;
  const c = mcpClientBySlug(client);
  if (!c) notFound();

  const popular = await getPopularServers(TOP_N);

  const url = `${SITE}/clients/${c.slug}`;
  const heading = `How to Install MCP Servers in ${c.name}`;

  const dedicatedLandingSlug =
    c.slug === 'claude-desktop'
      ? 'mcp-for-claude-desktop'
      : c.slug === 'cursor'
        ? 'mcp-for-cursor'
        : c.slug === 'cline'
          ? 'mcp-for-cline'
          : c.slug === 'windsurf'
            ? 'mcp-for-windsurf'
            : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HowTo',
        name: heading,
        description: c.lead,
        url,
        step: c.steps.map((s, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: s.title,
          text: s.body,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: c.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'MCP Clients',
            item: `${SITE}/clients`,
          },
          { '@type': 'ListItem', position: 3, name: c.name, item: url },
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
      <main className="page-shell content-page cl-page">
        <div className="page-shell-inner">
          <header className="content-hub-head cl-head animate-in">
            <nav aria-label="Breadcrumb">
              <ol className="crumbs">
                <li>
                  <Link href="/">Home</Link>
                </li>
                <li>
                  <Link href="/clients">MCP Clients</Link>
                </li>
                <li>
                  <span aria-current="page">{c.name}</span>
                </li>
              </ol>
            </nav>
            <ClientLogo
              slug={c.slug}
              name={c.name}
              size={56}
              className="cl-head-logo"
            />
            <h1 className="content-hub-title cl-title">{heading}</h1>
            <p className="content-hub-lede">{c.lead}</p>
            {dedicatedLandingSlug ? (
              <Link
                href={`/${dedicatedLandingSlug}`}
                className="link-arrow cl-head-link"
              >
                Browse {c.name} servers directory{' '}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            ) : null}
          </header>

          <section className="cl-setup" aria-labelledby="setup-steps">
            <div className="cl-steps">
              <h2 id="setup-steps" className="content-section-title">
                Step-by-step installation guide
              </h2>
              <ol className="cl-stepper">
                {c.steps.map((s, i) => (
                  <li key={s.title} className="cl-step">
                    <span className="cl-step-num tabular" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className="cl-step-body">
                      <h3 className="cl-step-title">{s.title}</h3>
                      <p className="cl-step-text">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="cl-config-wrap">
              <ClientConfigSection client={c} featuredServers={popular} />
            </div>
          </section>

          <section className="cl-section" aria-labelledby="popular-servers">
            <div className="cl-section-head">
              <h2 id="popular-servers" className="content-section-title">
                Popular MCP servers to try in {c.name}
              </h2>
              {dedicatedLandingSlug ? (
                <Link href={`/${dedicatedLandingSlug}`} className="link-arrow">
                  View all compatible servers{' '}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ) : null}
            </div>

            {popular.length > 0 ? (
              <ul className="cl-servers">
                {popular.map((server) => {
                  const { displayName, org } = parseServerName(server.name);
                  return (
                    <li key={server.id} className="cl-server">
                      <div className="cl-server-head">
                        <ServerAvatar
                          name={server.name}
                          logoUrl={server.logoUrl}
                          size={36}
                        />
                        <div className="cl-server-name">
                          <Link href={`/mcp/${server.id}`}>{displayName}</Link>
                          {org ? <span>{org}</span> : null}
                        </div>
                        {isVerifiedListing(server) && (
                          <IconTooltip
                            label="Verified listing"
                            asSpan
                            trigger={
                              <span className="cl-server-verified">
                                <BadgeCheck size={16} />
                              </span>
                            }
                          >
                            <span className="mcp-icon-tooltip-title">
                              <BadgeCheck
                                size={14}
                                color="var(--accent-color)"
                              />{' '}
                              Verified Listing
                            </span>
                            <span className="mcp-icon-tooltip-body">
                              Ownership or active status confirmed on AllMCPs.
                            </span>
                          </IconTooltip>
                        )}
                      </div>
                      <div className="cl-server-desc">
                        <SafeMarkdown
                          content={
                            server.description || 'No description provided.'
                          }
                          isInline
                        />
                      </div>
                      <div className="cl-server-foot">
                        <span className="cl-server-stats tabular">
                          <span
                            title={`${(server.views || 0).toLocaleString()} views`}
                          >
                            <Eye size={12} aria-hidden="true" />{' '}
                            {formatCompactNumber(server.views || 0)}
                          </span>
                          <span
                            title={`${(server.copies || 0).toLocaleString()} installs`}
                          >
                            <Download size={12} aria-hidden="true" />{' '}
                            {formatCompactNumber(server.copies || 0)}
                          </span>
                        </span>
                        <ServerConfigCopyButton
                          clientSlug={c.slug}
                          serverName={server.name}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="content-empty">
                <strong>No servers to show yet</strong>
                <p>
                  <Link href="/browse">Browse the directory</Link> to find one
                  to install.
                </p>
              </div>
            )}
          </section>

          <section className="cl-section cl-narrow">
            <FaqSection
              title="Frequently Asked Questions"
              headingId="faq"
              renderJsonLd={false}
              items={c.faq}
            />
          </section>

          <section
            className="cl-section cl-narrow"
            aria-labelledby="other-clients"
          >
            <h2 id="other-clients" className="content-section-title">
              Install MCP servers in other clients
            </h2>
            <ul className="cl-others">
              {MCP_CLIENTS.filter((o) => o.slug !== c.slug).map((o) => (
                <li key={o.slug}>
                  <Link href={`/clients/${o.slug}`} className="chip">
                    {o.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
