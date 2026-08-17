'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { isOutboundHttpUrl, withAllMcpsUtm } from '../../lib/outboundLinks';
import { CopyBlock } from './CopyBlock';

const customSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    input: [
      ...(defaultSchema.attributes?.input || []),
      'checked',
      'className',
    ],
  },
};

interface SafeMarkdownProps {
  content: string;
  isInline?: boolean;
  /** When set, stored as utm_content on outbound README links (e.g. server id). */
  utmContent?: string;
  /** Repository URL to resolve relative images and links against. */
  repoUrl?: string;
}

/**
 * Resolves relative URLs (e.g. `assets/logo.png`, `./LICENSE`) against a repository URL.
 */
function resolveUrl(url: string | Blob | undefined, repoUrl?: string, isImage?: boolean): string {
  if (!url || typeof url !== 'string') return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('//') ||
    url.startsWith('data:') ||
    url.startsWith('#') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:')
  ) {
    if (isImage && url.includes('github.com/') && url.includes('/blob/')) {
      return url.replace('github.com/', 'raw.githubusercontent.com/').replace('/blob/', '/');
    }
    return url;
  }

  if (!repoUrl) return url;

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!match) return url;

  const owner = match[1];
  let repo = match[2];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);

  const cleanPath = url.replace(/^\.\//, '').replace(/^\//, '');

  if (isImage) {
    return `https://raw.githubusercontent.com/${owner}/${repo}/main/${cleanPath}`;
  }
  return `https://github.com/${owner}/${repo}/blob/main/${cleanPath}`;
}

function MarkdownImage({
  src,
  alt,
  repoUrl,
  style,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement> & { repoUrl?: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) return null;

  const resolvedSrc = resolveUrl(src, repoUrl, true);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt || ''}
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
      style={{
        maxWidth: '100%',
        height: 'auto',
        borderRadius: '8px',
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
      {...rest}
    />
  );
}

function MarkdownLink({
  href,
  children,
  utmContent,
  repoUrl,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { utmContent?: string; repoUrl?: string }) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }

  const resolvedHref = resolveUrl(href, repoUrl, false);
  const trackedHref = isOutboundHttpUrl(resolvedHref)
    ? withAllMcpsUtm(resolvedHref, { content: utmContent })
    : resolvedHref;

  return (
    <a href={trackedHref} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}

export function SafeMarkdown({ content, isInline, utmContent, repoUrl }: SafeMarkdownProps) {
  let processedContent = content;

  if (isInline) {
    processedContent = processedContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    processedContent = processedContent.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, customSanitizeSchema]]}
        components={{
          p: ({ children }) => <span style={{ display: 'inline' }}>{children}</span>,
          a: ({ children }) => <span>{children}</span>,
          img: ({ src, alt }) => (
            <MarkdownImage src={src} alt={alt} repoUrl={repoUrl} />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, customSanitizeSchema]]}
      components={{
        a: ({ href, children, node: _node, ...props }) => (
          <MarkdownLink href={href} utmContent={utmContent} repoUrl={repoUrl} {...props}>
            {children}
          </MarkdownLink>
        ),
        img: ({ src, alt, node: _node, style, ...props }) => (
          <MarkdownImage src={src} alt={alt} repoUrl={repoUrl} style={style} {...props} />
        ),
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
