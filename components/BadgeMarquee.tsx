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
    id: 'allmcps-self',
    name: 'AllMCPs Verified',
    href: 'https://allmcps.com/mcp/allmcps-server',
    imageUrl: 'https://allmcps.com/api/badge/allmcps-server?style=directory',
    rel: 'noopener noreferrer'
  },
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
  },
  {
    id: 'startupfame',
    name: 'Featured on Startup Fame',
    href: 'https://startupfa.me/s/allmcps?utm_source=allmcps.com',
    imageUrl: 'https://startupfa.me/badges/featured-badge.webp',
    rel: 'noopener'
  },
  {
    id: 'launchkiwi',
    name: 'Featured on LaunchKiwi',
    href: 'https://launchkiwi.com/p/all-mcps',
    imageUrl: 'https://launchkiwi.com/badge-dark.svg',
    rel: 'noopener'
  },
  {
    id: 'scrolllaunch',
    name: 'Featured on ScrollLaunch',
    href: 'https://www.scrolllaunch.com/products/allmcps?utm_source=badge&utm_medium=embed&utm_campaign=allmcps&ref=scrolllaunch',
    imageUrl: 'https://www.scrolllaunch.com/api/badge/allmcps',
    rel: 'noopener noreferrer'
  },
  {
    id: 'dailypings',
    name: 'Featured on DailyPings',
    href: 'https://dailypings.com/p/allmcps',
    imageUrl: 'https://dailypings.com/badge.svg',
    rel: 'noopener noreferrer'
  },
  {
    id: 'fazier',
    name: 'Fazier badge',
    href: 'https://fazier.com/launches/allmcps.com',
    imageUrl: 'https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=featured&theme=neutral',
    rel: 'noopener noreferrer'
  },
  {
    id: 'newtool',
    name: 'Featured on NewTool.site',
    href: 'https://newtool.site/item/allmcps',
    imageUrl: 'https://newtool.site/badges/newtool-light.svg',
    rel: 'noopener noreferrer'
  },
  {
    id: 'saasfame',
    name: 'Featured on saasfame.com',
    href: 'https://saasfame.com/item/allmcps',
    imageUrl: 'https://saasfame.com/badge-light.svg',
    rel: 'noopener noreferrer'
  },
  {
    id: 'drchecker',
    name: 'DR Checker - Domain Rating',
    href: 'https://drchecker.net/item/allmcps.com',
    imageUrl: 'https://drchecker.net/api/badge?domain=allmcps.com',
    rel: 'noopener noreferrer'
  },
  {
    id: 'turbo0',
    name: 'Listed on Turbo0',
    href: 'https://turbo0.com/item/allmcps',
    imageUrl: 'https://img.turbo0.com/badge-listed-light.svg',
    rel: 'noopener noreferrer'
  },
  {
    id: 'launchboard',
    name: 'Launched on LaunchBoard - Product Launch Platform',
    href: 'https://launchboard.dev',
    imageUrl: 'https://launchboard.dev/launchboard-badge.png',
    rel: 'noopener'
  },
  {
    id: 'similarlabs',
    name: 'List on Similarlabs',
    href: 'https://similarlabs.com',
    imageUrl: 'https://similarlabs.com/similarlabs-embed-badge-light.svg',
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
