import React from 'react';
import Link from 'next/link';

type ButtonVariant = 'primary' | 'secondary' | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  href?: string;
  className?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  href,
  className = '',
  children,
  style,
  onClick,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    'btn',
    variant === 'primary' ? 'btn-primary' : '',
    variant === 'secondary' ? 'btn-secondary' : '',
    variant === 'glass' ? 'btn-glass' : '',
    size === 'sm' ? 'btn-sm' : '',
    size === 'md' ? 'btn-md' : '',
    size === 'lg' ? 'btn-lg' : '',
    fullWidth ? 'btn-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (href) {
    // Link-as-button: forward onClick (e.g. close mobile drawer) and common a11y props.
    return (
      <Link
        href={href}
        className={classes}
        style={style}
        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined}
        aria-label={props['aria-label']}
        aria-current={props['aria-current'] as React.AriaAttributes['aria-current']}
      >
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} style={style} type={type} onClick={onClick} {...props}>
      {children}
    </button>
  );
}
