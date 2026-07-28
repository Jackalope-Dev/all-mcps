/**
 * Sequenzy subscriber sync. Fetch-based (Cloudflare Workers has no node:https) —
 * same rationale as lib/stripe.ts's explicit fetch http client.
 */

const SEQUENZY_SUBSCRIBERS_URL = 'https://api.sequenzy.com/api/v1/subscribers';

/** AllMCPs company, "Product Subscribers" list. */
export const PRODUCT_SUBSCRIBERS_LIST_ID = 'x8r0du7z66k34tdyuwnsvxwt';

/** AllMCPs company, "Newsletter Subscribers" list. */
export const NEWSLETTER_SUBSCRIBERS_LIST_ID = 'ta0zh9e3l9rcjlfpzpk80tcn';

export type SequenzySubscriberSync = {
  email: string;
  tags: string[];
  lists?: string[];
  customAttributes?: Record<string, string>;
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
        email: input.email,
        tags: input.tags,
        lists: input.lists,
        customAttributes: input.customAttributes,
        duplicateStrategy: 'merge',
        enrollInSequences: true,
      }),
    });

    if (!res.ok) {
      console.error('Sequenzy subscriber sync failed', res.status, await res.text());
    }
  } catch (e) {
    console.error('Sequenzy subscriber sync error', e);
  }
}
