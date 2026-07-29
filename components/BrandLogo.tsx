import Link from 'next/link';

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

/**
 * Canonical AllMCPs mark: geometric M icon (brand cyan→blue) + optional wordmark.
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
      <span className="brand-logo-mark" style={{ width: px, height: px }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-icon.svg"
          alt=""
          width={px}
          height={px}
          aria-hidden="true"
          className="brand-logo-img"
        />
      </span>
      {showWordmark && (
        <span className={`wordmark-text brand-logo-wordmark brand-logo-wordmark-${size}`}>
          <span className="wordmark-all">All</span>
          <span className="wordmark-mcps">MCPs</span>
        </span>
      )}
    </>
  );

  if (href === null) {
    return (
      <span className={`brand-logo ${className}`.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'sm' ? '0.5rem' : '0.75rem' }}>
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
