'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ExternalLink, Sparkles, Megaphone, ArrowRight } from 'lucide-react';
import {
  getRandomPlaceholderVariant,
  type AdPlacement,
  type SponsorAd,
  type PlaceholderVariant,
} from '@/lib/ads';
import { trackSponsorCtaClick, trackSponsorPlaceholderView } from '@/lib/gtag';

interface SponsorAdUnitProps {
  placement: AdPlacement;
  /** Optional pre-loaded ad data (for SSR or live preview) */
  previewAd?: Partial<SponsorAd> | null;
  /** Optional custom CSS className */
  className?: string;
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

export function SponsorAdUnit({ placement, previewAd, className = '' }: SponsorAdUnitProps) {
  const [ad, setAd] = useState<Partial<SponsorAd> | null>(previewAd ?? null);
  const [loading, setLoading] = useState<boolean>(!previewAd);
  const [impressionSent, setImpressionSent] = useState<boolean>(false);
  const [placeholderVariant, setPlaceholderVariant] = useState<PlaceholderVariant>(() => getRandomPlaceholderVariant());
  const [logoError, setLogoError] = useState(false);
  const adRef = useRef<HTMLDivElement | null>(null);

  // Reset the broken-image fallback whenever the ad (and thus its logo) changes.
  useEffect(() => {
    setLogoError(false);
  }, [ad?.logoUrl]);

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
        const excludeParam = servedAdIdsOnPage.size > 0 ? `&exclude=${Array.from(servedAdIdsOnPage).join(',')}` : '';
        const res = await fetch(`/api/ads/serve?placement=${placement}${excludeParam}`);
        if (res.ok) {
          const data = (await res.json()) as { ad?: Partial<SponsorAd> | null };
          if (isMounted) {
            if (data.ad?.id) {
              servedAdIdsOnPage.add(data.ad.id);
            }
            setAd(data.ad || null);
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
              if (navigator.sendBeacon) {
                navigator.sendBeacon(
                  '/api/ads/event',
                  JSON.stringify({ adId: ad.id, placement, eventType: 'impression' })
                );
              } else {
                fetch('/api/ads/event', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ adId: ad.id, placement, eventType: 'impression' }),
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
      { threshold: 0.5 }
    );

    if (adRef.current) {
      observer.observe(adRef.current);
    }

    return () => observer.disconnect();
  }, [ad, placement, previewAd, impressionSent, loading, placeholderVariant]);

  const handleAdClick = () => {
    if (previewAd !== undefined || !ad?.id) return;
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/ads/event',
          JSON.stringify({ adId: ad.id, placement, eventType: 'click' })
        );
      } else {
        fetch('/api/ads/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adId: ad.id, placement, eventType: 'click' }),
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

  if (loading) {
    return (
      <div
        className={`surface animate-pulse ${className}`}
        style={{
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          height: '100%',
          minHeight: placement === 'directory_inline' ? '310px' : '90px',
          opacity: 0.5,
        }}
      />
    );
  }

  // --- RENDER PLACEHOLDER WITH A/B/C/D COPY VARIANT IF NO ACTIVE AD ---
  if (!ad) {
    const advertiseHref = `/advertise?placement=${placement}&variant=${placeholderVariant.id}`;

    if (placement === 'directory_inline') {
      return (
        <div
          ref={adRef}
          className={`surface ad-promo-inline ${className}`}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--accent-color)',
                  background: 'rgba(0, 229, 255, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={10} /> {placeholderVariant.badgeText}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '0.75rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'var(--brand-gradient-soft)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-color)',
                  flexShrink: 0,
                }}
              >
                <Megaphone size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {placeholderVariant.headline}
                </h4>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {placeholderVariant.body}
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
            <Link
              href={advertiseHref}
              onClick={handlePlaceholderCtaClick}
              className="btn btn-sm btn-primary"
              style={{ width: '100%', justifyContent: 'center', gap: '6px', fontSize: '0.825rem' }}
            >
              {placeholderVariant.ctaText} <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      );
    }

    if (placement === 'detail_sidebar') {
      return (
        <div
          ref={adRef}
          className={`surface ad-promo-sidebar ${className}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-color)' }}>
              {placeholderVariant.badgeText}
            </span>
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {placeholderVariant.headline}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem', lineHeight: 1.45 }}>
            {placeholderVariant.body}
          </p>
          <Link
            href={advertiseHref}
            onClick={handlePlaceholderCtaClick}
            className="btn btn-sm btn-secondary"
            style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', gap: '5px' }}
          >
            {placeholderVariant.ctaText} <ArrowRight size={13} />
          </Link>
        </div>
      );
    }

    if (placement === 'blog_guide') {
      return (
        <div
          ref={adRef}
          className={`surface ad-promo-guide ${className}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '240px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'rgba(0, 229, 255, 0.12)',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-color)',
                flexShrink: 0,
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-color)' }}>
                {placeholderVariant.badgeText}
              </div>
              <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {placeholderVariant.headline}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {placeholderVariant.body}
              </div>
            </div>
          </div>
          <Link
            href={advertiseHref}
            onClick={handlePlaceholderCtaClick}
            className="btn btn-sm btn-secondary"
            style={{ whiteSpace: 'nowrap', gap: '6px' }}
          >
            {placeholderVariant.ctaText} <ArrowRight size={13} />
          </Link>
        </div>
      );
    }

    // Prominent Header / Category Banner placeholder
    return (
      <div
        ref={adRef}
        className={`surface ad-promo-banner ${className}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(0, 229, 255, 0.12)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-color)',
              flexShrink: 0,
            }}
          >
            <Megaphone size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.2rem' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--accent-color)',
                  background: 'rgba(0, 229, 255, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={10} /> {placeholderVariant.badgeText}
              </span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {placeholderVariant.headline}
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
              {placeholderVariant.body}
            </p>
          </div>
        </div>

        <Link
          href={advertiseHref}
          onClick={handlePlaceholderCtaClick}
          className="btn btn-primary"
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            gap: '6px',
            boxShadow: '0 2px 10px rgba(0, 229, 255, 0.2)',
          }}
        >
          {placeholderVariant.ctaText} <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  // --- RENDER ACTIVE / PREVIEW AD ---
  const isPreview = previewAd !== undefined;
  const linkProps = isPreview
    ? { onClick: (e: React.MouseEvent) => e.preventDefault(), href: '#' }
    : { href: ad.targetUrl || '#', target: '_blank', rel: 'noopener sponsored nofollow', onClick: handleAdClick };
  const displayDomain = getDisplayDomain(ad.targetUrl);

  if (placement === 'directory_inline') {
    return (
      <div
        ref={adRef}
        className={`surface ${className}`}
        style={{
          borderRadius: '16px',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.04), rgba(0, 123, 255, 0.04))',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: '1.25rem',
          height: '100%',
          minHeight: '310px',
          position: 'relative',
          boxShadow: '0 4px 20px -2px rgba(0, 229, 255, 0.08)',
          transition: 'transform 0.2s ease, border-color 0.2s ease',
        }}
      >
        <div>
          <div style={{ marginBottom: '0.85rem' }}>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--accent-color)',
                background: 'rgba(0, 229, 255, 0.12)',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Sparkles size={10} /> Sponsored Partner
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '0.75rem' }}>
            {ad.logoUrl && !logoError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ad.logoUrl}
                alt={ad.title || 'Sponsor'}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-elevated)',
                  flexShrink: 0,
                }}
                onError={() => setLogoError(true)}
              />
            ) : (
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'var(--brand-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {(ad.title || 'A').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {ad.title || 'Sponsor Title'}
              </h4>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {ad.description || 'Sponsored advertisement description.'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
          <a
            {...linkProps}
            className="btn btn-sm btn-primary"
            style={{ width: '100%', justifyContent: 'center', gap: '6px', fontSize: '0.825rem' }}
          >
            {ad.ctaText || 'Learn More'} <ExternalLink size={13} />
          </a>
          {displayDomain && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{displayDomain}</span>
          )}
        </div>
      </div>
    );
  }

  if (placement === 'detail_sidebar') {
    return (
      <div
        ref={adRef}
        className={`surface ${className}`}
        style={{
          borderRadius: '14px',
          border: '1px solid rgba(0, 229, 255, 0.25)',
          padding: '1.15rem',
          background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.03), rgba(0, 123, 255, 0.03))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-color)' }}>
            Sponsored
          </span>
          <ExternalLink size={12} style={{ color: 'var(--text-secondary)' }} />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {ad.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.logoUrl}
              alt={ad.title || 'Sponsor'}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                objectFit: 'cover',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)',
                flexShrink: 0,
              }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          )}
          <div>
            <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {ad.title || 'Sponsor Title'}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
              {ad.description || 'Sponsored advertisement copy.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
          <a
            {...linkProps}
            className="btn btn-sm btn-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', gap: '5px' }}
          >
            {ad.ctaText || 'Visit Sponsor'} <ExternalLink size={12} />
          </a>
          {displayDomain && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{displayDomain}</span>
          )}
        </div>
      </div>
    );
  }

  if (placement === 'blog_guide') {
    return (
      <div
        ref={adRef}
        className={`surface ${className}`}
        style={{
          borderRadius: '14px',
          border: '1px solid rgba(0, 229, 255, 0.25)',
          padding: '1.25rem 1.5rem',
          margin: '2rem 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.04), rgba(0, 123, 255, 0.04))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '240px' }}>
          {ad.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.logoUrl}
              alt={ad.title || 'Sponsor'}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                objectFit: 'cover',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)',
                flexShrink: 0,
              }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-color)' }}>
                Sponsored Partner
              </span>
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {ad.title || 'Sponsor Title'}
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0', lineHeight: 1.4 }}>
              {ad.description || 'Sponsored advertisement description.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
          <a
            {...linkProps}
            className="btn btn-sm btn-primary"
            style={{ whiteSpace: 'nowrap', gap: '6px' }}
          >
            {ad.ctaText || 'Learn More'} <ExternalLink size={13} />
          </a>
          {displayDomain && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{displayDomain}</span>
          )}
        </div>
      </div>
    );
  }

  // Prominent Header / Category Banner (Active Ad)
  return (
    <div
      ref={adRef}
      className={`surface ${className}`}
      style={{
        borderRadius: '16px',
        border: '1px solid rgba(0, 229, 255, 0.35)',
        padding: '1.25rem 1.75rem',
        background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.05), rgba(0, 123, 255, 0.04), var(--bg-elevated))',
        boxShadow: '0 4px 20px -2px rgba(0, 229, 255, 0.08)',
      }}
    >
      <div style={{ marginBottom: '0.85rem' }}>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-color)',
            background: 'rgba(0, 229, 255, 0.12)',
            padding: '2px 8px',
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Sparkles size={10} /> Sponsored Partner
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
          {ad.logoUrl && !logoError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.logoUrl}
              alt={ad.title || 'Sponsor'}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                objectFit: 'cover',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)',
                flexShrink: 0,
              }}
              onError={() => setLogoError(true)}
            />
          ) : (
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'var(--brand-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {(ad.title || 'A').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {ad.title}
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
              {ad.description}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
          <a
            {...linkProps}
            className="btn btn-primary"
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              gap: '6px',
              boxShadow: '0 2px 10px rgba(0, 229, 255, 0.2)',
            }}
          >
            {ad.ctaText || 'Learn More'} <ExternalLink size={14} />
          </a>
          {displayDomain && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{displayDomain}</span>
          )}
        </div>
      </div>
    </div>
  );
}
