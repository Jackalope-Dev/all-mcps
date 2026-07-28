import React from 'react';
import Link from 'next/link';

interface CardProps extends React.HTMLAttributes<HTMLDivElement | HTMLAnchorElement> {
  href?: string;
  hoverable?: boolean;
  /** Surface treatment: solid (default), muted, or glass chrome */
  surface?: 'solid' | 'muted' | 'glass';
}

export function Card({
  href,
  hoverable = false,
  surface = 'solid',
  children,
  className = '',
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

  const baseClass = `${surfaceClass} ${hoverable || href ? 'card-hoverable' : ''} ${className}`.trim();

  if (href) {
    return (
      <Link className={baseClass} {...(props as React.ComponentProps<typeof Link>)} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <div className={baseClass} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
      {children}
    </div>
  );
}
