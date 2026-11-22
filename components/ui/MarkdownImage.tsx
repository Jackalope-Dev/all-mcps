'use client';

import type React from 'react';
import { useState } from 'react';

/**
 * The one interactive piece of rendered markdown: hides an image whose URL
 * 404s instead of leaving a broken-image icon. Kept as its own client leaf so
 * the markdown pipeline itself renders on the server and never ships to the
 * browser for server-rendered pages. SafeMarkdown resolves `src` against the
 * repository before it gets here, so no relative path reaches the payload.
 */
export function MarkdownImage({
  src,
  alt,
  style,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [hasError, setHasError] = useState(false);

  if (hasError) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || ''}
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
