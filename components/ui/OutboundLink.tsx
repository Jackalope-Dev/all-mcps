'use client';

import React from 'react';
import { trackOutboundClick } from '../../lib/gtag';

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
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    trackOutboundClick({ url: href, destinationType, serverId });
    if (onClick) onClick(e);
  };

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
