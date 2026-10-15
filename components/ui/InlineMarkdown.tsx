import type React from 'react';

/**
 * One-line descriptions in cards, lists and the command palette. They only
 * ever need `code`, **bold** and *italic*: links are flattened (the whole card
 * is already a link) and raw HTML is dropped. Rendering them through the full
 * react-markdown + GFM + rehype pipeline put ~320 KB of parser JS into the
 * homepage and /browse bundles for three kinds of emphasis.
 *
 * Output is plain React text, so nothing from the description is ever
 * interpreted as HTML.
 */
const TOKEN = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\s][^*\n]*\*)/g;

function flatten(text: string): string {
  return (
    text
      // [label](url) and ![alt](src) → label / alt
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      // <tags> are dropped, their text kept
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      // heading / quote / list markers at the start
      .replace(/^\s{0,3}(#{1,6}\s+|>\s+|[-*+]\s+)/, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function InlineMarkdown({ content }: { content: string }) {
  const text = flatten(content);
  const parts = text.split(TOKEN);
  const out: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${i}-${part.length}`;
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      out.push(<code key={key}>{part.slice(1, -1)}</code>);
    } else if (
      part.length > 4 &&
      ((part.startsWith('**') && part.endsWith('**')) ||
        (part.startsWith('__') && part.endsWith('__')))
    ) {
      out.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      out.push(<em key={key}>{part.slice(1, -1)}</em>);
    } else {
      out.push(part);
    }
  });
  return <>{out}</>;
}
