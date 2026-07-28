import DirectoryGrid from '../../components/DirectoryGrid';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../../db/schema';
import { desc, eq } from 'drizzle-orm';
import serversData from '../../data/mcp-servers.json';
import type { Metadata } from 'next';
import { PUBLIC_SERVER_COLUMNS } from '../../lib/servers';

type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
  isPremium?: boolean;
  views?: number;
  copies?: number;
  upvotes?: number;
  createdAt?: string;
};

async function getServers(): Promise<Server[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db
        .select(PUBLIC_SERVER_COLUMNS)
        .from(serversTable)
        .where(eq(serversTable.status, 'active'))
        .orderBy(desc(serversTable.createdAt));
      return dbServers as unknown as Server[];
    }
  } catch {
    // Fallback to local JSON if not running in wrangler / opennext
  }

  return serversData as Server[];
}

function parseCategoryLabel(category: string): string {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const first = segmenter.segment(category)[Symbol.iterator]().next().value;
    if (first) {
      const char = first.segment;
      if (/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(char)) {
        return category.slice(char.length).trimStart();
      }
    }
  }
  const match = category.match(/^(\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic}|\uFE0F)*)\s*/u);
  if (match) return category.slice(match[0].length);
  return category;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const category = typeof params.category === 'string' ? params.category : undefined;
  const q = typeof params.q === 'string' ? params.q : undefined;

  if (category) {
    const label = parseCategoryLabel(category);
    return {
      title: `${label} MCP Servers`,
      description: `Browse Model Context Protocol servers in the ${label} category. Find and install the best AI agent tools on AllMCPs.`,
      alternates: {
        canonical: `https://allmcps.com/browse?category=${encodeURIComponent(category)}`,
      },
    };
  }

  if (q) {
    return {
      title: `Search: ${q}`,
      description: `MCP servers matching “${q}” on AllMCPs.`,
      alternates: {
        canonical: `https://allmcps.com/browse?q=${encodeURIComponent(q)}`,
      },
    };
  }

  return {
    title: 'Browse MCP Servers',
    description:
      'Browse and search thousands of Model Context Protocol servers. Filter by category, sort by trending or newest, and find the right tools for your AI agents.',
    alternates: {
      canonical: 'https://allmcps.com/browse',
    },
    openGraph: {
      title: 'Browse MCP Servers | AllMCPs',
      description:
        'Browse and search thousands of Model Context Protocol servers. Filter by category, sort by trending or newest.',
      url: 'https://allmcps.com/browse',
    },
  };
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const category = typeof params.category === 'string' ? params.category : null;
  const q = typeof params.q === 'string' ? params.q : '';

  const servers = await getServers();

  return (
    <main>
      <DirectoryGrid
        initialServers={servers}
        initialCategory={category}
        initialQuery={q}
        variant="browse"
      />
    </main>
  );
}
