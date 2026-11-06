import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { hubPagePath } from '@/lib/categoryPagination';

/**
 * Numbered pager for category and tag hubs. Plain links (no nofollow, no JS)
 * so crawlers can walk every page; the hub caps the page count, so listing
 * every number stays short.
 */
export function HubPagination({
  base,
  page,
  pageCount,
  label,
}: {
  /** Hub path without a page segment, e.g. /categories/databases. */
  base: string;
  page: number;
  pageCount: number;
  /** What the pages list, for the landmark label ("Databases servers"). */
  label: string;
}) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  return (
    <nav className="dir-pager" aria-label={`${label} pages`}>
      {page > 1 ? (
        <Link
          href={hubPagePath(base, page - 1)}
          className="btn btn-secondary btn-sm"
        >
          <ArrowLeft size={14} aria-hidden="true" /> Previous
        </Link>
      ) : null}
      <ol className="dir-pager-list">
        {pages.map((n) => (
          <li key={n}>
            {n === page ? (
              <span className="dir-pager-num is-current" aria-current="page">
                {n}
              </span>
            ) : (
              <Link href={hubPagePath(base, n)} className="dir-pager-num">
                {n}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {page < pageCount ? (
        <Link
          href={hubPagePath(base, page + 1)}
          className="btn btn-secondary btn-sm"
        >
          Next <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}
