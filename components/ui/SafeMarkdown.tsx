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
  // If rendering inline (like in a card paragraph), we want to avoid block wrappers like <p>
  // that might conflict with a parent clamping <div> or <p>.
  if (isInline) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          p: ({ children }) => <span style={{ display: 'inline' }}>{children}</span>,
        }}
      >
        {content}
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
