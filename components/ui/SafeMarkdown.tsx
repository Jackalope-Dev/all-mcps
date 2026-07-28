'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface SafeMarkdownProps {
  content: string;
  isInline?: boolean;
}

export function SafeMarkdown({ content, isInline }: SafeMarkdownProps) {
  let processedContent = content;
  
  // If rendering inline (like in a card paragraph), we want to avoid block wrappers like <p>
  // that might conflict with a parent clamping <div> or <p>.
  // We also strip links to prevent nested <a> tags since cards themselves are links.
  if (isInline) {
    // Strip markdown links [text](url) -> text
    processedContent = processedContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Strip HTML links <a href="...">text</a> -> text
    processedContent = processedContent.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          p: ({ children }) => <span style={{ display: 'inline' }}>{children}</span>,
          a: ({ children }) => <span>{children}</span>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSanitize]}
    >
      {content}
    </ReactMarkdown>
  );
}
