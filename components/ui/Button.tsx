import React from 'react';
import Link from 'next/link';

type ButtonVariant = 'primary' | 'secondary' | 'glass';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  href?: string;
  className?: string;
}

export function Button({ variant = 'primary', href, className = '', children, style, ...props }: ButtonProps) {
  let btnClass = 'btn';
  if (variant === 'primary') btnClass += ' btn-primary';
  if (variant === 'secondary') btnClass += ' btn-secondary';
  if (variant === 'glass') btnClass += ' glass-panel';

  const combinedClass = `${btnClass} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={combinedClass} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button className={combinedClass} style={style} {...props}>
      {children}
    </button>
  );
}
