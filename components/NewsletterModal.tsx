'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { NewsletterSignupForm } from './forms/NewsletterSignupForm';

const DISMISS_KEY = 'allmcps_newsletter_dismissed';
const SUPPRESSED_PREFIXES = ['/login', '/dashboard', '/admin'];

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

    const timer = setTimeout(() => setVisible(true), 10000);
    return () => clearTimeout(timer);
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
