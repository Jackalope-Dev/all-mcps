import React from 'react';

export interface DirectoryBadge {
  id: string;
  name: string;
  href: string;
  imageUrl?: string;
  svgIcon?: React.ReactNode;
  rel?: string;
}

const BADGES: DirectoryBadge[] = [
  {
    id: 'saashub',
    name: 'SaaSHub',
    href: 'https://www.saashub.com',
    rel: 'nofollow'
  },
  {
    id: 'producthunt',
    name: 'Featured on Product Hunt',
    href: 'https://www.producthunt.com',
    rel: 'nofollow'
  },
  {
    id: 'devhunt',
    name: 'DevHunt',
    href: 'https://devhunt.org',
    rel: 'nofollow'
  },
  {
    id: 'alternativeto',
    name: 'AlternativeTo',
    href: 'https://alternativeto.net',
    rel: 'nofollow'
  },
  {
    id: 'uneed',
    name: 'Uneed Best Tools',
    href: 'https://www.uneed.best',
    rel: 'nofollow'
  },
  {
    id: 'microlaunch',
    name: 'MicroLaunch',
    href: 'https://microlaunch.net',
    rel: 'nofollow'
  },
  {
    id: 'launchingnext',
    name: 'Launching Next',
    href: 'https://www.launchingnext.com',
    rel: 'nofollow'
  },
  {
    id: 'indiehackers',
    name: 'Indie Hackers',
    href: 'https://www.indiehackers.com',
    rel: 'nofollow'
  }
];

export function BadgeMarquee() {
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
