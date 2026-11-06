import { BEST_TOPICS, type BestTopic, CATEGORY_TOPICS } from './bestTopics';
import {
  categoryFromSlug,
  categorySlug,
  parseCategoryLabel,
} from './categories';

export type HubLink = { href: string; label: string };

type PostText = {
  title: string;
  tags: string[];
  keywords: string[];
  content: string;
};

/** Words a post must use for a topic to count as related to it. */
function topicTerms(topic: BestTopic): string[] {
  if (topic.match && topic.match.length > 0) return topic.match;
  // Category topics have no match list: use the title's parts ("Web Search
  // & Scraping" -> "web search", "scraping") and the slug as words.
  const parts = topic.title
    .split(/\s*&\s*|\s+and\s+/i)
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 2);
  return [...new Set([...parts, topic.slug.replace(/-/g, ' ')])];
}

function countMatches(text: string, terms: string[]): number {
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'gi');
  return text.match(re)?.length ?? 0;
}

/**
 * Topics whose words appear in nearly every MCP post ("developers"), so a
 * match says nothing about what the post covers.
 */
const GENERIC_TOPICS = new Set(['developer-tools']);

/**
 * Topics whose words have a common protocol meaning on this blog: the HTTP
 * Location header, agent "memory", "research" as a verb. They count only when
 * the title, tags or keywords name them, never from body mentions alone.
 */
const HEAD_ONLY_TOPICS = new Set([
  'location-services',
  'memory-knowledge',
  'research',
  'marketing',
  'legal',
  'gaming',
  'travel',
]);

/** Body mentions count at most this many times, so one long section can't swamp the title. */
const BODY_MATCH_CAP = 5;
/** A topic must score at least this to be linked (one title/tag hit, or three body mentions). */
const MIN_SCORE = 3;

/**
 * Directory hubs a blog post is about: /best/<topic> pages, plus the matching
 * /categories/<slug> hub for category topics. Blog posts used to link only
 * other posts, so the editorial pages never passed links into the directory.
 * Title, tags and LopeBase keywords weigh most; body mentions add a capped
 * amount. Falls back to the /best and /categories indexes so every post links
 * the directory.
 */
export function relatedHubsForPost(post: PostText, maxLinks = 6): HubLink[] {
  const head = [post.title, ...post.tags, ...post.keywords].join(' \n ');
  const scored = BEST_TOPICS.filter((t) => !GENERIC_TOPICS.has(t.slug))
    .map((topic) => {
      const terms = topicTerms(topic);
      const headHits = countMatches(head, terms);
      if (headHits === 0 && HEAD_ONLY_TOPICS.has(topic.slug)) {
        return { topic, score: 0 };
      }
      const score =
        headHits * MIN_SCORE +
        Math.min(BODY_MATCH_CAP, countMatches(post.content, terms));
      return { topic, score };
    })
    .filter((t) => t.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  const links: HubLink[] = [];
  const seen = new Set<string>();
  const push = (link: HubLink) => {
    if (seen.has(link.href) || links.length >= maxLinks) return;
    seen.add(link.href);
    links.push(link);
  };
  for (const { topic } of scored) {
    push({
      href: `/best/${topic.slug}`,
      label: `Best ${topic.title} MCP servers`,
    });
    const category =
      CATEGORY_TOPICS.includes(topic) && topic.categorySlug
        ? categoryFromSlug(topic.categorySlug)
        : undefined;
    if (category) {
      push({
        href: `/categories/${categorySlug(category)}`,
        label: `All ${parseCategoryLabel(category).label} servers`,
      });
    }
  }
  if (links.length === 0) {
    push({ href: '/best', label: 'Best MCP servers by topic' });
    push({ href: '/categories', label: 'Browse MCP servers by category' });
  }
  return links;
}
