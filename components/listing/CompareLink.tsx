'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { isCuratedPair } from '@/lib/comparePairs';

/**
 * "Compare" link from a listing to `/mcp/[a]/vs/[b]`. Curated pairs get a real
 * link (they are the indexable ones). Every other pair is a button that
 * navigates on click: there are ~a billion possible pairs, and as crawlable
 * hrefs on every listing and alternatives page they let scrapers fan out into
 * ~190k fresh renders a day, each a D1 load, Worker CPU, and a new ISR object
 * in R2. People still get the same page; crawlers just aren't handed the URLs.
 */
export function CompareLink({
  a,
  b,
  className,
  style,
  children,
}: {
  a: string;
  b: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const router = useRouter();
  const href = `/mcp/${a}/vs/${b}`;
  if (isCuratedPair(a, b)) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={
        className ? `compare-link-btn ${className}` : 'compare-link-btn'
      }
      style={style}
    >
      {children}
    </button>
  );
}
