import type React from 'react';

interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Large gradient status code (e.g. 404) */
  code?: string | number;
  actions?: React.ReactNode;
  className?: string;
  /** Heading element for the title; defaults to h1. */
  titleAs?: 'h1' | 'h2';
}

export function EmptyState({
  title,
  description,
  icon,
  code,
  actions,
  className = '',
  titleAs: Title = 'h1',
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      {code != null ? <div className="status-code">{code}</div> : null}
      {icon && !code ? <div className="empty-state-icon">{icon}</div> : null}
      <Title className="empty-state-title">{title}</Title>
      {description ? <p className="empty-state-body">{description}</p> : null}
      {actions ? <div className="empty-state-actions">{actions}</div> : null}
    </div>
  );
}
