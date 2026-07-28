import React from 'react';

type BadgeVariant = 'default' | 'official' | 'success' | 'category';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', children, style, ...props }: BadgeProps) {
  let baseStyle: React.CSSProperties = {
    padding: '0.25rem 0.75rem',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    whiteSpace: 'nowrap',
    ...style
  };

  switch (variant) {
    case 'official':
      baseStyle = { ...baseStyle, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' };
      break;
    case 'success':
      baseStyle = { ...baseStyle, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' };
      break;
    case 'category':
      baseStyle = { ...baseStyle, background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.05)' };
      break;
    default:
      baseStyle = { ...baseStyle, background: 'rgba(0,0,0,0.5)', color: 'var(--text-secondary)', borderRadius: '4px' };
  }

  return (
    <span style={baseStyle} {...props}>
      {children}
    </span>
  );
}
