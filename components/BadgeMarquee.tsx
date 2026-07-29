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
 * Add your directory badges and reciprocal links here once approved.
 * Example:
 * {
 *   id: 'saashub',
 *   name: 'SaaSHub',
 *   href: 'https://www.saashub.com/s/allmcps',
 *   imageUrl: 'https://www.saashub.com/badge.png'
 * }
 */
const BADGES: DirectoryBadge[] = [];

export function BadgeMarquee() {
  if (!BADGES || BADGES.length === 0) {
    return null; // Stays completely hidden until badges are added
  }

  // Duplicate array for seamless infinite looping scroll
  const doubleBadges = [...BADGES, ...BADGES];

  return (
    <div className="badge-marquee-container" aria-label="Featured Directory Listings">
      <div className="badge-marquee-track">
        {doubleBadges.map((badge, idx) => (
          <a
            key={`${badge.id}-${idx}`}
            href={badge.href}
            target="_blank"
            rel={badge.rel || 'noopener noreferrer'}
            className="badge-marquee-item"
            title={`Featured on ${badge.name}`}
          >
            {badge.imageUrl ? (
              <img src={badge.imageUrl} alt={badge.name} className="badge-marquee-img" />
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
