/**
 * Why an admin rejected a submission or unpublished a listing.
 *
 * Rejections used to delete the row and send the free-text reason only in the
 * submitter's email, so the automation gates (lib/autoDecision.ts) had no
 * labels to learn from: we could see the admin overturned a gate's approve
 * but not why. Every reject and unpublish now records one or more of these
 * codes in moderation_decisions, with a snapshot of the listing.
 *
 * Codes are stored, so never rename one; add a new code instead. Pure and
 * dependency-free, so the admin client imports it too.
 */

export const MODERATION_REASONS = [
  'not_mcp',
  'directory_or_list',
  'brochure',
  'low_value',
  'duplicate',
  'broken',
  'incomplete',
  'spam',
  'malicious',
  'adult',
  'prohibited',
  'other',
] as const;
export type ModerationReason = (typeof MODERATION_REASONS)[number];

export const MODERATION_REASON_LABEL: Record<ModerationReason, string> = {
  not_mcp: 'Not an MCP server',
  directory_or_list: 'Directory, list or registry entry',
  brochure: 'Brochure / company info only',
  low_value: 'Low value or not useful',
  duplicate: 'Duplicate listing',
  broken: 'Broken or unreachable',
  incomplete: 'Missing or misleading details',
  spam: 'Spam, SEO or lead-gen',
  malicious: 'Malicious, suspicious or impersonation',
  adult: 'Adult content',
  prohibited: 'Other prohibited category',
  other: 'Other',
};

/**
 * Feedback the submitter email starts with when this is the first reason
 * picked. The admin can still edit it before sending.
 */
export const MODERATION_REASON_FEEDBACK: Record<ModerationReason, string> = {
  not_mcp:
    "We couldn't find an MCP server in this submission. AllMCPs lists projects that ship an MCP server or a hosted MCP endpoint. If yours does, resubmit with the repository or endpoint URL that shows it.",
  directory_or_list:
    "This looks like a directory, list or registry entry rather than an MCP server itself, so we don't list it. Submit the server's own repository or endpoint instead.",
  brochure:
    "The server's tools only describe your own company (profile, services, contact, FAQ), so it isn't useful to developers on its own. We'd be glad to list a server that does real work for its users.",
  low_value:
    "We decided not to list this one. It doesn't yet do enough for developers to find it useful in the directory. You're welcome to resubmit once it does more.",
  duplicate:
    'This server is already listed on AllMCPs. If it is yours, you can claim the existing listing to edit it instead.',
  broken:
    "We couldn't reach the repository, package or endpoint for this submission. Please check it is public and working, then submit again.",
  incomplete:
    'Your submission was not approved because the details or repository information were incomplete. You are welcome to update your information and submit again.',
  spam: "This submission reads as promotion for a business rather than an MCP server, so we don't list it.",
  malicious:
    "We don't list this submission because it raised security concerns during review.",
  adult:
    "AllMCPs doesn't list adult content (see our terms), so we can't approve this submission.",
  prohibited:
    "This submission falls in a category AllMCPs doesn't list (see our terms), so we can't approve it.",
  other:
    'Your submission was not approved. You are welcome to update your information and submit again.',
};

export function isModerationReason(v: unknown): v is ModerationReason {
  return (
    typeof v === 'string' &&
    (MODERATION_REASONS as readonly string[]).includes(v)
  );
}
