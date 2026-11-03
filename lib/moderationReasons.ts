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
 * What the submitter email says for each reason: what we found and, when it
 * can be fixed, what to change. Several picked reasons are combined in
 * rejectionEmail(). The admin can still edit the text before sending.
 */
export const MODERATION_REASON_FEEDBACK: Record<ModerationReason, string> = {
  not_mcp:
    "We couldn't find an MCP server in this submission. AllMCPs lists projects that ship an MCP server or a hosted MCP endpoint. If yours does, submit again with the repository or endpoint URL that shows it, and mention the MCP tools in the description.",
  directory_or_list:
    "The link points at a directory, list or registry page rather than an MCP server itself. Submit the server's own repository or hosted endpoint instead and we'll take another look.",
  brochure:
    "The server's tools only describe your own company (profile, services, contact, FAQ), so it isn't useful to developers on its own. If you add tools that do real work for users, you're welcome to submit it again.",
  low_value:
    "It doesn't yet do enough for developers to find it useful in the directory. Once it does more, you're welcome to submit it again with a description of what it can do.",
  duplicate:
    "This server is already listed on AllMCPs, so we didn't add a second copy. If it's yours, you can claim the existing listing to edit it, add a logo and manage it.",
  broken:
    "We couldn't reach the repository, package or endpoint for this submission. Please check it is public and working, then submit it again.",
  incomplete:
    "Some of the details were missing or didn't match what we found (name, description, links or install steps). Please update them and submit again. A clear description of what the server does and how to connect to it is the main thing we look for.",
  spam: "This submission reads as promotion for a business rather than an MCP server for developers, so we don't list it.",
  malicious:
    "We don't list this submission because it raised security concerns during review.",
  adult:
    "AllMCPs doesn't list adult content (see our terms at https://allmcps.com/terms), so we can't approve this submission.",
  prohibited:
    "This submission falls in a category AllMCPs doesn't list (see our terms at https://allmcps.com/terms), so we can't approve it.",
  other:
    'Your submission was not approved this time. You are welcome to update it and submit again.',
};

/**
 * Whether the submitter can fix this and submit again. A rejection is only
 * shown a "Submit again" button when every picked reason is fixable.
 */
const MODERATION_REASON_FIXABLE: Record<ModerationReason, boolean> = {
  not_mcp: true,
  directory_or_list: true,
  brochure: true,
  low_value: true,
  duplicate: false,
  broken: true,
  incomplete: true,
  spam: false,
  malicious: false,
  adult: false,
  prohibited: false,
  other: true,
};

/**
 * Submitter-facing text and whether to invite a resubmission, from the
 * picked reasons. No reasons (a triage-queue reject) keeps the generic copy
 * and the resubmit invite.
 */
export function rejectionEmail(reasons: readonly ModerationReason[]): {
  feedback: string | null;
  canResubmit: boolean;
} {
  const unique = [...new Set(reasons)];
  // "Other" adds nothing when a specific reason is picked alongside it.
  const shown =
    unique.length > 1 ? unique.filter((r) => r !== 'other') : unique;
  return {
    feedback:
      shown.length > 0
        ? shown.map((r) => MODERATION_REASON_FEEDBACK[r]).join('\n\n')
        : null,
    canResubmit: unique.every((r) => MODERATION_REASON_FIXABLE[r]),
  };
}

export function isModerationReason(v: unknown): v is ModerationReason {
  return (
    typeof v === 'string' &&
    (MODERATION_REASONS as readonly string[]).includes(v)
  );
}
