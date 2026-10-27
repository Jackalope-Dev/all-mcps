import { Rss } from 'lucide-react';
import type { Metadata } from 'next';
import { serializeJsonLd } from '@/lib/jsonLd';
import { BlogListClient } from '../../components/BlogListClient';
import { getAllPosts, getFilterTags } from '../../lib/blog';

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
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Blog: MCP News, Guides & Directory Updates | AllMCPs',
    description:
      'News, guides, and troubleshooting for the Model Context Protocol — server directory updates, agent tooling, and installation how-tos.',
    url: 'https://allmcps.com/blog',
  },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const tags = getFilterTags();

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
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://allmcps.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: 'https://allmcps.com/blog',
          },
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
      <main className="page-shell content-page content-hub">
        <div className="page-shell-inner">
          <header className="content-hub-head content-hub-head--split animate-in">
            <div>
              <h1 className="content-hub-title">AllMCPs Blog &amp; Guides</h1>
              <p className="content-hub-lede">
                In-depth tutorials, protocol deep dives, and production
                architecture notes for Model Context Protocol builders.
              </p>
            </div>
            <a
              href="/blog/rss.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
            >
              <Rss size={14} aria-hidden="true" /> RSS feed
            </a>
          </header>

          <BlogListClient posts={posts} tags={tags} />
        </div>
      </main>
    </>
  );
}
