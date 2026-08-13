'use client';

import { useEffect, useRef, useState } from 'react';

interface FooterNavSectionProps {
  /** Accessible label for the wrapping <nav> landmark. */
  ariaLabel: string;
  /** Heading text shown in the summary/column header. */
  heading: string;
  children: React.ReactNode;
}

/**
 * A footer link column that renders as a plain, always-open list on desktop
 * and as a collapsible accordion on mobile — so phones get a compact, tappable
 * footer instead of a long wall of links.
 *
 * Uses a native <details>/<summary> for zero-JS-dependent accessibility and
 * keyboard support; the `open` state is only auto-managed at the breakpoint so
 * a manual expand/collapse on mobile is respected until the viewport changes.
 */
export function FooterNavSection({ ariaLabel, heading, children }: FooterNavSectionProps) {
  // Start open so SSR and desktop render expanded (no hydration flash on
  // desktop); collapse on mobile after mount.
  const [open, setOpen] = useState(true);
  const isMobile = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      isMobile.current = mq.matches;
      setOpen(!mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <nav aria-label={ariaLabel}>
      <details
        className="footer-accordion"
        open={open}
        onToggle={(e) => {
          const el = e.currentTarget as HTMLDetailsElement;
          if (isMobile.current) {
            // On mobile the user drives expand/collapse.
            setOpen(el.open);
          } else if (!el.open) {
            // On desktop every section stays expanded — undo any collapse
            // (from a click or keyboard activation on the summary).
            el.open = true;
          }
        }}
      >
        <summary className="footer-heading footer-accordion-summary">
          <span>{heading}</span>
          <svg
            className="footer-accordion-chevron"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="footer-accordion-body">{children}</div>
      </details>
    </nav>
  );
}
