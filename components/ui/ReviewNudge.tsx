'use client';

import { Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Tell this listing's ReviewNudge the visitor just took the install config
 * (copy, editor deep link, or agent prompt) — the highest-intent moment to
 * ask for a rating.
 */
export function signalConfigCopied(serverId: string) {
  try {
    window.dispatchEvent(
      new CustomEvent('allmcps:config-copied', { detail: { serverId } }),
    );
    localStorage.setItem(`allmcps:copied:${serverId}`, '1');
  } catch {
    /* storage / event unavailable — non-critical */
  }
}

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
        // Sits between .lst-section blocks, which only carry margin-bottom —
        // so the gap above comes from the previous section and this card
        // must supply the gap before the next section's heading.
        margin: '0 0 clamp(2rem, 4vw, 2.75rem)',
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
