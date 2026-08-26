import React from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

type BadgeVariant = 'default' | 'official' | 'verified' | 'success' | 'premium' | 'category' | 'cyan';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
  /** When set, the badge renders as a link (e.g. category → filtered browse). */
  href?: string;
  /** Renders an animated pulsing live dot indicator inside the badge */
  pulse?: boolean;
  /** Monospace dev-tool typography */
  mono?: boolean;
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
    case 'cyan':
      return 'badge-cyan';
    default:
      return 'badge-default';
  }
}

export function Badge({
  variant = 'default',
  children,
  style,
  href,
  pulse = false,
  mono = false,
  className = '',
  ...props
}: BadgeProps) {
  const classes = [
    'badge',
    variantClass(variant),
    pulse ? 'badge-pulse' : '',
    mono ? 'badge-mono' : '',
    href ? 'badge-link' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const renderContent = () => {
    if ((variant === 'official' || variant === 'verified') && typeof children === 'string' && (children.trim().toLowerCase() === 'verified' || children.trim().toLowerCase() === 'official')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <CheckCircle2 size={11} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{children}</span>
        </span>
      );
    }
    return children;
  };

  if (href) {
    return (
      <Link className={classes} style={style} {...(props as React.ComponentProps<typeof Link>)} href={href}>
        {renderContent()}
      </Link>
    );
  }

  return (
    <span className={classes} style={style} {...props}>
      {renderContent()}
    </span>
  );
}

