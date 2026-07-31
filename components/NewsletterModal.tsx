'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { NewsletterSignupForm } from './forms/NewsletterSignupForm';

const DISMISS_KEY = 'allmcps_newsletter_dismissed';
const SUPPRESSED_PREFIXES = ['/login', '/dashboard', '/admin'];
/** Delay after the visitor's first interaction before the modal appears. */
const REVEAL_DELAY_MS = 4000;

function getDismissed(): boolean {
  try {
    return Boolean(localStorage.getItem(DISMISS_KEY));
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Ignore storage write failures (for example, Safari private mode).
  }
}

export function NewsletterModal() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (getDismissed()) return;
    if (document.cookie.includes('allmcps_subscribed=1')) return;
    if (SUPPRESSED_PREFIXES.some((p) => pathname?.startsWith(p))) return;

    // Reveal only after the visitor's first interaction, then after a short
    // dwell. Waiting for an interaction means the modal can never become the
    // page's Largest Contentful Paint element (LCP is finalized at first input),
    // so the auto-popup no longer inflates the homepage's Core Web Vitals — while
    // engaged visitors (the ones who might subscribe) still see it.
    const interactionEvents = ['scroll', 'pointerdown', 'keydown'] as const;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;

    const removeInteractionListeners = () => {
      for (const evt of interactionEvents) {
        window.removeEventListener(evt, onFirstInteraction);
      }
    };

    const onFirstInteraction = () => {
      removeInteractionListeners();
      revealTimer = setTimeout(() => setVisible(true), REVEAL_DELAY_MS);
    };

    for (const evt of interactionEvents) {
      window.addEventListener(evt, onFirstInteraction, { passive: true });
    }

    return () => {
      removeInteractionListeners();
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [pathname]);

  const dismiss = () => {
    setDismissed();
    setVisible(false);
  };

  const handleSuccess = () => {
    setDismissed();
    setTimeout(() => setVisible(false), 2500);
  };

  if (!visible) return null;

  return (
    <div
      className="newsletter-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Newsletter signup"
      onClick={dismiss}
    >
      <div className="newsletter-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="newsletter-modal-close"
          onClick={dismiss}
          aria-label="Close"
        >
          ✕
        </button>
        <h3 style={{ margin: '0 0 0.5rem' }}>Get new MCP servers in your inbox</h3>
        <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
          A roundup of new and top submissions — no spam, unsubscribe anytime.
        </p>
        <NewsletterSignupForm source="modal" onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
