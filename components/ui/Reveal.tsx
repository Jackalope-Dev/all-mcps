'use client';

import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger index — multiplies a small delay so sibling Reveals cascade in. */
  index?: number;
  as?: 'div' | 'section';
}

/**
 * Fades/slides a section in the first time it scrolls into view. Uses
 * IntersectionObserver (previously only used in this app for impression
 * tracking — this is the first use for a visual entrance). Renders children
 * immediately (no layout shift, no hidden-until-JS content) and only adds the
 * animation class client-side, so it degrades to "just visible" without JS
 * and is a no-op under prefers-reduced-motion (handled in globals.css).
 */
export function Reveal({ children, className = '', index = 0, as = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = as;
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLElement>}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={{ '--reveal-index': index } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
