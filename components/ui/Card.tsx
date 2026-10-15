import Link from 'next/link';
import type React from 'react';

type CardPadding = 'sm' | 'md' | 'lg';

interface CardProps
  extends React.HTMLAttributes<HTMLDivElement | HTMLAnchorElement> {
  href?: string;
  hoverable?: boolean;
  /** Surface treatment: solid (default), muted, or glass chrome */
  surface?: 'solid' | 'muted' | 'glass';
  /** Inner padding scale — defaults to the existing `.surface`/`.card-padded` rhythm. */
  padding?: CardPadding;
  /** Adds subtle radial glow / border glow effect */
  glow?: boolean;
}

export function Card({
  href,
  hoverable = false,
  surface = 'solid',
  padding,
  glow = false,
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
  const glowClass = glow ? 'card-glow' : '';

  const baseClass =
    `${surfaceClass} ${hoverable || href ? 'card-hoverable' : ''} ${paddingClass} ${glowClass} ${className}`.trim();

  if (href) {
    return (
      <Link
        className={baseClass}
        style={style}
        {...(props as React.ComponentProps<typeof Link>)}
        href={href}
      >
        {children}
      </Link>
    );
  }

  return (
    <div
      className={baseClass}
      style={style}
      {...(props as React.HTMLAttributes<HTMLDivElement>)}
    >
      {children}
    </div>
  );
}
