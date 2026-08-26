import React from 'react';
import Link from 'next/link';

type CardPadding = 'sm' | 'md' | 'lg';

interface CardProps extends React.HTMLAttributes<HTMLDivElement | HTMLAnchorElement> {
  href?: string;
  hoverable?: boolean;
  /** Surface treatment: solid (default), muted, or glass chrome */
  surface?: 'solid' | 'muted' | 'glass';
  /**
   * Optional accent color (any CSS color) for the card's top edge + icon/number
   * chips inside it — set via the `--card-accent` custom property so callers can
   * read it in nested markup (e.g. `style={{ color: 'var(--card-accent)' }}`)
   * instead of hand-rolling their own colored-surface CSS per use case.
   */
  accent?: string;
  /** Inner padding scale — defaults to the existing `.surface`/`.card-padded` rhythm. */
  padding?: CardPadding;
}

export function Card({
  href,
  hoverable = false,
  surface = 'solid',
  accent,
  padding,
  children,
  className = '',
  style,
  ...props
}: CardProps) {
  const surfaceClass =
    hoverable || href
      ? 'surface-interactive'
      : surface === 'glass'
        ? 'surface-glass'
        : surface === 'muted'
          ? 'surface-muted'
          : 'surface';

  const paddingClass = padding ? `card-padding-${padding}` : '';
  const accentClass = accent ? 'card-accent' : '';

  const baseClass = `${surfaceClass} ${hoverable || href ? 'card-hoverable' : ''} ${paddingClass} ${accentClass} ${className}`.trim();
  const mergedStyle = accent ? { ...style, '--card-accent': accent } as React.CSSProperties : style;

  if (href) {
    return (
      <Link className={baseClass} style={mergedStyle} {...(props as React.ComponentProps<typeof Link>)} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <div className={baseClass} style={mergedStyle} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
      {children}
    </div>
  );
}
