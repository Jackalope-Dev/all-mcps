import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { isOutboundHttpUrl, withAllMcpsUtm } from '../../lib/outboundLinks';
import { CopyBlock } from './CopyBlock';
import { MarkdownImage } from './MarkdownImage';
import { resolveUrl } from './resolveMarkdownUrl';

const customSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'iframe'],
  attributes: {
    ...defaultSchema.attributes,
    iframe: [
      'src',
      'width',
      'height',
      'title',
      'frameborder',
      'allow',
      'allowfullscreen',
      'style',
      'className',
      'loading',
      'referrerpolicy',
    ],
    input: [...(defaultSchema.attributes?.input || []), 'checked', 'className'],
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

function MarkdownLink({
  href,
  children,
  utmContent,
  repoUrl,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  utmContent?: string;
  repoUrl?: string;
}) {
  if (
    !href ||
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  ) {
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

export function SafeMarkdown({
  content,
  isInline,
  utmContent,
  repoUrl,
}: SafeMarkdownProps) {
  let processedContent = content;

  if (isInline) {
    processedContent = processedContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    processedContent = processedContent.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, customSanitizeSchema]]}
        components={{
          p: ({ children }) => (
            <span style={{ display: 'inline' }}>{children}</span>
          ),
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
          <MarkdownLink
            href={href}
            utmContent={utmContent}
            repoUrl={repoUrl}
            {...props}
          >
            {children}
          </MarkdownLink>
        ),
        img: ({ src, alt, node: _node, style, ...props }) => (
          <MarkdownImage
            src={src}
            alt={alt}
            repoUrl={repoUrl}
            style={style}
            {...props}
          />
        ),
        iframe: ({ src, title, node: _node, ...props }) => {
          const isAllowedVideo =
            typeof src === 'string' &&
            (src.startsWith('https://www.youtube.com/embed/') ||
              src.startsWith('https://www.youtube-nocookie.com/embed/'));
          if (!isAllowedVideo) return null;
          return (
            <div
              className="my-6 w-full overflow-hidden rounded-xl border border-[var(--border-color)] bg-black/5 shadow-sm dark:bg-white/5"
              style={{
                position: 'relative',
                width: '100%',
                paddingBottom: '56.25%',
                height: 0,
              }}
            >
              <iframe
                src={src}
                title={title || 'Embedded video'}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                {...props}
              />
            </div>
          );
        },
        pre: ({ children }) => {
          const codeEl = React.isValidElement(children)
            ? (children as React.ReactElement<{
                className?: string;
                children?: React.ReactNode;
              }>)
            : null;
          if (!codeEl) return <pre>{children}</pre>;

          const className = codeEl.props.className || '';
          const match = /language-(\w+)/.exec(className);
          const codeString = String(codeEl.props.children ?? '').replace(
            /\n$/,
            '',
          );
          return <CopyBlock code={codeString} language={match?.[1]} />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
