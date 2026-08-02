/**
 * Sequenzy transactional email sends (saved template by API slug).
 * Best-effort: never throws. Falls through silently when key/scope missing.
 */

import { getEnv } from './env';

/** SDK-equivalent: client.transactional.send({ to, slug, variables }) */
const SEQUENZY_TRANSACTIONAL_URL = 'https://api.sequenzy.com/api/v1/transactional/send';
const TIMEOUT_MS = 8000;

/** Saved transactional templates (API slugs) used by AllMCPs. */
export const SEQUENZY_TX = {
  /** Fired when admin approves a pending listing — promotes claim + free dofollow. */
  LISTING_APPROVED: 'listing-approved',
} as const;

export type SequenzyTransactionalSend = {
  /** Recipient email */
  to: string;
  /** API slug, e.g. listing-approved */
  slug: string;
  /** Merge variables — pass both camelCase and UPPER_SNAKE for template safety */
  variables?: Record<string, string>;
};

async function resolveApiKey(): Promise<string | undefined> {
  // Prefer a dedicated transactional key when present; fall back to the main key.
  return (
    (await getEnv('SEQUENZY_TRANSACTIONAL_API_KEY')) ||
    (await getEnv('SEQUENZY_API_KEY')) ||
    undefined
  );
}

/**
 * Queue a saved transactional email. Returns true if Sequenzy accepted the send.
 */
export async function sendSequenzyTransactional(
  input: SequenzyTransactionalSend
): Promise<boolean> {
  const key = await resolveApiKey();
  if (!key) {
    console.warn('Sequenzy transactional skipped: no API key');
    return false;
  }

  const to = input.to.trim().toLowerCase();
  if (!to || !input.slug) return false;

  // Normalize variables: Sequenzy generators sometimes expect UPPER_SNAKE,
  // while templates may use camelCase — send both when we have a simple map.
  const variables: Record<string, string> = { ...(input.variables || {}) };
  for (const [k, v] of Object.entries(input.variables || {})) {
    const upper = k
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/-/g, '_')
      .toUpperCase();
    if (!(upper in variables)) variables[upper] = v;
    const lowerCamel = k.charAt(0).toLowerCase() + k.slice(1);
    if (!(lowerCamel in variables) && k !== lowerCamel) variables[lowerCamel] = v;
  }

  try {
    const res = await fetch(SEQUENZY_TRANSACTIONAL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: input.slug,
        to,
        variables,
        emailType: 'transactional',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      // Don't log body (may echo email). Status alone is enough for ops.
      console.error('Sequenzy transactional send failed', res.status, input.slug);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Sequenzy transactional send error', e);
    return false;
  }
}
