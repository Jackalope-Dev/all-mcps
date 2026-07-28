import React from 'react';
import Link from 'next/link';

type BadgeVariant = 'default' | 'official' | 'success' | 'category';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
  /** When set, the badge renders as a link (e.g. category → filtered browse). */
  href?: string;
}

function getVariantStyle(variant: BadgeVariant): React.CSSProperties {
  switch (variant) {
    case 'official':
      return {
        background: 'rgba(16, 185, 129, 0.1)',
        color: '#10b981',
        border: '1px solid rgba(16, 185, 129, 0.2)',
      };
    case 'success':
      return {
        background: 'rgba(59, 130, 246, 0.1)',
        color: '#3b82f6',
        border: '1px solid rgba(59, 130, 246, 0.2)',
      };
    case 'category':
      return {
        background: 'rgba(255, 255, 255, 0.08)',
        color: 'var(--text-secondary)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      };
    default:
      return {
        background: 'rgba(0, 0, 0, 0.5)',
        color: 'var(--text-secondary)',
        borderRadius: '4px',
      };
  }
}

export function Badge({ variant = 'default', children, style, href, className = '', ...props }: BadgeProps) {
  const baseStyle: React.CSSProperties = {
    padding: '0.25rem 0.75rem',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    ...getVariantStyle(variant),
    ...style,
  };

  const classes = ['badge', href ? 'badge-link' : '', className].filter(Boolean).join(' ');

  if (href) {
    return (
      <Link href={href} className={classes} style={baseStyle} {...(props as any)}>
        {children}
      </Link>
    );
  }

  return (
    <span className={classes} style={baseStyle} {...props}>
      {children}
    </span>
  );
}
