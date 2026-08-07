'use client';

import { useState } from 'react';

/**
 * Soft-collapses long body copy (overview paragraphs) so listing pages keep
 * install-first hierarchy without deleting useful content.
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

  return (
    <div className="collapsible-text">
      <div
        className={expanded ? 'collapsible-text-body is-expanded' : 'collapsible-text-body'}
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
      <button
        type="button"
        className="collapsible-text-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? lessLabel : moreLabel}
      </button>
    </div>
  );
}
