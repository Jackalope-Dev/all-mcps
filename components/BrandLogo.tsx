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

function BrandMark({ px }: { px: number }) {
  const gradId = `allmcps-grad-${useId().replace(/:/g, '')}`;

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
        {/* Electric Cyan -> Blue Gradient */}
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#007BFF" />
        </linearGradient>
      </defs>

      {/* Terminal / Hardware Chassis Tile */}
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="7"
        fill="#070d19"
        stroke="rgba(0, 229, 255, 0.25)"
        strokeWidth="1.2"
      />

      {/* Crosshair Corner Marks for Dev-Tool Vibe */}
      <path
        d="M 6 4 V 6 H 4 M 26 4 V 6 H 28 M 6 28 V 26 H 4 M 26 28 V 26 H 28"
        stroke="rgba(0, 229, 255, 0.4)"
        strokeWidth="0.8"
        strokeLinecap="round"
      />

      {/* Model Prompt Chevron: > */}
      <path
        d="M 8.5 9.5 L 14.5 16 L 8.5 22.5"
        stroke={`url(#${gradId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Protocol / Server Socket Bracket: ] */}
      <path
        d="M 18.5 9.5 H 23.5 V 22.5 H 18.5"
        stroke="#38BDF8"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Connection Signal Dot */}
      <circle cx="21" cy="16" r="1.4" fill="#00E5FF" />
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
