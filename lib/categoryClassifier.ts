/**
 * Listing category classification.
 *
 * The catalog's categories were assigned by a first-match-wins regex list that
 * returns nothing when no rule hits, and the miss falls through to
 * `DEFAULT_SUBMIT_CATEGORY` — which is "💻 Developer Tools". That is why that
 * one bucket holds roughly 38% of the catalog: it means both "this is a
 * developer tool" and "we could not tell", and nothing downstream can
 * distinguish the two.
 *
 * Jev's choice primitive answers the question directly against the real
 * category list and reports how sure it is. We only take the answer when it
 * clears a confidence bar; below that we keep whatever the caller already had,
 * because a low-confidence reassignment is worse than an honest default.
 *
 * Falls back to the caller's existing value on every failure — see lib/typesafe.ts.
 */

import { DIRECTORY_CATEGORIES } from './categories';
import { askJev, confidentChoice, type JevChoiceQuestion } from './typesafe';

/**
 * Below this we keep the existing category. Calibrated against a sample of live
 * listings: unambiguous ones answered at 0.96–1.00, genuinely unclear ones at
 * 0.26–0.54, so this cleanly separates "knows" from "guessing".
 */
export const CATEGORY_CONFIDENCE_FLOOR = 0.75;

/** Category labels carry a leading emoji; option keys are the text after it. */
function optionKey(category: string): string {
  return category.replace(/^[^\p{L}]+/u, '').trim();
}

const KEY_TO_CATEGORY = new Map(
  DIRECTORY_CATEGORIES.map((c) => [optionKey(c), c] as const),
);

const CATEGORY_CRITERIA: Record<string, string | null> = Object.fromEntries(
  DIRECTORY_CATEGORIES.map((c) => [optionKey(c), null]),
);

export type ListingForClassification = {
  name?: string | null;
  description?: string | null;
  url?: string | null;
};

export type CategoryClassification = {
  category: string;
  confidence: number;
  /** False when we kept the caller's value because Jev was unavailable or unsure. */
  fromJev: boolean;
};

const categoryQuestion: JevChoiceQuestion = {
  type: 'choice',
  instructions:
    'Which directory category best fits this Model Context Protocol (MCP) server?',
  criteria: CATEGORY_CRITERIA,
};

/**
 * Best category for a listing, or `currentCategory` unchanged when Jev is
 * unavailable, errors, or is not confident enough to improve on it.
 *
 * Never throws.
 */
export async function classifyCategory(
  listing: ListingForClassification,
  currentCategory: string,
  minConfidence: number = CATEGORY_CONFIDENCE_FLOOR,
): Promise<CategoryClassification> {
  const keep: CategoryClassification = {
    category: currentCategory,
    confidence: 0,
    fromJev: false,
  };

  if (!listing.name && !listing.description) return keep;

  const res = await askJev(
    {
      name: listing.name ?? '',
      description: listing.description ?? '',
      url: listing.url ?? '',
    },
    { category: categoryQuestion },
  );
  if (!res) return keep;

  const answer = res.answers.category;
  const picked = confidentChoice(answer, minConfidence);
  if (!picked) return keep;

  // The model can only return keys we sent, but map defensively rather than
  // writing an unknown string into the category column.
  const category = KEY_TO_CATEGORY.get(picked);
  if (!category) return keep;

  return { category, confidence: answer?.confidence ?? 0, fromJev: true };
}
