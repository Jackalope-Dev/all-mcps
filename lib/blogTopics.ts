/**
 * The fixed set of blog tags. Each post carries one or two, main topic first
 * (it labels the post's OG image). A closed list keeps the /blog filter row
 * short and stops near-synonyms ("Developer Tools" vs "Architecture") from
 * splitting the same posts across chips.
 */
export const BLOG_TOPICS = [
  'Building Servers',
  'Deployment',
  'Security',
  'Using MCP',
  'Directory & News',
] as const;

export const MAX_POST_TOPICS = 2;

export function isBlogTopic(tag: string): boolean {
  return (BLOG_TOPICS as readonly string[]).includes(tag);
}
