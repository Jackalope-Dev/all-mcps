import { ArrowLeft, ChevronRight, FolderGit2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OutboundLink } from '../../../../components/ui/OutboundLink';
import { SafeMarkdown } from '../../../../components/ui/SafeMarkdown';
import { categorySlug, getCategoryMeta } from '../../../../lib/categories';
import { parseServerName } from '../../../../lib/displayName';
import { repoLinkRel } from '../../../../lib/linkRel';
import {
  absolutizeReadmeMarkdown,
  fetchServerReadme,
  getServerById,
} from '../../../../lib/servers';

const SITE = 'https://allmcps.com';

// External README fetch + a D1 read — cache like the parent listing page.
export const revalidate = 3600;

function repoHostLabel(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (h.includes('github')) return 'GitHub';
    if (h.includes('gitlab')) return 'GitLab';
    if (h.includes('bitbucket')) return 'Bitbucket';
    return h;
  } catch {
    return 'the source repository';
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const server = await getServerById(id);
  if (!server) return { title: 'Not Found', robots: { index: false } };

  const { displayName } = parseServerName(server.name, server.url);
  // Deliberately noindex: this page mirrors the upstream README, which Google
  // already indexed at the source. `follow` so link equity still flows back to
  // the listing page. The canonical listing page carries the unique writeup.
  return {
    title: `${displayName} README`,
    description: `The full upstream README for the ${displayName} MCP server, mirrored for quick reference. The install config, tools, and an original overview are on the listing page.`,
    robots: { index: false, follow: true },
    alternates: { canonical: `${SITE}/mcp/${server.id}/readme` },
  };
}

export default async function ListingReadmePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServerById(id);
  if (!server) notFound();

  const { displayName } = parseServerName(server.name, server.url);
  const catMeta = getCategoryMeta(server.category);
  const catSlug = categorySlug(server.category);
  const listingUrl = `/mcp/${server.id}`;
  const host = repoHostLabel(server.url);

  const readme = await fetchServerReadme(server.url);

  return (
    <main
      className="container page-shell"
      style={{ paddingTop: 'var(--space-8)', paddingBottom: '4rem' }}
    >
      <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem' }}>
        <ol className="breadcrumb">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li className="breadcrumb-separator" aria-hidden="true">
            <ChevronRight size={12} />
          </li>
          <li>
            <Link href={`/categories/${catSlug}`}>{catMeta.label}</Link>
          </li>
          <li className="breadcrumb-separator" aria-hidden="true">
            <ChevronRight size={12} />
          </li>
          <li>
            <Link href={listingUrl}>{displayName}</Link>
          </li>
          <li className="breadcrumb-separator" aria-hidden="true">
            <ChevronRight size={12} />
          </li>
          <li className="breadcrumb-current" aria-current="page">
            README
          </li>
        </ol>
      </nav>

      <header style={{ marginBottom: '1.75rem', maxWidth: '820px' }}>
        <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
          {displayName} README
        </h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            margin: '0 0 1rem',
          }}
        >
          The full upstream README, mirrored here for reference. Install config,
          tool schemas, adoption signals, and an original overview live on the{' '}
          <Link href={listingUrl}>{displayName} listing page</Link>.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '1.25rem',
            flexWrap: 'wrap',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <Link
            href={listingUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back to {displayName}
          </Link>
          <OutboundLink
            href={server.url}
            destinationType="github"
            serverId={server.id}
            target="_blank"
            rel={repoLinkRel(!!server.isPremium, !!server.isOfficial)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <FolderGit2 size={15} aria-hidden="true" /> View source on {host}
          </OutboundLink>
        </div>
      </header>

      <div className="detail-readme-scroll">
        <div className="markdown-body">
          {readme ? (
            <SafeMarkdown
              content={absolutizeReadmeMarkdown(readme, server.url)}
              utmContent={server.id}
              repoUrl={server.url}
            />
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>
              We couldn&rsquo;t automatically pull a README for this listing
              from {host}. Open the{' '}
              <OutboundLink
                href={server.url}
                destinationType="github"
                serverId={server.id}
                target="_blank"
                rel={repoLinkRel(!!server.isPremium, !!server.isOfficial)}
              >
                source repository
              </OutboundLink>{' '}
              for setup instructions and documentation.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
