'use client';

import { useEffect, useState } from 'react';

const GLYPHS = '!<>-_\\/[]{}-=+*^?#01mcpMCP';

function scrambleChar(ch: string) {
  if (ch === ' ' || ch === '\n') return ch;
  return GLYPHS[(Math.random() * GLYPHS.length) | 0];
}

/**
 * Firecrawl playground decode: lock characters left-to-right after a brief
 * scramble. Opacity-only when the user prefers reduced motion.
 */
export function ScrambleCode({
  text,
  replayKey,
}: {
  text: string;
  replayKey: string;
}) {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduce) {
      setShown(text);
      return;
    }

    let locked = 0;
    let frame = 0;
    let id = 0;
    const total = text.length;
    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;
      // Reveal over ~420ms, locking ~chars in bursts so long snippets don't crawl.
      locked = Math.min(total, Math.floor((elapsed / 420) * total) + 1);
      const next = text
        .split('')
        .map((ch, i) => (i < locked ? ch : scrambleChar(ch)))
        .join('');
      setShown(next);
      frame += 1;
      if (locked < total && frame < 80) {
        id = window.setTimeout(tick, 28);
      } else {
        setShown(text);
      }
    };

    setShown(text.split('').map(scrambleChar).join(''));
    id = window.setTimeout(tick, 28);
    return () => window.clearTimeout(id);
  }, [text, replayKey]);

  return <>{shown}</>;
}
