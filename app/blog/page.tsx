import type { Metadata } from 'next';
import { getAllPosts, getAllTags } from '../../lib/blog';
import { BlogListClient } from '../../components/BlogListClient';

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
      <main className="page-shell page-shell--content">
        <div className="page-shell-inner">
          <header className="page-header">
            <h1 className="text-page-title">Blog</h1>
            <p className="text-lead">Notes on MCP, agents, and the AllMCPs directory.</p>
          </header>

          <BlogListClient posts={posts} tags={tags} />
        </div>
      </main>
    </>
  );
}
