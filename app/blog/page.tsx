import type { Metadata } from 'next';
import { getAllPosts, getAllTags } from '../../lib/blog';
import { BlogListClient } from '../../components/BlogListClient';
import { PageShell, PageHeader } from '../../components/PageShell';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Blog: MCP News, Guides & Directory Updates',
  description:
    'News, guides, and troubleshooting for the Model Context Protocol — server directory updates, agent tooling, and installation how-tos.',
  alternates: {
    canonical: 'https://allmcps.com/blog',
    types: {
      'application/rss+xml': 'https://allmcps.com/blog/rss.xml',
    },
  },
  openGraph: {
    images: [{ url: 'https://allmcps.com/opengraph-image', width: 1200, height: 630, alt: 'AllMCPs' }],
    title: 'Blog: MCP News, Guides & Directory Updates | AllMCPs',
    description:
      'News, guides, and troubleshooting for the Model Context Protocol — server directory updates, agent tooling, and installation how-tos.',
    url: 'https://allmcps.com/blog',
  },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const tags = getAllTags();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        name: 'AllMCPs Blog',
        url: 'https://allmcps.com/blog',
        blogPost: posts.map((post) => ({
          '@type': 'BlogPosting',
          headline: post.title,
          url: `https://allmcps.com/blog/${post.slug}`,
          datePublished: post.date,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://allmcps.com/blog' },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageShell variant="default">
        <PageHeader
          kicker="[ 01 / 02 ] · Editorial & Technical Guides //"
          title="AllMCPs Blog & Guides"
          description="In-depth tutorials, protocol deep dives, and production architecture notes for Model Context Protocol builders."
        />

        <BlogListClient posts={posts} tags={tags} />
      </PageShell>
    </>
  );
}
