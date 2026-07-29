'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * Small info tooltip for the status/verification icons beside a listing title.
 *
 * Desktop (hover-capable pointers) is driven purely by CSS :hover/:focus-within.
 * Touch devices can't rely on that — tapping a non-input element doesn't get a
 * reliable focus/blur on iOS, so the CSS-only tooltip would open on tap and
 * never dismiss. Here a tap toggles an `is-open` class, and an outside tap or
 * Escape closes it. The click toggle is gated to coarse (touch) pointers so it
 * doesn't fight the CSS hover behaviour on desktop.
 */
export function IconTooltip({
  trigger,
  label,
  children,
}: {
  trigger: ReactNode;
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const bubbleId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={`mcp-icon-tooltip${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="mcp-icon-tooltip-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={bubbleId}
        onClick={() => {
          // Only toggle on touch/coarse pointers; hover devices use CSS.
          if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
            setOpen((o) => !o);
          }
        }}
      >
        {trigger}
      </button>
      <span className="mcp-icon-tooltip-bubble" role="tooltip" id={bubbleId}>
        {children}
      </span>
    </span>
  );
}
