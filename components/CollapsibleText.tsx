'use client';

import { useEffect, useRef, useState } from 'react';

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

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const checkClamped = () => {
      // scrollHeight measures total content height; clientHeight measures visible clamped height
      const overflow = el.scrollHeight > el.clientHeight + 2;
      setIsClamped(overflow);
    };

    checkClamped();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => checkClamped());
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [children, collapsedLines]);

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
