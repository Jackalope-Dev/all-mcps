import { hueClass } from '../../lib/palette';

/**
 * Blog tag colouring — one mapping for the /blog list, its filter chips and
 * the post header, so a tag keeps the same hue everywhere.
 */
export function blogTagHueClass(tag: string): string {
  return hueClass(tag);
}

/** Class list for a tinted tag pill (`.content-tag`). */
export function blogTagClass(tag: string): string {
  return `content-tag tag-tinted ${blogTagHueClass(tag)}`;
}
