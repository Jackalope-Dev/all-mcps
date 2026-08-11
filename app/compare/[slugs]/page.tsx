import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { getServerById, type Server } from '@/lib/servers';
import { MultiServerCompareView } from '@/components/MultiServerCompareView';

// No session/auth reads on this page — safe to ISR like the other listing pages
// instead of re-querying every id from D1 on every single visit.
export const revalidate = 3600;

function canonicalPair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

export async function generateMetadata({ params }: { params: Promise<{ slugs: string }> }): Promise<Metadata> {
  const { slugs } = await params;
  const ids = slugs.split(/-vs-|,/).map((s) => s.trim()).filter(Boolean);

  if (ids.length === 2) {
    const [c0, c1] = canonicalPair(ids[0], ids[1]);
    return {
      title: 'Redirecting to Comparison',
      alternates: { canonical: `https://allmcps.com/mcp/${c0}/vs/${c1}` },
    };
  }

  const servers = (await Promise.all(ids.map((id) => getServerById(id)))).filter(
    (s): s is Server => Boolean(s)
  );

  if (servers.length === 0) {
    return { title: 'Comparison Not Found', robots: { index: false } };
  }

  const names = servers.map((s) => s.name).join(' vs. ');
  return {
    title: `${names} Comparison | AllMCPs`,
    description: `Side-by-side comparison of ${names} MCP servers. Evaluate tool features, GitHub stars, installation configs, and specs.`,
    robots: { index: false, follow: true },
    alternates: {
      canonical: `https://allmcps.com/compare/${slugs}`,
    },
  };
}

export default async function CompareMatrixPage({ params }: { params: Promise<{ slugs: string }> }) {
  const { slugs } = await params;
  const ids = slugs.split(/-vs-|,/).map((s) => s.trim()).filter(Boolean);

  if (ids.length === 2) {
    const [c0, c1] = canonicalPair(ids[0], ids[1]);
    redirect(`/mcp/${c0}/vs/${c1}`);
  }

  const servers = (await Promise.all(ids.map((id) => getServerById(id)))).filter(
    (s): s is Server => Boolean(s)
  );

  if (servers.length < 2) {
    notFound();
  }

  const titleNames = servers.map((s) => s.name).join(' vs. ');
  const canonicalUrl = `https://allmcps.com/compare/${slugs}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: `${titleNames} — Multi-Server MCP Comparison`,
        description: `Side-by-side comparative analysis of ${titleNames} Model Context Protocol (MCP) servers.`,
        url: canonicalUrl,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: 'https://allmcps.com' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Compare', item: 'https://allmcps.com/compare' },
          { '@type': 'ListItem', position: 3, name: titleNames, item: canonicalUrl },
        ],
      },
      {
        '@type': 'ItemList',
        name: `${titleNames} Comparison List`,
        numberOfItems: servers.length,
        itemListElement: servers.map((s, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'SoftwareApplication',
            name: s.name,
            applicationCategory: s.category,
            url: `https://allmcps.com/mcp/${s.id}`,
          },
        })),
      },
    ],
  };

  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MultiServerCompareView servers={servers} />
    </PageShell>
  );
}

