'use client';

import dynamic from 'next/dynamic';

/**
 * Lazy-load the command palette so its client graph (search ranking, markdown
 * preview, lucide icons) stays out of the initial landing-page JS. The palette
 * only opens on ⌘K / Ctrl+K / the header search button — first paint never needs it.
 *
 * Must be a Client Component: App Router Server Components cannot use
 * `dynamic(..., { ssr: false })`.
 */
export const CommandPaletteLazy = dynamic(
  () => import('./ui/CommandPalette').then((m) => m.CommandPalette),
  { ssr: false }
);
