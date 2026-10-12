import { isSafeSubmissionUrl } from './urlSafety';

/**
 * Advertiser-proposed copy/link edits to a sponsor ad, held on
 * `sponsor_ads.pending_revision` until an admin approves them onto the live
 * row (mirrors the listing flow in lib/pendingRevision.ts).
 *
 * Only creative fields are editable. Impression allocation reads status,
 * remaining impressions, placement and bidCpm (see selectWeightedAd and
 * app/api/ads/serve), so none of these keys can change how many impressions
 * an ad gets or where it shows. Click tracking never sees the URL (the event
 * token signs only the ad id), so changing targetUrl mid-run is safe.
 */

export type EditableAdFields = {
  title: string;
  description: string;
  ctaText: string;
  targetUrl: string;
};

export type AdRevision = {
  proposed: Partial<EditableAdFields>;
  submittedAt: string;
};

export const AD_EDITABLE_KEYS: (keyof EditableAdFields)[] = [
  'title',
  'description',
  'ctaText',
  'targetUrl',
];

/** Campaigns an advertiser may still edit; completed/rejected ones are final. */
export const AD_EDITABLE_STATUSES = new Set([
  'pending_approval',
  'active',
  'paused',
]);

/** Same limits as campaign creation (validateAdPayload + the create form). */
export const AD_FIELD_LIMITS = {
  title: { min: 2, max: 50 },
  description: { min: 5, max: 140 },
  ctaText: { min: 1, max: 25 },
} as const;

/** Validates a full proposed creative. Returns an error message, or null when valid. */
export function validateAdEdit(fields: EditableAdFields): string | null {
  for (const key of ['title', 'description', 'ctaText'] as const) {
    const { min, max } = AD_FIELD_LIMITS[key];
    const length = fields[key].trim().length;
    if (length < min || length > max) {
      const label =
        key === 'ctaText' ? 'Button text' : key[0].toUpperCase() + key.slice(1);
      return `${label} must be between ${min} and ${max} characters.`;
    }
  }
  if (!isSafeSubmissionUrl(fields.targetUrl.trim())) {
    return 'Destination URL must be a public http(s) address.';
  }
  return null;
}

/** Only the fields that changed vs. the live ad (trimmed). Empty when nothing changed. */
export function diffAdFields(
  current: EditableAdFields,
  submitted: EditableAdFields,
): Partial<EditableAdFields> {
  const diff: Partial<EditableAdFields> = {};
  for (const key of AD_EDITABLE_KEYS) {
    const next = submitted[key].trim();
    if (next !== current[key].trim()) diff[key] = next;
  }
  return diff;
}

export function serializeAdRevision(
  proposed: Partial<EditableAdFields>,
): string {
  const revision: AdRevision = {
    proposed,
    submittedAt: new Date().toISOString(),
  };
  return JSON.stringify(revision);
}

export function parseAdRevision(
  raw: string | null | undefined,
): AdRevision | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.proposed &&
      typeof parsed.proposed === 'object'
    ) {
      return parsed as AdRevision;
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * The DB update for an approved revision: whitelisted, non-empty string fields
 * only, so a tampered blob can never touch placement, bid or impression counts.
 */
export function adRevisionToDbPatch(
  proposed: Partial<EditableAdFields>,
): Partial<EditableAdFields> {
  const patch: Partial<EditableAdFields> = {};
  for (const key of AD_EDITABLE_KEYS) {
    const value = proposed[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) patch[key] = trimmed;
  }
  return patch;
}
