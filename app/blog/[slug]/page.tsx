import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getAllPosts, getPostBySlug } from '../../../lib/blog';
import { extractToc, withHeadingAnchors } from '../../../lib/blogToc';
import { SafeMarkdown } from '../../../components/ui/SafeMarkdown';
import { Badge } from '../../../components/ui/Badge';
import { TableOfContents, TocItem } from '../../../components/ui/TableOfContents';

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
    return { title: 'Not Found' };
  }

  const url = `https://allmcps.com/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.excerpt,
    keywords: [...post.tags, 'MCP', 'Model Context Protocol'].join(', '),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${post.title} | AllMCPs`,
      description: post.excerpt,
      url,
      type: 'article',
      publishedTime: `${post.date}T12:00:00.000Z`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} | AllMCPs`,
      description: post.excerpt,
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
    return (
      <main className="page-shell page-shell--status">
        <div className="page-shell-inner">
          <div className="surface page-panel">
            <div className="empty-state">
              <h1 className="empty-state-title">Post Not Found</h1>
              <p className="empty-state-body">This blog post may have been moved or the URL is incorrect.</p>
              <div className="empty-state-actions">
                <Link href="/blog" className="btn btn-primary">
                  ← Back to Blog
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const url = `https://allmcps.com/blog/${post.slug}`;
  const rawToc = extractToc(post.content);
  const tocItems: TocItem[] = rawToc.map((entry) => ({
    id: entry.slug,
    text: entry.text,
  }));
  const contentWithAnchors = withHeadingAnchors(post.content);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt,
        url,
        datePublished: post.date,
        dateModified: post.date,
        keywords: post.tags.join(', '),
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
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://allmcps.com/blog' },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="page-shell page-shell--default">
        <div className="page-shell-inner">
          <nav aria-label="Breadcrumb">
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

          <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10 items-start">
            <article className="surface page-panel min-w-0" style={{ marginTop: '1.5rem' }}>
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
                  <time dateTime={post.date} className="text-meta" style={{ fontWeight: 600 }}>
                    {formatDate(post.date)}
                  </time>
                  <span className="text-meta">· {post.readingTime} min read</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="category">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </header>

              {tocItems.length > 1 && (
                <div className="lg:hidden mb-6">
                  <TableOfContents items={tocItems} />
                </div>
              )}

              <div className="markdown-body">
                <SafeMarkdown content={contentWithAnchors} />
              </div>

              {post.faq.length > 0 && (
                <div style={{ marginTop: '2.5rem' }}>
                  <h2 className="text-section">Frequently asked questions</h2>
                  {post.faq.map((item) => (
                    <div key={item.q} style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '0.4rem' }}>
                        {item.q}
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{item.a}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>

            {tocItems.length > 1 && (
              <div className="hidden lg:block pt-6">
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
