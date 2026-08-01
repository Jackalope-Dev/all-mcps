'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  if (window.posthog && typeof window.posthog.opt_out_capturing === 'function') {
    window.posthog.opt_out_capturing();
  }
}

const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'GB', 'UK', 'IS', 'LI', 'NO', 'CH'
]);

function isUserInEU(countryProp?: string): boolean {
  if (countryProp) {
    return EU_COUNTRIES.has(countryProp.toUpperCase());
  }

  // Client-side fallback check (Timezone & Navigator language)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (
      tz.startsWith('Europe/') ||
      tz.startsWith('Atlantic/Reykjavik') ||
      tz.startsWith('Atlantic/Faroe') ||
      tz.startsWith('Atlantic/Canary') ||
      tz.startsWith('Atlantic/Madeira') ||
      tz.startsWith('Atlantic/Azores')
    ) {
      return true;
    }
  } catch (e) {
    // Ignore error
  }

  return false;
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

    // No consent choice saved yet
    const inEU = isUserInEU(country);

    if (inEU) {
      // Prompt EU users for consent
      setShowBanner(true);
    } else {
      // Non-EU users default to granted
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
    <div
      role="region"
      aria-label="Cookie consent banner"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        maxWidth: '420px',
        width: 'calc(100vw - 2.5rem)',
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        color: '#f8fafc',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        fontSize: '0.875rem',
        lineHeight: '1.4',
        animation: 'fadeInUp 0.3s ease-out',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>🍪 Cookie Preferences</span>
      </div>
      <p style={{ color: '#94a3b8', margin: '0 0 1rem 0', fontSize: '0.825rem' }}>
        We use analytics cookies to measure site traffic and improve AllMCPs. Learn more in our{' '}
        <Link href="/privacy" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
          Privacy Policy
        </Link>.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleDecline}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#cbd5e1',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '0.6rem 1.1rem',
            minHeight: '44px',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
        >
          Decline
        </button>
        <button
          type="button"
          onClick={handleAccept}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.6rem 1.1rem',
            minHeight: '44px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
            transition: 'opacity 0.2s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
