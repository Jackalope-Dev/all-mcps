import { hueClass } from '../../lib/palette';

/**
 * Blog tag colouring — one mapping for the /blog list, its filter chips and
 * the post header, so a tag keeps the same hue everywhere. "MCP" sits on
 * nearly every post and carries no identity, so it stays neutral.
 */
export function blogTagHueClass(tag: string): string | null {
  return tag === 'MCP' ? null : hueClass(tag);
}

/** Class list for a tag pill (`.content-tag`, tinted when it has a hue). */
export function blogTagClass(tag: string): string {
  const hue = blogTagHueClass(tag);
  return hue ? `content-tag tag-tinted ${hue}` : 'content-tag';
}
