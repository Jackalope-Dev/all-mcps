'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { OPEN_SEARCH_EVENT } from '../lib/openSearch';

const CommandPalette = dynamic(
  () => import('./ui/CommandPalette').then((m) => m.CommandPalette),
  { ssr: false },
);

function isPaletteHotkey(e: KeyboardEvent) {
  return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
}

/**
 * Lazy-load the command palette so its client graph stays out of the initial
 * landing-page JS. The chunk is fetched on idle (or immediately on ⌘K / Ctrl+K
 * / a search button) — first paint never waits on it.
 *
 * An open request that arrives before the chunk has loaded is remembered and
 * passed as `initialOpen`, so the palette opens as soon as it mounts. Once
 * it reports ready, the palette handles the hotkey and OPEN_SEARCH_EVENT itself.
 *
 * Must be a Client Component: App Router Server Components cannot use
 * `dynamic(..., { ssr: false })`.
 */
export function CommandPaletteLazy() {
  const [load, setLoad] = useState(false);
  const [openOnMount, setOpenOnMount] = useState(false);
  // True once the palette has mounted and owns its listeners. Until then the
  // listeners below stay up — including while the chunk is still downloading.
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (ready) return;
    const requestOpen = () => {
      setOpenOnMount(true);
      setLoad(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isPaletteHotkey(e)) {
        e.preventDefault();
        requestOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, requestOpen);

    let cancelIdle: () => void = () => {};
    if (load) {
      // Already loading; only the open-request listeners are needed.
    } else if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setLoad(true), {
        timeout: 4000,
      });
      cancelIdle = () => window.cancelIdleCallback(id);
    } else {
      const t = window.setTimeout(() => setLoad(true), 2000);
      cancelIdle = () => window.clearTimeout(t);
    }

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, requestOpen);
      cancelIdle();
    };
  }, [load, ready]);

  if (!load) return null;
  return <CommandPalette initialOpen={openOnMount} onReady={markReady} />;
}
