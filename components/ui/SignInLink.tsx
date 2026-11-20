'use client';

import type { CSSProperties, ReactNode } from 'react';
import { DeferredLink } from './DeferredLink';

/** `/login`, carrying where to come back to when there is somewhere to go. */
export function loginPath(callbackUrl?: string | null): string {
  if (
    !callbackUrl ||
    callbackUrl === '/' ||
    callbackUrl.startsWith('/login') ||
    callbackUrl.startsWith('/verify-request')
  ) {
    return '/login';
  }
  return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

/**
 * Sign-in link rendered as a plain, nofollowed `/login`. Every page used to
 * link `/login?callbackUrl=<its own path>`, a distinct robots-blocked URL per
 * listing (~1,100 in Search Console); the return path is added on click.
 */
export function SignInLink({
  callbackUrl,
  className,
  style,
  onClick,
  children,
}: {
  callbackUrl?: string | null;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <DeferredLink
      href="/login"
      to={loginPath(callbackUrl)}
      rel="nofollow"
      className={className}
      style={style}
      onClick={onClick}
    >
      {children}
    </DeferredLink>
  );
}
