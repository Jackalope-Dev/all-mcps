'use client';

import { ArrowUp, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Mobile-only sticky bar that keeps install one thumb-tap away once the
 * install panel has scrolled out of view. Hidden from md+ (CSS), where the
 * header's Install button and the section nav already cover the job. It
 * slides in/out instead of mounting so it never jolts the page.
 */
export function MobileInstallBar({
  displayName,
  subtitle,
  targetId = 'install',
}: {
  displayName: string;
  subtitle?: string;
  targetId?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === 'undefined') return;
    let passed = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only after the reader has scrolled past the panel (not before it).
        passed = entry.boundingClientRect.top < 0;
        setVisible(!entry.isIntersecting && passed);
      },
      { rootMargin: '-80px 0px 0px 0px', threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  const go = () => {
    const el = document.getElementById(targetId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      el?.querySelector<HTMLElement>('[role="tab"], button, a')?.focus({
        preventScroll: true,
      });
    }, 450);
  };

  return (
    <section
      className={`mobile-install-bar${visible ? ' is-visible' : ''}`}
      aria-label="Quick install"
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="mobile-install-bar-text">
        <span className="mobile-install-bar-name">{displayName}</span>
        {subtitle ? (
          <span className="mobile-install-bar-sub">{subtitle}</span>
        ) : null}
      </div>
      <button
        type="button"
        className="btn btn-primary btn-sm mobile-install-bar-btn"
        onClick={go}
      >
        <Terminal size={15} aria-hidden="true" />
        Install
        <ArrowUp size={14} aria-hidden="true" />
      </button>
    </section>
  );
}
