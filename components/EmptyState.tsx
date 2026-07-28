import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Large gradient status code (e.g. 404) */
  code?: string | number;
  actions?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  code,
  actions,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      {code != null ? <div className="status-code">{code}</div> : null}
      {icon && !code ? <div className="empty-state-icon">{icon}</div> : null}
      <h1 className="empty-state-title">{title}</h1>
      {description ? <p className="empty-state-body">{description}</p> : null}
      {actions ? <div className="empty-state-actions">{actions}</div> : null}
    </div>
  );
}
