import React from 'react';

type PageShellVariant = 'default' | 'narrow' | 'content' | 'tool' | 'auth' | 'status';

interface PageShellProps {
  children: React.ReactNode;
  variant?: PageShellVariant;
  /** Wrap children in a solid surface panel */
  panel?: boolean;
  className?: string;
  /** Extra class on the inner panel (when panel=true) */
  panelClassName?: string;
}

export function PageShell({
  children,
  variant = 'default',
  panel = false,
  className = '',
  panelClassName = '',
}: PageShellProps) {
  const shellClass = `page-shell page-shell--${variant} ${className}`.trim();
  const panelClass =
    variant === 'auth'
      ? `surface page-panel page-panel--auth ${panelClassName}`.trim()
      : variant === 'status'
        ? `surface page-panel ${panelClassName}`.trim()
        : `surface page-panel ${panelClassName}`.trim();

  return (
    <main className={shellClass}>
      <div className="page-shell-inner">
        {panel ? <div className={panelClass}>{children}</div> : children}
      </div>
    </main>
  );
}

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  kicker?: string;
  /**
   * Icon+text pill "eyebrow" above the title — the badge pattern guides/best/
   * categories/stack/pricing used to each hand-roll inline. Takes precedence
   * over `kicker` when both are given.
   */
  badge?: React.ReactNode;
  /** Center the badge/title/description — the hero-style treatment those same pages hand-rolled. */
  centered?: boolean;
  className?: string;
}

export function PageHeader({ title, description, kicker, badge, centered = false, className = '' }: PageHeaderProps) {
  return (
    <header className={`page-header ${centered ? 'page-header--centered' : ''} ${className}`.trim()}>
      {badge ? (
        <div className="page-header-badge">{badge}</div>
      ) : kicker ? (
        <p className="page-kicker">{kicker}</p>
      ) : null}
      <h1 className="text-page-title">{title}</h1>
      {description ? <div className="text-lead">{description}</div> : null}
    </header>
  );
}
