'use client';

import { ArrowRight, ExternalLink, Megaphone } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  type AdPlacement,
  getRandomPlaceholderVariant,
  type PlaceholderVariant,
  type SponsorAd,
} from '@/lib/ads';
import { trackSponsorCtaClick, trackSponsorPlaceholderView } from '@/lib/gtag';

interface SponsorAdUnitProps {
  placement: AdPlacement;
  /** Optional pre-loaded ad data (for SSR or live preview) */
  previewAd?: Partial<SponsorAd> | null;
  /** Optional custom CSS className */
  className?: string;
  /** Optional layout mode: 'card' (default) or 'row' */
  layout?: 'card' | 'row';
}

// Page-level registry to prevent rendering duplicate ads on the same page
const servedAdIdsOnPage = new Set<string>();

/** Small trust line under the ad title, e.g. "example.com" — derived from targetUrl so no schema change is needed. */
function getDisplayDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname || null;
  } catch {
    return null;
  }
}

export function SponsorAdUnit({
  placement,
  previewAd,
  className = '',
  layout = 'card',
}: SponsorAdUnitProps) {
  const [ad, setAd] = useState<Partial<SponsorAd> | null>(previewAd ?? null);
  const [eventToken, setEventToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!previewAd);
  const [impressionSent, setImpressionSent] = useState<boolean>(false);
  const [placeholderVariant] = useState<PlaceholderVariant>(() =>
    getRandomPlaceholderVariant(
      Array.from(placement).reduce((h, c) => h + c.charCodeAt(0), 0),
    ),
  );
  const [logoError, setLogoError] = useState(false);
  const adRef = useRef<HTMLElement | null>(null);

  // Reset the broken-image fallback whenever the ad (and thus its logo) changes.
  // Adjusted during render (React's "reset state when a value changes" pattern)
  // rather than in an effect, so a new logo never flashes the fallback first.
  const [logoErrorUrl, setLogoErrorUrl] = useState(ad?.logoUrl);
  if (logoErrorUrl !== ad?.logoUrl) {
    setLogoErrorUrl(ad?.logoUrl);
    setLogoError(false);
  }

  // If in preview mode, update immediately when prop changes
  useEffect(() => {
    if (previewAd !== undefined) {
      setAd(previewAd);
      setLoading(false);
    }
  }, [previewAd]);

  // Fetch live ad if not provided via props with page-level deduplication
  useEffect(() => {
    if (previewAd !== undefined) return;

    let isMounted = true;
    async function fetchAd() {
      try {
        const excludeParam =
          servedAdIdsOnPage.size > 0
            ? `&exclude=${Array.from(servedAdIdsOnPage).join(',')}`
            : '';
        const res = await fetch(
          `/api/ads/serve?placement=${placement}${excludeParam}`,
        );
        if (res.ok) {
          const data = (await res.json()) as {
            ad?: Partial<SponsorAd> | null;
            eventToken?: string | null;
          };
          if (isMounted) {
            if (data.ad?.id) {
              servedAdIdsOnPage.add(data.ad.id);
            }
            setAd(data.ad || null);
            setEventToken(data.eventToken || null);
          }
        }
      } catch {
        // fail gracefully to placeholder
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAd();
    return () => {
      isMounted = false;
    };
  }, [placement, previewAd]);

  // Track impression once visible (both active ads and A/B placeholder variants)
  useEffect(() => {
    if (previewAd !== undefined || impressionSent) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setImpressionSent(true);

          if (ad?.id) {
            // Track active ad impression
            try {
              const payload = JSON.stringify({
                adId: ad.id,
                placement,
                eventType: 'impression',
                eventToken,
              });
              if (navigator.sendBeacon) {
                navigator.sendBeacon('/api/ads/event', payload);
              } else {
                fetch('/api/ads/event', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: payload,
                  keepalive: true,
                }).catch(() => {});
              }
            } catch {}
          } else if (!loading && !ad) {
            // Track placeholder A/B test view in PostHog & GA4
            trackSponsorPlaceholderView({
              placement,
              variantId: placeholderVariant.id,
              headline: placeholderVariant.headline,
            });
          }

          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    if (adRef.current) {
      observer.observe(adRef.current);
    }

    return () => observer.disconnect();
  }, [
    ad,
    placement,
    previewAd,
    impressionSent,
    loading,
    placeholderVariant,
    eventToken,
  ]);

  const handleAdClick = () => {
    if (previewAd !== undefined || !ad?.id) return;
    try {
      const payload = JSON.stringify({
        adId: ad.id,
        placement,
        eventType: 'click',
        eventToken,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/ads/event', payload);
      } else {
        fetch('/api/ads/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
  };

  const handlePlaceholderCtaClick = () => {
    const destination = `/advertise?placement=${placement}&variant=${placeholderVariant.id}`;
    trackSponsorCtaClick({
      placement,
      variantId: placeholderVariant.id,
      headline: placeholderVariant.headline,
      ctaText: placeholderVariant.ctaText,
      destination,
    });
  };

  const variant =
    placement === 'detail_sidebar'
      ? 'sidebar'
      : placement === 'blog_guide'
        ? 'guide'
        : placement === 'directory_inline'
          ? 'card'
          : 'banner';
  const isRow = placement === 'directory_inline' && layout === 'row';

  if (loading) {
    return (
      <div
        className={`skeleton ${isRow ? 'dir-ad-row dir-ad-row--loading' : `sponsor-skeleton sponsor-skeleton--${variant}`} ${className}`}
        aria-hidden="true"
      />
    );
  }

  // Normalise the placeholder (house ad A/B variant) and a live/preview ad
  // into one shape so every placement shares a single, quiet layout. The CTA
  // is always secondary: a sponsor never outranks the page's primary action.
  const isPreview = previewAd !== undefined;
  const content = ad
    ? {
        label: 'Sponsored',
        title: ad.title || 'Sponsor Title',
        body: ad.description || 'Sponsored advertisement description.',
        cta: ad.ctaText || 'Learn more',
        domain: getDisplayDomain(ad.targetUrl),
      }
    : {
        label: placeholderVariant.badgeText,
        title: placeholderVariant.headline,
        body: placeholderVariant.body,
        cta: placeholderVariant.ctaText,
        domain: null,
      };

  const media =
    ad?.logoUrl && !logoError ? (
      // biome-ignore lint/performance/noImgElement: third-party sponsor logos aren't on an allow-listed image host.
      <img
        src={ad.logoUrl}
        alt=""
        width={40}
        height={40}
        className={isRow ? 'dir-ad-logo' : 'sponsor-logo'}
        onError={() => setLogoError(true)}
      />
    ) : (
      <div
        className={isRow ? 'dir-ad-icon' : 'sponsor-icon'}
        aria-hidden="true"
      >
        {ad ? (
          (ad.title || 'A').slice(0, 2).toUpperCase()
        ) : (
          <Megaphone size={18} />
        )}
      </div>
    );

  const ctaInner = (
    <>
      {content.cta}{' '}
      {ad ? (
        <ExternalLink size={13} aria-hidden="true" />
      ) : (
        <ArrowRight size={13} aria-hidden="true" />
      )}
    </>
  );
  const ctaClass = `btn btn-sm btn-secondary ${isRow ? 'dir-ad-cta' : 'sponsor-cta'}`;
  const cta = ad ? (
    <a
      {...(isPreview
        ? { href: '#', onClick: (e: React.MouseEvent) => e.preventDefault() }
        : {
            href: ad.targetUrl || '#',
            target: '_blank',
            rel: 'noopener sponsored nofollow',
            onClick: handleAdClick,
          })}
      className={ctaClass}
    >
      {ctaInner}
    </a>
  ) : (
    <Link
      href={`/advertise?placement=${placement}&variant=${placeholderVariant.id}`}
      onClick={handlePlaceholderCtaClick}
      className={ctaClass}
    >
      {ctaInner}
    </Link>
  );

  if (isRow) {
    return (
      <div
        ref={adRef as React.RefObject<HTMLDivElement | null>}
        className={`dir-ad-row ${className}`}
      >
        {media}
        <div className="dir-ad-main">
          <div className="dir-ad-head">
            <span className="dir-ad-label">{content.label}</span>
            <span className="dir-ad-title">{content.title}</span>
            {content.domain && (
              <span className="dir-ad-domain">{content.domain}</span>
            )}
          </div>
          <p className="dir-ad-desc">{content.body}</p>
        </div>
        {cta}
      </div>
    );
  }

  return (
    <aside
      ref={adRef}
      className={`sponsor sponsor--${variant} ${className}`}
      aria-label={content.label}
    >
      <div className="sponsor-main">
        {media}
        <div className="sponsor-copy">
          <span className="sponsor-label">{content.label}</span>
          <span className="sponsor-title">{content.title}</span>
          <p className="sponsor-body">{content.body}</p>
        </div>
      </div>
      <div className="sponsor-actions">
        {cta}
        {content.domain && (
          <span className="sponsor-domain">{content.domain}</span>
        )}
      </div>
    </aside>
  );
}
