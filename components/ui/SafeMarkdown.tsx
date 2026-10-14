// Re-exported directly (no next/dynamic): SafeMarkdownImpl has no 'use client'
// boundary, so a Server Component renders markdown entirely on the server and
// ships none of react-markdown/remark/rehype (~320 KB raw) to the browser. Only
// the image and copy-button leaves hydrate. A Client Component that imports it
// still bundles the pipeline, so cards and lists use InlineMarkdown instead.
export { SafeMarkdown } from './SafeMarkdownImpl';
