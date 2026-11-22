import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { MARKDOWN_LINK_REL } from '../../lib/linkRel';
import {
  isOutboundHttpUrl,
  ownSitePath,
  withAllMcpsUtm,
} from '../../lib/outboundLinks';
import { rehypeSplitLeadingSlash } from '../../lib/rehypeSplitLeadingSlash';
import { resolveRepoLink } from '../../lib/repoLinks';
import { CopyBlock } from './CopyBlock';
import { MarkdownImage } from './MarkdownImage';

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
  /**
   * Our own writing (blog posts): root-relative links like `/mcp/x` are our
   * pages. Everything else is a listing's README or writeup, whose relative
   * links point into its repository and never at allmcps.com.
   */
  ownContent?: boolean;
}

const REHYPE_PLUGINS = [
  rehypeRaw,
  [rehypeSanitize, customSanitizeSchema],
  rehypeSplitLeadingSlash,
] as NonNullable<React.ComponentProps<typeof ReactMarkdown>['rehypePlugins']>;

/** An image's src, resolved on the server so no relative path ships to the client. */
function imageSrc(
  src: unknown,
  repoUrl: string | undefined,
  ownContent: boolean | undefined,
): string | null {
  if (ownContent) return typeof src === 'string' && src ? src : null;
  return resolveRepoLink(src, repoUrl, true);
}

function MarkdownLink({
  href,
  children,
  utmContent,
  repoUrl,
  ownContent,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  utmContent?: string;
  repoUrl?: string;
  ownContent?: boolean;
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

  // Our own pages (blog posts link them as absolute allmcps.com URLs, or as
  // root-relative paths when there is no repo to resolve against): a plain,
  // followed, same-tab internal link.
  const ownPath =
    ownSitePath(href) ??
    (ownContent && href.startsWith('/') && !href.startsWith('//')
      ? href
      : null);
  if (ownPath) {
    const { target: _target, rel: _rel, ...safe } = rest;
    return (
      <a {...safe} href={ownPath}>
        {children}
      </a>
    );
  }

  // A listing's relative link resolves into its repository; one that can't
  // (no GitHub repo, or a path above the repo root) stays readable as plain
  // text instead of becoming a link that 404s on allmcps.com.
  const resolvedHref = ownContent ? href : resolveRepoLink(href, repoUrl);
  if (!resolvedHref) return <span>{children}</span>;
  const trackedHref = isOutboundHttpUrl(resolvedHref)
    ? withAllMcpsUtm(resolvedHref, { content: utmContent })
    : resolvedHref;

  return (
    // README / description text comes from the listing's source, not from us,
    // so its links carry ugc nofollow (set after `rest` so raw HTML can't
    // override it). See lib/linkRel.ts.
    <a {...rest} href={trackedHref} target="_blank" rel={MARKDOWN_LINK_REL}>
      {children}
    </a>
  );
}

export function SafeMarkdown({
  content,
  isInline,
  utmContent,
  repoUrl,
  ownContent,
}: SafeMarkdownProps) {
  let processedContent = content;

  if (isInline) {
    processedContent = processedContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    processedContent = processedContent.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={REHYPE_PLUGINS}
        components={{
          p: ({ children }) => (
            <span style={{ display: 'inline' }}>{children}</span>
          ),
          a: ({ children }) => <span>{children}</span>,
          img: ({ src, alt }) => {
            const resolved = imageSrc(src, repoUrl, ownContent);
            return resolved ? <MarkdownImage src={resolved} alt={alt} /> : null;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={REHYPE_PLUGINS}
      components={{
        // Embedded markdown always sits under the page's own <h1>, so a
        // README/doc "# Title" is demoted to keep one h1 per page.
        h1: ({ node: _node, ...props }) => <h2 {...props} />,
        a: ({ href, children, node: _node, ...props }) => (
          <MarkdownLink
            href={href}
            utmContent={utmContent}
            repoUrl={repoUrl}
            ownContent={ownContent}
            {...props}
          >
            {children}
          </MarkdownLink>
        ),
        img: ({ src, alt, node: _node, style, ...props }) => {
          const resolved = imageSrc(src, repoUrl, ownContent);
          if (!resolved) return null;
          return (
            <MarkdownImage {...props} src={resolved} alt={alt} style={style} />
          );
        },
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
