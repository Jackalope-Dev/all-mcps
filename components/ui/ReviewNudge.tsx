'use client';

import { Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Post-install review solicitation. Stays hidden until this visitor actually
 * copies the install config for this server (CopyBlock dispatches
 * `allmcps:config-copied` and sets a localStorage flag) — the highest-intent
 * moment to ask for a rating. Dismissal is remembered per-listing. No rating is
 * ever submitted from here; it just deep-links to the real composer.
 */
export function ReviewNudge({
  serverId,
  serverName,
}: {
  serverId: string;
  serverName: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const copiedKey = `allmcps:copied:${serverId}`;
    const dismissedKey = `allmcps:review-nudge-dismissed:${serverId}`;

    const maybeShow = () => {
      try {
        if (localStorage.getItem(dismissedKey)) return;
        if (localStorage.getItem(copiedKey)) setShow(true);
      } catch {
        /* storage blocked — stay hidden */
      }
    };

    maybeShow();

    const onCopied = (e: Event) => {
      const detail = (e as CustomEvent<{ serverId?: string }>).detail;
      if (detail?.serverId === serverId) maybeShow();
    };
    window.addEventListener('allmcps:config-copied', onCopied);
    return () => window.removeEventListener('allmcps:config-copied', onCopied);
  }, [serverId]);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(
        `allmcps:review-nudge-dismissed:${serverId}`,
        String(Date.now()),
      );
    } catch {
      /* non-critical */
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        padding: '0.85rem 1rem',
        margin: '1.25rem 0 0',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        background: 'var(--brand-gradient-soft)',
      }}
    >
      <Star
        size={18}
        style={{ color: 'var(--accent-color)', flexShrink: 0 }}
        aria-hidden="true"
      />
      <span
        style={{
          fontSize: '0.9rem',
          color: 'var(--text-primary)',
          fontWeight: 600,
          flex: 1,
          minWidth: 180,
        }}
      >
        Got {serverName} running? A one-line rating helps the next person
        decide.
      </span>
      <a
        href="#reviews"
        className="btn btn-secondary"
        style={{
          fontSize: '0.85rem',
          padding: '0.4rem 0.9rem',
          whiteSpace: 'nowrap',
        }}
      >
        Rate it →
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          display: 'inline-flex',
          padding: 4,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
