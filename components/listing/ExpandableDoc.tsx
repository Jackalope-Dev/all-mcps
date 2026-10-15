'use client';

import { ChevronDown } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Height-capped container for the listing writeup / README excerpt. The full
 * text is always in the DOM (server-rendered, indexable); long docs are just
 * visually capped with a fade until the reader asks for the rest, so the
 * sections below (tools, security, reviews) stay within reach.
 */
export function ExpandableDoc({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 8);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={`lst-expand${expanded ? ' is-expanded' : ''}${overflowing && !expanded ? ' is-clamped' : ''}`}
    >
      <div ref={ref} className="lst-expand-body">
        {children}
      </div>
      {(overflowing || expanded) && (
        <button
          type="button"
          className="btn btn-secondary btn-sm lst-expand-btn"
          aria-expanded={expanded}
          onClick={() => {
            if (expanded) {
              ref.current
                ?.closest('section')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            setExpanded((v) => !v);
          }}
        >
          {expanded ? 'Show less' : 'Read the full overview'}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
