'use client';

import { Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Mobile-only sticky CTA that keeps install within one thumb-tap of any scroll
 * position on a listing detail page. Hidden from md+ where the in-page install
 * block (and sticky sidebar) already cover the job.
 */
export function MobileInstallBar({
  displayName,
  targetId = 'quick-install',
}: {
  displayName: string;
  targetId?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show the bar only when the install section has scrolled out of view.
        setVisible(!entry.isIntersecting);
      },
      { rootMargin: '-80px 0px 0px 0px', threshold: 0.05 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  if (!visible) return null;

  return (
    <div
      className="mobile-install-bar"
      role="region"
      aria-label="Quick install"
    >
      <button
        type="button"
        className="mobile-install-bar-btn"
        onClick={() => {
          const el = document.getElementById(targetId);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Nudge the primary install control into focus after scroll settles.
          window.setTimeout(() => {
            const promptBtn = el?.querySelector<HTMLButtonElement>('button');
            promptBtn?.focus({ preventScroll: true });
          }, 400);
        }}
      >
        <Terminal size={16} aria-hidden="true" />
        <span>Install {displayName}</span>
      </button>
    </div>
  );
}
