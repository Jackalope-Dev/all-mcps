/**
 * Sequenzy subscriber sync. Fetch-based (Cloudflare Workers has no node:https) —
 * same rationale as lib/stripe.ts's explicit fetch http client.
 */

const SEQUENZY_SUBSCRIBERS_URL = 'https://api.sequenzy.com/api/v1/subscribers';
const SEQUENZY_FETCH_TIMEOUT_MS = 5000;

/** AllMCPs company, "Product Subscribers" list. */
export const PRODUCT_SUBSCRIBERS_LIST_ID = 'x8r0du7z66k34tdyuwnsvxwt';

/** AllMCPs company, "Newsletter Subscribers" list. */
export const NEWSLETTER_SUBSCRIBERS_LIST_ID = 'ta0zh9e3l9rcjlfpzpk80tcn';

export type SequenzySubscriberSync = {
  email: string;
  tags: string[];
  lists?: string[];
  customAttributes?: Record<string, string>;
  /**
   * Only a submit-flow opt-in should enroll into sequences. A purchase-tagging call
   * must not request it: Sequenzy's native Stripe integration applies the `customer`
   * suppression tag asynchronously, and a fresh purchaser enrolled before that lands
   * could get an "you never paid" sequence. Defaults to false.
   */
  enrollInSequences?: boolean;
};

/**
 * Best-effort create-or-tag a Sequenzy subscriber. Never throws — callers run this
 * alongside a submission or Stripe webhook and must not fail because Sequenzy is down.
 * Always merges (adds tags to an existing subscriber) rather than skipping or overwriting.
 */
export async function syncSequenzySubscriber(input: SequenzySubscriberSync): Promise<void> {
  const key = process.env.SEQUENZY_API_KEY;
  if (!key) {
    console.warn('SEQUENZY_API_KEY not configured; skipping Sequenzy sync');
    return;
  }

  try {
    const res = await fetch(SEQUENZY_SUBSCRIBERS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Normalized once here so the submit-flow and webhook call sites can never
        // create two subscribers for the same person over a case/whitespace mismatch
        // — which would defeat duplicateStrategy: 'merge' and drop the paid-* tag.
        email: input.email.trim().toLowerCase(),
        tags: input.tags,
        lists: input.lists,
        customAttributes: input.customAttributes,
        duplicateStrategy: 'merge',
        enrollInSequences: input.enrollInSequences ?? false,
      }),
      // Outbound fetches from Workers occasionally hang well past what's reasonable
      // (same rationale as lib/stripe.ts) — this call sits on the Stripe webhook's
      // critical path, and an unbounded hang there risks a Stripe retry that
      // re-applies a non-idempotent entitlement (e.g. another 7 days of Featured).
      signal: AbortSignal.timeout(SEQUENZY_FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Don't log the response body — Sequenzy validation errors commonly echo the
      // submitted email, and this app doesn't put PII in log retention anywhere else.
      console.error('Sequenzy subscriber sync failed', res.status);
    }
  } catch (e) {
    console.error('Sequenzy subscriber sync error', e);
  }
}
