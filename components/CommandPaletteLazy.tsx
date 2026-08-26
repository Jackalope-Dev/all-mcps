'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const CommandPalette = dynamic(
  () => import('./ui/CommandPalette').then((m) => m.CommandPalette),
  { ssr: false }
);

function isPaletteHotkey(e: KeyboardEvent) {
  return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
}

/**
 * Lazy-load the command palette so its client graph stays out of the initial
 * landing-page JS. The chunk is fetched on idle (or immediately on ⌘K / Ctrl+K
 * / the header search button) — first paint never waits on it.
 *
 * Must be a Client Component: App Router Server Components cannot use
 * `dynamic(..., { ssr: false })`.
 */
export function CommandPaletteLazy() {
  const [load, setLoad] = useState(false);
  const pendingOpen = useRef(false);

  useEffect(() => {
    const arm = (open = false) => {
      if (open) pendingOpen.current = true;
      setLoad(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isPaletteHotkey(e)) {
        e.preventDefault();
        arm(true);
      }
    };
    window.addEventListener('keydown', onKey);

    let cancelIdle: () => void;
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => arm(false), { timeout: 4000 });
      cancelIdle = () => window.cancelIdleCallback(id);
    } else {
      const t = window.setTimeout(() => arm(false), 2000);
      cancelIdle = () => window.clearTimeout(t);
    }

    return () => {
      window.removeEventListener('keydown', onKey);
      cancelIdle();
    };
  }, []);

  useEffect(() => {
    if (!load || !pendingOpen.current) return;
    pendingOpen.current = false;
    const t = window.setTimeout(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true })
      );
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  if (!load) return null;
  return <CommandPalette />;
}
