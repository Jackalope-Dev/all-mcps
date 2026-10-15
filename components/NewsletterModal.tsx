'use client';

import { Mail, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { NewsletterSignupForm } from './forms/NewsletterSignupForm';

const DISMISS_KEY = 'allmcps_newsletter_dismissed';
const SUPPRESSED_PREFIXES = ['/login', '/dashboard', '/admin'];
/** Delay after the visitor's first interaction before the modal appears. */
const REVEAL_DELAY_MS = 12000;

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

    // Never stack on top of the cookie banner (same corner) — wait it out.
    const reveal = () => {
      if (document.querySelector('.acct-cookie')) {
        revealTimer = setTimeout(reveal, REVEAL_DELAY_MS);
        return;
      }
      setVisible(true);
    };

    const onFirstInteraction = () => {
      removeInteractionListeners();
      revealTimer = setTimeout(reveal, REVEAL_DELAY_MS);
    };

    for (const evt of interactionEvents) {
      window.addEventListener(evt, onFirstInteraction, { passive: true });
    }

    return () => {
      removeInteractionListeners();
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [pathname]);

  const dismiss = useCallback(() => {
    setDismissed();
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dismiss]);

  const handleSuccess = () => {
    setDismissed();
    setTimeout(() => setVisible(false), 2500);
  };

  if (!visible) return null;

  // A non-blocking card in the corner rather than a page-covering modal:
  // visitors can keep reading, and Esc or ✕ dismisses it for good.
  return (
    <aside
      className="acct-newsletter"
      role="dialog"
      aria-modal="false"
      aria-labelledby="acct-newsletter-title"
    >
      <button
        type="button"
        className="acct-newsletter-close"
        onClick={dismiss}
        aria-label="Close newsletter signup"
      >
        <X size={16} aria-hidden="true" />
      </button>
      <div className="acct-newsletter-icon" aria-hidden="true">
        <Mail size={18} />
      </div>
      <h2 id="acct-newsletter-title" className="acct-newsletter-title">
        New MCP servers, weekly
      </h2>
      <p className="acct-newsletter-sub">
        The best new listings and install tips. One email a week, unsubscribe
        anytime.
      </p>
      <NewsletterSignupForm source="modal" compact onSuccess={handleSuccess} />
    </aside>
  );
}
