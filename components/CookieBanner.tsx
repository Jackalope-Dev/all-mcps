'use client';

import { Cookie } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isUserInEU } from '../lib/consentRegion';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    posthog?: {
      capture?: (event: string, properties?: Record<string, any>) => void;
      opt_in_capturing?: () => void;
      opt_out_capturing?: () => void;
      [key: string]: any;
    };
  }
}

/** Grant analytics consent to both Google Analytics and PostHog. */
function grantAnalyticsConsent() {
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
  }
  if (window.posthog && typeof window.posthog.opt_in_capturing === 'function') {
    window.posthog.opt_in_capturing();
  }
}

/** Withdraw analytics consent from both Google Analytics and PostHog. */
function denyAnalyticsConsent() {
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: 'denied' });
  }
  if (
    window.posthog &&
    typeof window.posthog.opt_out_capturing === 'function'
  ) {
    window.posthog.opt_out_capturing();
  }
}

function getStoredConsent(): string | null {
  try {
    return localStorage.getItem('allmcps_cookie_consent');
  } catch {
    return null;
  }
}

function setStoredConsent(value: 'granted' | 'denied') {
  try {
    localStorage.setItem('allmcps_cookie_consent', value);
  } catch {
    // Ignore storage write failures (for example, Safari private mode).
  }
}

export function CookieBanner({ country }: { country?: string }) {
  const [showBanner, setShowBanner] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedConsent = getStoredConsent();

    if (savedConsent === 'granted') {
      grantAnalyticsConsent();
      return;
    }

    if (savedConsent === 'denied') {
      denyAnalyticsConsent();
      return;
    }

    const inEU = isUserInEU(country);

    if (inEU) {
      setShowBanner(true);
    } else {
      setStoredConsent('granted');
      grantAnalyticsConsent();
    }
  }, [country]);

  const handleAccept = () => {
    setStoredConsent('granted');
    grantAnalyticsConsent();
    setShowBanner(false);
  };

  const handleDecline = () => {
    setStoredConsent('denied');
    denyAnalyticsConsent();
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <section aria-label="Cookie consent banner" className="acct-cookie">
      <Cookie size={18} className="acct-cookie-icon" aria-hidden="true" />
      <p className="acct-cookie-body">
        <strong>Analytics cookies?</strong> They help us see what&rsquo;s
        useful.{' '}
        <Link href="/privacy" className="acct-cookie-link">
          Privacy
        </Link>
      </p>
      <div className="acct-cookie-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleDecline}
        >
          Decline
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleAccept}
        >
          Accept
        </button>
      </div>
    </section>
  );
}
