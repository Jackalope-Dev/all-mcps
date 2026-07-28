import React from 'react';
import Link from 'next/link';

type BadgeVariant = 'default' | 'official' | 'verified' | 'success' | 'premium' | 'category';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
  /** When set, the badge renders as a link (e.g. category → filtered browse). */
  href?: string;
}

function variantClass(variant: BadgeVariant): string {
  switch (variant) {
    case 'official':
      return 'badge-official';
    case 'verified':
      return 'badge-verified';
    case 'premium':
      return 'badge-premium';
    case 'success':
      return 'badge-success';
    case 'category':
      return 'badge-category';
    default:
      return 'badge-default';
  }
}

export function Badge({
  variant = 'default',
  children,
  style,
  href,
  className = '',
  ...props
}: BadgeProps) {
  const classes = ['badge', variantClass(variant), href ? 'badge-link' : '', className]
    .filter(Boolean)
    .join(' ');

  if (href) {
    return (
      <Link className={classes} style={style} {...(props as React.ComponentProps<typeof Link>)} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <span className={classes} style={style} {...props}>
      {children}
    </span>
  );
}
