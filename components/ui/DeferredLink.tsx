'use client';

import { useRouter } from 'next/navigation';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';

/**
 * A link whose crawlable `href` is a clean URL, while a click goes to `to`.
 *
 * For destinations crawlers should never be handed: filtered `/browse?...`
 * views and `/login?callbackUrl=...`. robots.txt disallows both, so every
 * such href became one more "Blocked by robots.txt" URL in Search Console
 * (emoji category names made them worse). The click target is swapped in
 * on mousedown too, so middle and modifier clicks open `to` as well.
 */
export function DeferredLink({
  href,
  to,
  rel,
  className,
  style,
  onClick,
  children,
}: {
  /** Clean, crawlable URL rendered in the HTML. */
  href: string;
  /** Where a person's click actually goes. */
  to: string;
  rel?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <a
      href={href}
      rel={rel}
      className={className}
      style={style}
      onMouseDown={(e: MouseEvent<HTMLAnchorElement>) => {
        e.currentTarget.href = to;
      }}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.();
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) {
          e.currentTarget.href = to;
          return;
        }
        e.preventDefault();
        router.push(to);
      }}
    >
      {children}
    </a>
  );
}
