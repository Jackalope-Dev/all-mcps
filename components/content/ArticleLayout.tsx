import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { TableOfContents, type TocItem } from '@/components/ui/TableOfContents';
import { STATIC_PAGE_LASTMOD } from '@/lib/sitemapHelpers';
import {
  GUIDE_TOPICS,
  guideByHref,
  guideNeighbors,
  guideTopicHue,
} from './guideCatalog';

interface Crumb {
  label: string;
  href?: string;
}

interface ArticleLayoutProps {
  /** Canonical path of this page — used for the "Updated" date
   *  (STATIC_PAGE_LASTMOD) and guide pagination/reading time (guideCatalog). */
  path?: string;
  crumbs: Crumb[];
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** Overrides the STATIC_PAGE_LASTMOD lookup (e.g. blog post dates). */
  updated?: string;
  updatedLabel?: string;
  readingMinutes?: number;
  /** Extra items in the meta row (tags, badges). */
  meta?: React.ReactNode;
  toc?: TocItem[];
  children: React.ReactNode;
  /** Rendered after the prose, before pagination (FAQ, related, ads). */
  footer?: React.ReactNode;
  /** Wrap children in .markdown-body (default) — off for custom bodies. */
  prose?: boolean;
  /** Show the scroll-driven reading progress bar (default true). */
  progress?: boolean;
  /** Identity tile shown above the title (e.g. a prompt workflow's icon). */
  icon?: React.ReactNode;
}

function formatArticleDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The one article layout for guides, blog posts and other long reads:
 * breadcrumb, title, lede, meta, a sticky right-rail TOC with scroll-spy
 * (collapsible bar on mobile), a ~70ch prose column, then FAQ / related /
 * prev-next pagination. Server component; only the TOC is client JS.
 */
export function ArticleLayout({
  path,
  crumbs,
  title,
  lede,
  updated,
  updatedLabel = 'Updated',
  readingMinutes,
  meta,
  toc,
  children,
  footer,
  prose = true,
  progress = true,
  icon,
}: ArticleLayoutProps) {
  const guide = path ? guideByHref(path) : undefined;
  const date = updated ?? (path ? STATIC_PAGE_LASTMOD[path] : undefined);
  const minutes = readingMinutes ?? guide?.readMinutes;
  const { prev, next } = path ? guideNeighbors(path) : {};
  const hasToc = Boolean(toc && toc.length > 1);
  const topicLabel = guide
    ? GUIDE_TOPICS.find((t) => t.id === guide.topic)?.label
    : undefined;

  return (
    <main className="page-shell content-page">
      {progress ? (
        <div className="content-progress" aria-hidden="true" />
      ) : null}
      <div className="page-shell-inner">
        <div className={`content-grid ${hasToc ? 'has-toc' : ''}`}>
          <article className="content-article">
            <header className="content-head">
              <nav aria-label="Breadcrumb">
                <ol className="crumbs">
                  {crumbs.map((c) => (
                    <li key={c.label}>
                      {c.href ? (
                        <Link href={c.href}>{c.label}</Link>
                      ) : (
                        <span aria-current="page">{c.label}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
              {icon ? <div className="content-head-icon">{icon}</div> : null}
              <h1 className="content-title">{title}</h1>
              {lede ? <div className="content-lede">{lede}</div> : null}
              {date || minutes || meta || topicLabel ? (
                <div className="content-meta">
                  {guide && topicLabel ? (
                    <span
                      className={`tint-pill hue-${guideTopicHue(guide.topic)}`}
                    >
                      {topicLabel}
                    </span>
                  ) : null}
                  {date ? (
                    <span>
                      {updatedLabel}{' '}
                      <time dateTime={date}>{formatArticleDate(date)}</time>
                    </span>
                  ) : null}
                  {minutes ? <span>{minutes} min read</span> : null}
                  {meta}
                </div>
              ) : null}
            </header>

            {hasToc && toc ? (
              <div className="content-toc-inline">
                <TableOfContents items={toc} variant="inline" />
              </div>
            ) : null}

            {prose ? (
              <div className="markdown-body content-prose">{children}</div>
            ) : (
              children
            )}

            {footer ? <div className="content-footer">{footer}</div> : null}

            {prev || next ? (
              <nav className="content-pager" aria-label="More guides">
                {prev ? (
                  <Link href={prev.href} className="content-pager-link">
                    <span className="content-pager-dir">
                      <ArrowLeft size={14} aria-hidden="true" /> Previous
                    </span>
                    <span className="content-pager-title">
                      {prev.shortTitle}
                    </span>
                  </Link>
                ) : (
                  <span />
                )}
                {next ? (
                  <Link
                    href={next.href}
                    className="content-pager-link content-pager-link--next"
                  >
                    <span className="content-pager-dir">
                      Next <ArrowRight size={14} aria-hidden="true" />
                    </span>
                    <span className="content-pager-title">
                      {next.shortTitle}
                    </span>
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </article>

          {hasToc && toc ? (
            <aside className="content-rail">
              <TableOfContents items={toc} variant="rail" />
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}
