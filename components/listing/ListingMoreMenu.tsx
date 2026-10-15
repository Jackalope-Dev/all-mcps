'use client';

import { MoreHorizontal } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

/**
 * Overflow menu for low-frequency listing actions (report, claim, embed…).
 * Built on <details> so it works before hydration; this component only adds
 * close-on-outside-click / Escape. Items stay mounted while closed, so a
 * modal opened from one (ReportListingButton portals to <body>) survives the
 * menu closing.
 */
export function ListingMoreMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = (e: Event) => {
      if (!el.open) return;
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return;
        el.open = false;
        el.querySelector('summary')?.focus();
        return;
      }
      if (!el.contains(e.target as Node)) el.open = false;
    };
    // Picking an item closes the menu too.
    const onItem = (e: Event) => {
      if ((e.target as HTMLElement).closest('.lst-menu-item')) el.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    el.addEventListener('click', onItem);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
      el.removeEventListener('click', onItem);
    };
  }, []);

  return (
    <details className="lst-more" ref={ref}>
      <summary
        className="btn btn-secondary btn-sm btn-icon"
        aria-label="More actions"
        title="More actions"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </summary>
      <div className="lst-menu">{children}</div>
    </details>
  );
}
