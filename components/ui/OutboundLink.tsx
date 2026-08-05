'use client';

import React from 'react';
import { trackOutboundClick } from '../../lib/gtag';
import { withAllMcpsUtm } from '../../lib/outboundLinks';

interface OutboundLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  destinationType: 'github' | 'website' | 'other';
  serverId?: string;
  children: React.ReactNode;
}

export function OutboundLink({
  href,
  destinationType,
  serverId,
  children,
  onClick,
  ...props
}: OutboundLinkProps) {
  const targetHref = React.useMemo(() => {
    if (destinationType === 'website' || destinationType === 'github') {
      const campaign = destinationType === 'website' ? 'website_button' : 'github_button';
      return withAllMcpsUtm(href, { campaign, content: serverId });
    }
    return href;
  }, [href, destinationType, serverId]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    trackOutboundClick({ url: targetHref, destinationType, serverId });

    if (serverId && (destinationType === 'github' || destinationType === 'website')) {
      const surface = destinationType === 'github' ? 'outbound_github' : 'outbound_website';
      const body = JSON.stringify({ impressions: [{ serverId, surface }] });
      try {
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
          navigator.sendBeacon('/api/impressions', new Blob([body], { type: 'application/json' }));
        } else {
          fetch('/api/impressions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        /* ignore telemetry failures */
      }
    }

    if (onClick) onClick(e);
  };

  return (
    <a href={targetHref} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
