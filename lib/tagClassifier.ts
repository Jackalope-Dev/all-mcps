/**
 * Tags a listing from the fixed vocabulary (lib/tagVocabulary.ts).
 *
 * Runtime tags (Python, Node.js, Docker, Remote) come straight from the
 * listing's install data. Every other tag is a yes/no question to Jev, asked
 * only for the tags whose `hint` matches the listing's text — so a Slack
 * server is asked about Slack and messaging, not about all ~100 tags. A tag is
 * applied only when Jev is confident it is a core part of what the server
 * does; a passing mention of the word is not enough.
 *
 * Returns null when Jev is unavailable or errors, so callers keep the
 * listing's existing tags rather than wiping them. Never throws.
 */

import { toolNamesFromJson } from './listingReview';
import { TAG_VOCABULARY, type TagDefinition } from './tagVocabulary';
import { askJev, type JevQuestion, noulVerdict } from './typesafe';

/** Jev's probability that the tag applies; at or above this it's applied. */
const TAG_CONFIDENCE_FLOOR = 0.75;
/** Most candidate tags sent to Jev for one listing. */
const MAX_CANDIDATES = 14;
/** Most non-runtime tags kept per listing (most probable first). */
const MAX_TAGS = 5;

export type ListingForTagging = {
  name?: string | null;
  description?: string | null;
  url?: string | null;
  aiSummary?: string | null;
  aiOverview?: string | null;
  /** Stored tools JSON; only the tool names are used. */
  tools?: string | null;
  installKind?: string | null;
  installCommand?: string | null;
  remoteEndpointUrl?: string | null;
};

/** Runtime tags from install data — facts, not judgement, so no Jev call. */
export function runtimeTags(listing: ListingForTagging): string[] {
  const out: string[] = [];
  const cmd = (listing.installCommand ?? '').trim().toLowerCase();
  if (listing.installKind === 'remote' || listing.remoteEndpointUrl) {
    out.push('remote');
  }
  if (/^(npx|bunx|pnpm|npm|yarn|node)\b/.test(cmd)) out.push('nodejs');
  if (/^(uvx|uv|pip|pipx|python3?)\b/.test(cmd)) out.push('python');
  if (/^docker\b/.test(cmd)) out.push('docker');
  return out;
}

/** Vocabulary tags worth asking Jev about, by hint match, capped. */
export function candidateTags(listing: ListingForTagging): TagDefinition[] {
  // Tool names are snake/kebab case; split them so \b-anchored hints match.
  const toolText = toolNamesFromJson(listing.tools)
    .map((n) => n.replace(/[_-]+/g, ' '))
    .join(' ');
  const text = [
    listing.name,
    listing.description,
    listing.aiSummary,
    (listing.aiOverview ?? '').slice(0, 1200),
    toolText,
  ]
    .filter(Boolean)
    .join(' ');
  if (!text.trim()) return [];
  return TAG_VOCABULARY.filter((t) => t.hint?.test(text)).slice(
    0,
    MAX_CANDIDATES,
  );
}

function tagQuestion(tag: TagDefinition): JevQuestion {
  return {
    type: 'noul',
    instructions: `Is this true of this Model Context Protocol (MCP) server: "${tag.definition}" Judge by what its tools let an AI assistant actually do. A passing mention of the word, a dependency, or where the code is hosted does not count.`,
  };
}

/**
 * The listing's tags as vocabulary slugs (non-runtime first, most probable
 * first, then runtime), or null when Jev could not answer.
 */
export async function classifyTags(
  listing: ListingForTagging,
): Promise<string[] | null> {
  const runtime = runtimeTags(listing);
  const candidates = candidateTags(listing);
  if (candidates.length === 0) return runtime;

  const questions: Record<string, JevQuestion> = {};
  for (const tag of candidates) questions[tag.slug] = tagQuestion(tag);

  const toolNames = toolNamesFromJson(listing.tools);
  const res = await askJev(
    {
      name: listing.name ?? '',
      description: listing.description ?? '',
      url: listing.url ?? '',
      summary: (listing.aiSummary ?? '').slice(0, 600),
      overview: (listing.aiOverview ?? '').slice(0, 1200),
      tool_names: toolNames,
    },
    questions,
  );
  if (!res) return null;

  const picked = candidates
    .map((tag) => ({ tag, answer: res.answers[tag.slug] }))
    .filter(({ answer }) => noulVerdict(answer, TAG_CONFIDENCE_FLOOR))
    .sort((a, b) => (b.answer?.noul ?? 0) - (a.answer?.noul ?? 0))
    .slice(0, MAX_TAGS)
    .map(({ tag }) => tag.slug);

  return [...picked, ...runtime];
}
