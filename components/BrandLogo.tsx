'use client';

import Link from 'next/link';
import { useId } from 'react';

type BrandLogoProps = {
  /** Icon pixel size */
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  href?: string | null;
  className?: string;
};

const SIZES = {
  sm: 28,
  md: 36,
  lg: 48,
} as const;

/** The canonical cyan "M" (public/logo-icon.svg, BRAND_GUIDE.md §5). */
function BrandMark({ px }: { px: number }) {
  const id = useId().replace(/:/g, '');
  const pillarGrad = `allmcps-pillar-${id}`;
  const vGrad = `allmcps-v-${id}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="brand-logo-img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={pillarGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#007BFF" />
        </linearGradient>
        <linearGradient id={vGrad} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#007BFF" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <rect
        x="4"
        y="5"
        width="6"
        height="22"
        rx="2"
        fill={`url(#${pillarGrad})`}
      />
      <rect
        x="22"
        y="5"
        width="6"
        height="22"
        rx="2"
        fill={`url(#${pillarGrad})`}
      />
      <path
        d="M 6.5 5.5 L 16 18 L 25.5 5.5 C 26.3 4.4 27.9 4.8 28.2 6.1 C 28.5 7.1 27.9 8.2 27 8.8 L 17.6 20.8 C 16.8 21.8 15.2 21.8 14.4 20.8 L 5 8.8 C 4.1 8.2 3.5 7.1 3.8 6.1 C 4.1 4.8 5.7 4.4 6.5 5.5 Z"
        fill={`url(#${vGrad})`}
      />
      <circle cx="16" cy="18" r="2.25" fill="#00E5FF" />
      <circle cx="16" cy="18" r="1.1" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * Canonical AllMCPs mark: Pure, high-impact typographic wordmark (Linear/Stripe style).
 */
export function BrandLogo({
  size = 'md',
  showWordmark = true,
  href = '/',
  className = '',
}: BrandLogoProps) {
  const px = SIZES[size];

  const inner = (
    <>
      {!showWordmark && (
        <span className="brand-logo-mark" style={{ width: px, height: px }}>
          <BrandMark px={px} />
        </span>
      )}
      {showWordmark && (
        <span
          className={`wordmark-text brand-logo-wordmark brand-logo-wordmark-${size}`}
        >
          <span className="wordmark-all">All</span>
          <span className="wordmark-mcps">MCPs</span>
        </span>
      )}
    </>
  );

  if (href === null) {
    return (
      <span
        className={`brand-logo ${className}`.trim()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: size === 'sm' ? '0.5rem' : '0.75rem',
        }}
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`brand-logo logo wordmark animate-fade-in ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? '0.5rem' : '0.75rem',
        textDecoration: 'none',
        color: 'inherit',
      }}
      aria-label="Go to AllMCPs Homepage"
    >
      {inner}
    </Link>
  );
}
