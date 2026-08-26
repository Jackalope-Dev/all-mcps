import React from 'react';

interface SectionKickerProps {
  index?: number | string;
  total?: number;
  label: string;
  aside?: string;
}

function pad(value: number | string, width = 2) {
  return String(value).padStart(width, '0');
}

/** Firecrawl-style section index: `[ 01 / 06 ] · Discovery // Agent Ready` */
export function SectionKicker({ index, total = 6, label, aside }: SectionKickerProps) {
  return (
    <p className="section-kicker">
      {index != null ? (
        <>
          <span className="section-kicker-index">
            [ {pad(index)} / {pad(total)} ]
          </span>
          <span className="section-kicker-dot" aria-hidden="true">
            ·
          </span>
        </>
      ) : null}
      <span className="section-kicker-label">{label}</span>
      {aside ? (
        <>
          <span className="section-kicker-slash" aria-hidden="true">
            {'//'}
          </span>
          <span className="section-kicker-aside">{aside}</span>
        </>
      ) : null}
    </p>
  );
}
