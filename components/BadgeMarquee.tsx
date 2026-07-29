import React from 'react';

export interface DirectoryBadge {
  id: string;
  name: string;
  href: string;
  imageUrl?: string;
  width?: number;
  height?: number;
  svgIcon?: React.ReactNode;
  rel?: string;
}

/**
 * Verified reciprocal badges and dofollow directory links.
 */
const BADGES: DirectoryBadge[] = [
  {
    id: 'nicklaunches',
    name: 'AllMCPs on Nick Launches',
    href: 'https://nicklaunches.com/products/allmcps/?utm_source=allmcps.com&utm_medium=badge&utm_campaign=featured',
    imageUrl: 'https://nicklaunches.com/badges/featured-dark.png',
    width: 244,
    height: 56,
    rel: 'noopener'
  }
];

export function BadgeMarquee() {
  if (!BADGES || BADGES.length === 0) {
    return null; // Stays completely hidden until badges are added
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
            {badge.imageUrl ? (
              <img
                src={badge.imageUrl}
                alt={badge.name}
                className="badge-marquee-img"
                width={badge.width || 244}
                height={badge.height || 56}
                style={{ height: 'auto', maxHeight: '38px', width: 'auto' }}
              />
            ) : (
              <span className="badge-marquee-pill">
                <span className="badge-marquee-dot" />
                <span>{badge.name}</span>
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
