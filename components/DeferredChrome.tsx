'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const WebMCPProvider = dynamic(
  () => import('./WebMCPProvider').then((m) => m.WebMCPProvider),
  { ssr: false }
);
const NewsletterModal = dynamic(
  () => import('./NewsletterModal').then((m) => m.NewsletterModal),
  { ssr: false }
);
const FloatingStackDock = dynamic(
  () => import('./ui/FloatingStackDock').then((m) => m.FloatingStackDock),
  { ssr: false }
);

/**
 * Below-the-fold chrome that must not compete with hydration.
 * These modules are downloaded after first idle (or 1.2s fallback) so the
 * landing page's main JS can hydrate without waiting on WebMCP enums,
 * the newsletter modal, or the stack dock.
 */
export function DeferredChrome() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const arm = () => setReady(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(arm, { timeout: 3500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(arm, 1200);
    return () => window.clearTimeout(t);
  }, []);

  if (!ready) return null;

  return (
    <>
      <WebMCPProvider />
      <NewsletterModal />
      <FloatingStackDock />
    </>
  );
}
