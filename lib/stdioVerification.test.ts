import {
  decideGuessRetirement,
  type GuessRetirementInput,
  MIN_FAILURES_TO_RETIRE,
  nextFailureCount,
} from './stdioVerification';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Testing stdio verification guess-retirement rules...');

/** A heuristic guess that just failed to install for the second time. */
const retirable: GuessRetirementInput = {
  status: 'install_failed',
  installExtractedAt: null,
  testedPackage: 'not-a-real-package',
  currentPackage: 'not-a-real-package',
  failures: MIN_FAILURES_TO_RETIRE,
  packageMissing: false,
};

// 1. The one case that retires a guess: repeated install failures.
assert(
  decideGuessRetirement(retirable).retire,
  'Two install failures on an unconfirmed guess should retire it',
);
assert(
  decideGuessRetirement(retirable).reason === 'repeated-failure',
  'The reason should name repeated failure',
);

// 2. A single failure is never enough — that is a registry outage as often as
//    a bad guess.
const once = { ...retirable, failures: 1 };
assert(
  !decideGuessRetirement(once).retire &&
    decideGuessRetirement(once).reason === 'insufficient-evidence',
  'One install failure must not retire a guess',
);

// 3. ...unless the registry independently says the package does not exist.
assert(
  decideGuessRetirement({ ...once, packageMissing: true }).retire,
  'A missing package is conclusive on a single failure',
);
assert(
  decideGuessRetirement({ ...once, packageMissing: true }).reason ===
    'package-missing',
  'The reason should name the missing package',
);

// 4. Every other status leaves the listing alone. handshake_failed is the one
//    that matters most: it means the install WORKED and the server wanted
//    configuration, so treating it as a bad install would delete good data.
for (const status of ['ok', 'handshake_failed', 'timeout', 'error'] as const) {
  const d = decideGuessRetirement({
    ...retirable,
    status,
    packageMissing: true,
  });
  assert(
    !d.retire && d.reason === 'not-a-failure',
    `${status} must never retire an install guess, even with a missing package`,
  );
}

// 5. An LLM-confirmed install is never touched, however badly it fails.
assert(
  !decideGuessRetirement({
    ...retirable,
    installExtractedAt: new Date(),
    failures: 99,
    packageMissing: true,
  }).retire,
  'An LLM-confirmed install must survive any number of sandbox failures',
);
assert(
  decideGuessRetirement({ ...retirable, installExtractedAt: 1758000000000 })
    .reason === 'llm-confirmed',
  'A numeric timestamp must also count as confirmed',
);

// 6. A result about a package the listing no longer claims is discarded — the
//    validator moved it while the sandbox was running.
const stale = { ...retirable, currentPackage: '@scope/renamed-package' };
assert(
  !decideGuessRetirement(stale).retire &&
    decideGuessRetirement(stale).reason === 'stale-result',
  'A result for a superseded package must not clear the new value',
);

// A row claimed before tested_package existed has nothing to compare, so it
// falls through to the normal evidence rules rather than being discarded.
assert(
  decideGuessRetirement({ ...retirable, testedPackage: null }).retire,
  'A null testedPackage should not block retirement on its own',
);

// 7. Nothing to delete.
assert(
  decideGuessRetirement({ ...retirable, currentPackage: null }).reason ===
    'no-package',
  'A listing with no package should report nothing to retire',
);

// 8. Failure streaks reset on any non-failure outcome — a package that
//    installs today is not one bad night away from deletion.
assert(nextFailureCount('install_failed', 1) === 2, 'Failures accumulate');
assert(
  nextFailureCount('install_failed', null) === 1,
  'Null previous counts as 0',
);
assert(nextFailureCount('ok', 5) === 0, 'A success resets the streak');
assert(
  nextFailureCount('handshake_failed', 5) === 0,
  'A handshake failure resets the streak — it proved the install works',
);
assert(nextFailureCount('timeout', 5) === 0, 'A timeout resets the streak');

console.log('All stdio verification guess-retirement tests passed.');
