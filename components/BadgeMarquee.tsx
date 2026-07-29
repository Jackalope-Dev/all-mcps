import React from 'react';

export interface DirectoryBadge {
  id: string;
  name: string;
  href: string;
  imageUrl?: string;
  svgIcon?: React.ReactNode;
  rel?: string;
}

/**
 * Verified reciprocal badges and dofollow directory links.
 * Standardized pill card design across all badges.
 */
const BADGES: DirectoryBadge[] = [
  {
    id: 'nicklaunches',
    name: 'Featured on Nick Launches',
    href: 'https://nicklaunches.com/products/allmcps/?utm_source=allmcps.com&utm_medium=badge&utm_campaign=featured',
    imageUrl: 'https://nicklaunches.com/badges/featured-dark.png',
    rel: 'noopener'
  },
  {
    id: 'launchllama',
    name: 'Launch Llama Newsletter',
    href: 'https://tools.launchllama.co?utm_source=badge&utm_medium=referral',
    imageUrl: 'https://tools.launchllama.co/featured-badge-white.png?v=2',
    rel: 'noopener noreferrer'
  },
  {
    id: 'verifieddr',
    name: 'Verified DR - allmcps.com',
    href: 'https://verifieddr.com/website/allmcps-com',
    imageUrl: 'https://verifieddr.com/badge/allmcps-com-dark.svg',
    rel: 'noopener'
  },
  {
    id: 'saasgrow',
    name: 'Featured on SaaSGrow',
    href: 'https://saasgrow.app?ref=allmcps.com',
    imageUrl: 'https://saasgrow.app/api/badge?type=featured&style=dark',
    rel: 'noopener'
  },
  {
    id: 'twelvetools',
    name: 'Featured on Twelve Tools',
    href: 'https://twelve.tools',
    imageUrl: 'https://twelve.tools/badge3-dark.svg',
    rel: 'noopener'
  },
  {
    id: 'saaspage',
    name: 'Featured on Saaspa.ge',
    href: 'https://saaspa.ge/product/cms5fgv4u004sl804ite33b01',
    imageUrl: 'https://saaspa.ge/api/embed/product/cms5fgv4u004sl804ite33b01/badge.png?theme=orange',
    rel: 'nofollow'
  },
  {
    id: 'findlytools',
    name: 'Featured on Findly.tools',
    href: 'https://findly.tools/all-mcps?utm_source=all-mcps',
    imageUrl: 'https://findly.tools/badges/findly-tools-badge-light.svg',
    rel: 'noopener noreferrer'
  }
];

export function BadgeMarquee() {
  if (!BADGES || BADGES.length === 0) {
    return null;
  }

  // Repeat array for smooth infinite marquee scrolling animation
  const displayBadges = BADGES.length < 5
    ? Array(6).fill(BADGES).flat()
    : [...BADGES, ...BADGES];

  return (
    <div className="badge-marquee-container" aria-label="Featured Directory Listings">
      <div className="badge-marquee-track">
        {displayBadges.map((badge, idx) => (
          <a
            key={`${badge.id}-${idx}`}
            href={badge.href}
            target="_blank"
            rel={badge.rel || 'noopener noreferrer'}
            className="badge-marquee-item"
            title={badge.name}
          >
            <span className="badge-marquee-pill">
              {badge.imageUrl ? (
                <img
                  src={badge.imageUrl}
                  alt={badge.name}
                  className="badge-marquee-icon-thumb"
                />
              ) : (
                <span className="badge-marquee-dot" />
              )}
              <span className="badge-marquee-label">{badge.name}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
