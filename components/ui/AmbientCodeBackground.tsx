import React from 'react';
import { AsciiCodeCanvas } from './AsciiCodeCanvas';

/**
 * Decorative, non-interactive backdrop for marketing hero/section surfaces.
 *
 * Combines Firecrawl's signature ruled graph-paper grid and ASCII tags/blobs
 * with a high-performance interactive ASCII/code particle canvas, tailored
 * to AllMCPs' electric cyan & sapphire blue theme and Model Context Protocol
 * terminology.
 *
 * Render as the first child of a `position: relative; overflow: hidden`
 * full-width section (see .landing-hero-section) — this fills it edge to
 * edge and sits behind normal content via a negative z-index.
 */
const TAGS = [
  { text: '[ 200 OK ]', className: 'ambient-tag-tl' },
  { text: '[ STDIO ]', className: 'ambient-tag-tr' },
  { text: '[ TOOLS/LIST ]', className: 'ambient-tag-bl' },
  { text: '[ .JSON ]', className: 'ambient-tag-br' },
];

const BLOB_ROWS = [
  '        . . .',
  '      . x x x .',
  '    . x X X X x .',
  '  . x X X # X X x .',
  '  . x X # # # X x .',
  '  . x X X # X X x .',
  '    . x X X X x .',
  '      . x x x .',
  '        . . .',
];

function AsciiBlob({ className }: { className: string }) {
  return (
    <pre className={`ambient-blob ${className}`} aria-hidden="true">
      {BLOB_ROWS.join('\n')}
    </pre>
  );
}

export function AmbientCodeBackground() {
  return (
    <div className="ambient-code-bg" aria-hidden="true">
      <div className="ambient-grid" />
      <AsciiCodeCanvas opacity={0.45} density={28} />
      <AsciiBlob className="ambient-blob-left" />
      <AsciiBlob className="ambient-blob-right" />
      {TAGS.map((tag) => (
        <span key={tag.text} className={`ambient-tag ${tag.className}`}>
          {tag.text}
        </span>
      ))}
      <div className="ambient-code-fade" />
    </div>
  );
}
