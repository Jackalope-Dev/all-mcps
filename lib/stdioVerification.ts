/**
 * What an E2B stdio verification result is allowed to change about a listing.
 *
 * Kept as pure functions, separate from the route that applies them, because
 * this is the logic that can *delete* data: a wrong answer here silently strips
 * install instructions from listings that were fine. The route does the I/O;
 * these decide.
 *
 * The governing idea is that the four failure statuses carry very different
 * amounts of evidence:
 *
 *   install_failed    the package would not install. Evidence the command may
 *                     be wrong — but also what a registry outage, a rate limit,
 *                     or a private package produces.
 *   handshake_failed  it installed, then never completed the MCP handshake.
 *                     Almost always a server wanting configuration (API key,
 *                     path argument) a bare sandbox cannot give it. This is a
 *                     *positive* signal about the install command.
 *   timeout / error   the check itself fell over. No signal about the listing.
 *
 * Only the first can retire an install guess, and only with corroboration. This
 * mirrors the rule the auto-promote cron already follows for liveness, where
 * only 404/410/451 mean "gone" and a timeout or 5xx means the check failed.
 */

export type VerificationStatus =
  | 'ok'
  | 'install_failed'
  | 'handshake_failed'
  | 'timeout'
  | 'error';

export type GuessRetirementInput = {
  status: VerificationStatus;
  /** Null when the install config is a heuristic guess; set once the LLM validator confirmed it. */
  installExtractedAt: Date | number | null;
  /** The package this attempt was handed by /batch. Null for rows claimed before this was recorded. */
  testedPackage: string | null;
  /** The package the listing claims right now. */
  currentPackage: string | null;
  /** Consecutive install_failed count *including* this result. */
  failures: number;
  /** The registry says this package does not exist (an independent signal). */
  packageMissing: boolean;
};

export type GuessRetirementDecision = {
  retire: boolean;
  /** Why, for logging and for the endpoint's response counters. */
  reason:
    | 'not-a-failure'
    | 'llm-confirmed'
    | 'stale-result'
    | 'no-package'
    | 'insufficient-evidence'
    | 'repeated-failure'
    | 'package-missing';
};

/** Two separate failing runs, which the week-long guess retest window keeps days apart. */
export const MIN_FAILURES_TO_RETIRE = 2;

/**
 * Whether an install guess has been disproven firmly enough to remove it.
 *
 * Returns false for every ambiguous case on purpose: leaving a wrong install
 * command in place is a visible, fixable annoyance, while deleting a correct
 * one is silent data loss the owner has no way to notice.
 */
export function decideGuessRetirement(
  input: GuessRetirementInput,
): GuessRetirementDecision {
  if (input.status !== 'install_failed') {
    return { retire: false, reason: 'not-a-failure' };
  }

  // The LLM validator reads the whole README with context and is the authority.
  // A sandbox failure never overrides it — those listings usually just need
  // configuration the sandbox can't supply.
  if (input.installExtractedAt != null) {
    return { retire: false, reason: 'llm-confirmed' };
  }

  if (!input.currentPackage) {
    return { retire: false, reason: 'no-package' };
  }

  // The validator rewrites guesses on its own schedule, so a slow sandbox run
  // can report on a package the listing no longer claims. Previously measured
  // at 80% of one batch — acting on those would clear untested values.
  if (
    input.testedPackage != null &&
    input.testedPackage !== input.currentPackage
  ) {
    return { retire: false, reason: 'stale-result' };
  }

  // A registry that has never heard of the package is a second, independent
  // signal rather than a repeat of the same one, so it stands on its own.
  if (input.packageMissing) {
    return { retire: true, reason: 'package-missing' };
  }

  if (input.failures >= MIN_FAILURES_TO_RETIRE) {
    return { retire: true, reason: 'repeated-failure' };
  }

  return { retire: false, reason: 'insufficient-evidence' };
}

/**
 * Consecutive install failures after applying this result.
 *
 * Any non-failure outcome resets the streak: a package that installs today is
 * not "one failure away" from being retired because of a bad night last week.
 */
export function nextFailureCount(
  status: VerificationStatus,
  previous: number | null | undefined,
): number {
  return status === 'install_failed' ? (previous ?? 0) + 1 : 0;
}
