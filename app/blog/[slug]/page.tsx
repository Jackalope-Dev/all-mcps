import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serializeJsonLd } from '@/lib/jsonLd';
import { SponsorAdUnit } from '../../../components/ads/SponsorAdUnit';
import { ArticleLayout } from '../../../components/content/ArticleLayout';
import { blogTagClass } from '../../../components/content/blogTags';
import { FaqSection } from '../../../components/ui/FaqSection';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import type { TocItem } from '../../../components/ui/TableOfContents';
import { getAllPosts, getPostBySlug, getRelatedPosts } from '../../../lib/blog';
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
  const relatedPosts = getRelatedPosts(post);
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
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ArticleLayout
        crumbs={[{ label: 'Blog', href: '/blog' }, { label: post.title }]}
        title={post.title}
        updated={post.date}
        updatedLabel="Published"
        readingMinutes={post.readingTime}
        meta={
          post.tags.length > 0 ? (
            <span className="content-tags">
              {post.tags.map((tag) => (
                <span key={tag} className={blogTagClass(tag)}>
                  {tag}
                </span>
              ))}
            </span>
          ) : null
        }
        toc={tocItems}
        footer={
          <>
            <SponsorAdUnit placement="blog_guide" />

            {post.faq.length > 0 ? (
              <FaqSection
                title="Frequently asked questions"
                headingId="faq"
                renderJsonLd={false}
                items={post.faq.map((item) => ({
                  question: item.q,
                  answer: item.a,
                }))}
              />
            ) : null}

            {relatedPosts.length > 0 ? (
              <nav aria-labelledby="related-articles">
                <h2 id="related-articles" className="content-section-title">
                  Related articles
                </h2>
                <ul className="content-related">
                  {relatedPosts.map((rp) => (
                    <li key={rp.slug}>
                      <Link
                        href={`/blog/${rp.slug}`}
                        className="content-related-card"
                      >
                        <strong>{rp.title}</strong>
                        <span>{rp.excerpt}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            <p>
              <Link href="/blog" className="link-arrow">
                All articles <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </p>
          </>
        }
      >
        <SafeMarkdown content={contentWithAnchors} />
      </ArticleLayout>
    </>
  );
}
