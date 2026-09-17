import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SponsorAdUnit } from '../../../components/ads/SponsorAdUnit';
import { Badge } from '../../../components/ui/Badge';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import {
  TableOfContents,
  type TocItem,
} from '../../../components/ui/TableOfContents';
import { getAllPosts, getPostBySlug } from '../../../lib/blog';
import { extractToc, withHeadingAnchors } from '../../../lib/blogToc';
import { truncateDescription, truncateTitle } from '../../../lib/ogHelpers';

export const dynamic = 'force-static';
export const dynamicParams = true;

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    // Missing post → noindex here and a real 404 from the component (avoids a soft 404).
    return { title: 'Not Found', robots: { index: false, follow: false } };
  }

  const url = `https://allmcps.com/blog/${post.slug}`;
  // Frontmatter titles/excerpts are written for readability on the page and
  // card, not for the <title>/meta-description length budget, so cap them
  // here rather than in lib/blog.ts (which feeds both). 55 chars leaves room
  // for the root layout's auto-appended " | AllMCPs" suffix under ~65 total.
  const metaTitle = truncateTitle(post.title, 55);
  const metaDescription = truncateDescription(post.excerpt, 155);

  return {
    title: metaTitle,
    description: metaDescription,
    keywords: [
      ...(Array.isArray(post.tags) ? post.tags : []),
      'MCP',
      'Model Context Protocol',
    ].join(', '),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${metaTitle} | AllMCPs`,
      description: metaDescription,
      url,
      type: 'article',
      publishedTime: `${post.date}T12:00:00.000Z`,
      modifiedTime: `${post.date}T12:00:00.000Z`,
      authors: ['AllMCPs'],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${metaTitle} | AllMCPs`,
      description: metaDescription,
    },
  };
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    // Real HTTP 404 (via app/not-found.tsx) rather than a 200 "not found" body.
    notFound();
  }

  const url = `https://allmcps.com/blog/${post.slug}`;
  const rawToc = extractToc(post.content);
  const tocItems: TocItem[] = rawToc.map((entry) => ({
    id: entry.slug,
    text: entry.text,
  }));
  const contentWithAnchors = withHeadingAnchors(post.content);
  const wordCount = post.content.trim().split(/\s+/).filter(Boolean).length;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt,
        url,
        image: 'https://allmcps.com/opengraph-image',
        datePublished: post.date,
        dateModified: post.date,
        keywords: post.tags.join(', '),
        articleSection: post.tags,
        inLanguage: 'en-US',
        wordCount,
        timeRequired: `PT${post.readingTime}M`,
        isAccessibleForFree: true,
        author: {
          '@type': 'Organization',
          name: 'AllMCPs',
          url: 'https://allmcps.com',
        },
        publisher: {
          '@type': 'Organization',
          name: 'AllMCPs',
          url: 'https://allmcps.com',
          logo: {
            '@type': 'ImageObject',
            url: 'https://allmcps.com/logo-icon.svg',
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': url,
        },
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
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
      ...(post.faq.length > 0
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: post.faq.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: item.a,
                },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="page-shell page-shell--default">
        <div className="page-shell-inner">
          {/* marginBottom via inline style, not a Tailwind margin utility: this
              project's unlayered CSS reset (star selector, margin 0) overrides
              layered utility classes, so mt-6 here computed to 0. */}
          <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem' }}>
            <ol className="breadcrumb">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li className="breadcrumb-separator">
                <ChevronRight size={12} />
              </li>
              <li>
                <Link href="/blog">Blog</Link>
              </li>
              <li className="breadcrumb-separator">
                <ChevronRight size={12} />
              </li>
              <li className="breadcrumb-current">{post.title}</li>
            </ol>
          </nav>

          <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
            <article className="surface page-panel min-w-0">
              <header>
                <h1 className="text-page-title">{post.title}</h1>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginBottom: '1rem',
                  }}
                >
                  <time
                    dateTime={post.date}
                    className="text-meta"
                    style={{ fontWeight: 600 }}
                  >
                    {formatDate(post.date)}
                  </time>
                  <span className="text-meta">
                    · {post.readingTime} min read
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                    marginBottom: '1.5rem',
                  }}
                >
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="category">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </header>

              {tocItems.length > 1 && (
                // Spacing via inline style, not Tailwind mb-*/mt-*: this project's unlayered
                // CSS reset overrides layered margin utilities (they compute to 0), so the
                // mobile TOC card would otherwise butt right up against the body text.
                <div
                  className="lg:hidden"
                  style={{ marginTop: '1rem', marginBottom: '2.5rem' }}
                >
                  <TableOfContents items={tocItems} />
                </div>
              )}

              <div className="markdown-body">
                <SafeMarkdown content={contentWithAnchors} />
              </div>

              <SponsorAdUnit placement="blog_guide" />

              {post.faq.length > 0 && (
                <div style={{ marginTop: '2.5rem' }}>
                  <h2 className="text-section">Frequently asked questions</h2>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {post.faq.map((item) => (
                      <li
                        key={item.q}
                        style={{ listStyle: 'none', marginBottom: '1.5rem' }}
                      >
                        <h3
                          style={{
                            color: 'var(--text-primary)',
                            fontSize: '1.05rem',
                            marginBottom: '0.4rem',
                          }}
                        >
                          {item.q}
                        </h3>
                        <p
                          style={{
                            color: 'var(--text-secondary)',
                            lineHeight: 1.65,
                            margin: 0,
                          }}
                        >
                          {item.a}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>

            {tocItems.length > 1 && (
              <div className="hidden lg:block h-full">
                <TableOfContents items={tocItems} />
              </div>
            )}
          </div>

          <div style={{ marginTop: '2rem' }}>
            <Link href="/blog" className="btn btn-secondary">
              ← Back to Blog
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
