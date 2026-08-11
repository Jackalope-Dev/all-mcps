import dynamic from 'next/dynamic';

// react-markdown requires client hooks internally (useState/useEffect in its
// own implementation), so this — and the remark-gfm/rehype-raw/rehype-sanitize
// pipeline it pulls in — can never run as a pure Server Component. Loading it
// via next/dynamic instead of a plain import splits that ~30-40KB out of every
// page's main JS bundle into its own chunk. `ssr: true` (the default) means
// the server still renders the real markdown HTML synchronously — this only
// changes which chunk the *hydration* JS loads from, not what's painted or
// when, so there's no visible/behavioral change from SafeMarkdownImpl.
export const SafeMarkdown = dynamic(() =>
  import('./SafeMarkdownImpl').then((m) => m.SafeMarkdown)
);
