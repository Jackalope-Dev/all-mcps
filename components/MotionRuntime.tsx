'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type ProgressState = 'idle' | 'loading' | 'done';

/**
 * Site-wide motion glue, mounted once in the root layout:
 *
 * 1. Navigation progress — a 2px brand bar that starts the instant an
 *    internal link to another page is clicked and completes when the new
 *    pathname commits, so every navigation gets immediate feedback even
 *    before a loading.tsx skeleton could paint.
 * 2. Pointer spotlight — one delegated pointermove listener writes --mx/--my
 *    onto whichever `.spotlight` element is under the cursor (the gradient
 *    itself is pure CSS). No per-card listeners or re-renders.
 */
export function MotionRuntime() {
  const pathname = usePathname();
  const [state, setState] = useState<ProgressState>('idle');
  const safetyTimer = useRef<number | undefined>(undefined);
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    window.clearTimeout(safetyTimer.current);
    setState((s) => (s === 'loading' ? 'done' : s));
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor?.href) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      // API routes, feeds, and files are full document loads, not app navs.
      if (/^\/api\/|\.(xml|txt|json|md|png|svg)$/.test(url.pathname)) return;

      setState('loading');
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = window.setTimeout(() => setState('done'), 10000);
    };

    let frame = 0;
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      if (frame) return;
      const target = event.target as Element | null;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const el = target?.closest?.<HTMLElement>('.spotlight');
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        el.style.setProperty('--my', `${event.clientY - rect.top}px`);
      });
    };

    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      document.removeEventListener('pointermove', onPointerMove);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(safetyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (state !== 'done') return;
    const t = window.setTimeout(() => setState('idle'), 450);
    return () => window.clearTimeout(t);
  }, [state]);

  return <div className="nav-progress" data-state={state} aria-hidden="true" />;
}
