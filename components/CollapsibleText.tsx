'use client';

import { useEffect, useRef, useState } from 'react';

// scrollHeight measures total content height; clientHeight measures visible clamped height
const isOverflowing = (el: HTMLElement) =>
  el.scrollHeight > el.clientHeight + 2;

/**
 * Soft-collapses long body copy (overview paragraphs) so listing pages keep
 * install-first hierarchy without deleting useful content.
 * Automatically measures whether content actually exceeds collapsedLines before
 * rendering the "Read more" toggle button.
 */
export function CollapsibleText({
  children,
  collapsedLines = 4,
  moreLabel = 'Read more',
  lessLabel = 'Show less',
}: {
  children: React.ReactNode;
  collapsedLines?: number;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Re-measure after every render: children are opaque nodes, and new content
  // inside an already-clamped box does not resize it, so the ResizeObserver
  // alone would miss it. Same-value state updates bail out, so this can't loop.
  useEffect(() => {
    const el = contentRef.current;
    if (el) setIsClamped(isOverflowing(el));
  });

  // Re-measure when the box itself resizes (viewport, fonts, expand/collapse).
  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setIsClamped(isOverflowing(el)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="collapsible-text">
      <div
        ref={contentRef}
        className={
          expanded
            ? 'collapsible-text-body is-expanded'
            : 'collapsible-text-body'
        }
        style={
          expanded
            ? undefined
            : ({
                display: '-webkit-box',
                WebkitLineClamp: collapsedLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              } as React.CSSProperties)
        }
      >
        {children}
      </div>
      {(isClamped || expanded) && (
        <button
          type="button"
          className="collapsible-text-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  );
}
