import React from 'react';
import Link from 'next/link';

interface CardProps extends React.HTMLAttributes<HTMLDivElement | HTMLAnchorElement> {
  href?: string;
  hoverable?: boolean;
}

export function Card({ href, hoverable = false, children, className = '', ...props }: CardProps) {
  const baseClass = `glass-panel ${hoverable || href ? 'card-hoverable' : ''} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={baseClass} {...(props as any)}>
        {children}
      </Link>
    );
  }

  return (
    <div className={baseClass} {...(props as any)}>
      {children}
    </div>
  );
}
