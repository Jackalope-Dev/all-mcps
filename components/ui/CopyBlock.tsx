import { maskPaths } from '../../lib/payloadPaths';
import { CopyBlockClient, type CopyBlockProps } from './CopyBlockClient';

/**
 * Code block with a copy button. No 'use client' here on purpose: rendered
 * from a Server Component, this escapes the slashes in `code` so example
 * paths in a snippet (`/path/to/venv/bin/python3`) don't reach the RSC
 * payload as crawlable "/..." strings. The client half restores the exact
 * text before it renders or copies it.
 */
export function CopyBlock(props: CopyBlockProps) {
  return <CopyBlockClient {...props} code={maskPaths(props.code)} />;
}
