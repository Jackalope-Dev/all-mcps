'use client';

import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId } from 'react';

/**
 * Small shared building blocks for the admin console (styles: the `adm-`
 * section of app/styles/account.css).
 */

/** Section title + one-line description, with optional actions on the right. */
export function AdminSectionHead({
  title,
  count,
  description,
  actions,
}: {
  title: ReactNode;
  count?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="adm-section-head">
      <div>
        <h2 className="adm-title">
          {title}
          {count !== undefined && <span className="adm-count">{count}</span>}
        </h2>
        {description && <p className="adm-sub">{description}</p>}
      </div>
      {actions && <div className="adm-section-actions">{actions}</div>}
    </div>
  );
}

/** Card header: tinted icon tile + title. */
export function AdminCardHead({
  icon: Icon,
  hue,
  title,
  aside,
}: {
  icon: LucideIcon;
  hue: string;
  title: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="adm-card-head">
      <span className={`tint-tile ${hue}`} aria-hidden="true">
        <Icon size={16} />
      </span>
      <h3 className="adm-card-title">{title}</h3>
      {aside && <div className="adm-card-aside">{aside}</div>}
    </div>
  );
}

/** Quiet empty / error state with a tinted icon tile. */
export function AdminEmpty({
  icon: Icon,
  title,
  children,
  hue = 'hue-green',
  boxed = false,
}: {
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  hue?: string;
  boxed?: boolean;
}) {
  return (
    <div className={`adm-empty${boxed ? ' adm-empty--boxed' : ''}`}>
      <span className={`tint-tile ${hue}`} aria-hidden="true">
        <Icon size={18} />
      </span>
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'];

/** Page-shaped loading placeholder for lists of cards (up to six rows). */
export function AdminSkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="adm-skel-list" aria-hidden="true">
      {SKELETON_KEYS.slice(0, rows).map((key) => (
        <div key={key} className="skeleton adm-skel-row" />
      ))}
    </div>
  );
}

/**
 * Modal dialog matching the site's other dialogs: blurred backdrop (a
 * full-bleed button so clicking outside closes it), header with an optional
 * tinted icon, scrollable body and a footer for actions. Escape also closes.
 * On phones it docks to the bottom as a sheet.
 */
export function AdminModal({
  title,
  subtitle,
  icon: Icon,
  hue = '',
  wide = false,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  hue?: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="adm-modal">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="adm-modal-backdrop"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`adm-dialog${wide ? ' adm-dialog--wide' : ''}`}
      >
        <div className="adm-dialog-head">
          {Icon && (
            <span className={`tint-tile ${hue}`} aria-hidden="true">
              <Icon size={17} />
            </span>
          )}
          <div className="adm-dialog-heading">
            <h3 id={titleId} className="adm-dialog-title">
              {title}
            </h3>
            {subtitle && <p className="adm-dialog-sub">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost btn-icon adm-dialog-close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="adm-dialog-body">{children}</div>
        {footer && <div className="adm-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}
