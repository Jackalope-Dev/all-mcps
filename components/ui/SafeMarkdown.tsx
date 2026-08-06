'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { isOutboundHttpUrl, withAllMcpsUtm } from '../../lib/outboundLinks';
import { CopyBlock } from './CopyBlock';

interface SafeMarkdownProps {
  content: string;
  isInline?: boolean;
  /** When set, stored as utm_content on outbound README links (e.g. server id). */
  utmContent?: string;
}

function MarkdownLink({
  href,
  children,
  utmContent,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { utmContent?: string }) {
  // In-page anchors stay same-tab, no UTM
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }

  const trackedHref = isOutboundHttpUrl(href)
    ? withAllMcpsUtm(href, { content: utmContent })
    : href;

  return (
    <a
      href={trackedHref}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
    </a>
  );
}

export function SafeMarkdown({ content, isInline, utmContent }: SafeMarkdownProps) {
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
      components={{
        a: ({ href, children, node: _node, ...props }) => (
          <MarkdownLink href={href} utmContent={utmContent} {...props}>
            {children}
          </MarkdownLink>
        ),
        // Fenced code blocks (```lang ... ```) always render as <pre><code>; inline
        // `code` spans never do. Intercepting <pre> lets fenced blocks get the full
        // CopyBlock treatment while inline code keeps the plain markdown-body pill style.
        pre: ({ children }) => {
          const codeEl = React.isValidElement(children)
            ? (children as React.ReactElement<{ className?: string; children?: React.ReactNode }>)
            : null;
          if (!codeEl) return <pre>{children}</pre>;

          const className = codeEl.props.className || '';
          const match = /language-(\w+)/.exec(className);
          const codeString = String(codeEl.props.children ?? '').replace(/\n$/, '');
          return <CopyBlock code={codeString} language={match?.[1]} />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
