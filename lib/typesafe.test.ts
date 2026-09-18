import { vi } from 'vitest';

// getEnv reaches for a Cloudflare context first; stub it so these run in plain Node
// and so we control whether a key is configured.
vi.mock('./env', () => ({
  getEnv: async (name: string) => process.env[name] || undefined,
}));

const {
  askJev,
  confidentChoice,
  noulVerdict,
  nearestScoreLevel,
  isJevConfigured,
} = await import('./typesafe');
const { classifyCategory } = await import('./categoryClassifier');
const {
  reviewListing,
  shouldHoldFromAutoPromotion,
  shouldSkipAiWriteup,
  alignListings,
} = await import('./listingReview');
const { classifyListingFields, pickInstallCommand, pickBestWebsiteAndLogo } =
  await import('./listingSignals');

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const realFetch = globalThis.fetch;
const KEY = 'test-typesafe-key';
const LISTING = {
  name: 'pg-mcp',
  description: 'An MCP server exposing Postgres queries as tools.',
  url: 'https://github.com/example/pg-mcp',
};

console.log('Testing TypeSafe (Jev) client and its fallbacks...');

// ── 1. No key configured: everything degrades, nothing throws ──
process.env.TYPESAFE_API_KEY = '';
assert(!(await isJevConfigured()), 'An empty key must read as unconfigured');
assert(
  (await askJev({ a: 1 }, { q: { type: 'noul', instructions: 'x' } })) === null,
  'askJev must return null with no key',
);

let called = false;
globalThis.fetch = (async () => {
  called = true;
  return new Response('{}', { status: 200 });
}) as typeof fetch;
await askJev({ a: 1 }, { q: { type: 'noul', instructions: 'x' } });
assert(!called, 'askJev must not issue a request when no key is configured');

// The two callers must hand back the caller's existing behaviour, unchanged.
const keptCategory = await classifyCategory(LISTING, '💻 Developer Tools');
assert(
  keptCategory.category === '💻 Developer Tools' && !keptCategory.fromJev,
  'classifyCategory must keep the current category when unconfigured',
);

const unreviewed = await reviewListing(LISTING);
assert(
  unreviewed.reviewed === false && unreviewed.isMcpServer === null,
  'reviewListing must report no opinion when unconfigured',
);
assert(
  !shouldHoldFromAutoPromotion(unreviewed),
  'An unreviewed listing must never be held back — the gate fails open',
);

// ── 2. Key configured, but the API fails ──
process.env.TYPESAFE_API_KEY = KEY;
assert(await isJevConfigured(), 'A non-empty key must read as configured');

// 401/422 are ours to fix, not retry: one attempt, then fall back.
let attempts = 0;
globalThis.fetch = (async () => {
  attempts++;
  return new Response('nope', { status: 401 });
}) as typeof fetch;
assert(
  (await askJev({ a: 1 }, { q: { type: 'noul', instructions: 'x' } })) === null,
  'A 401 must resolve to null',
);
assert(attempts === 1, `A 401 must not be retried (got ${attempts} attempts)`);

// 429 is retryable, but must still give up and fall back rather than hang.
attempts = 0;
globalThis.fetch = (async () => {
  attempts++;
  return new Response('slow down', { status: 429 });
}) as typeof fetch;
assert(
  (await askJev({ a: 1 }, { q: { type: 'noul', instructions: 'x' } })) === null,
  'A sustained 429 must resolve to null',
);
assert(attempts > 1, 'A 429 must be retried at least once');

// A thrown transport error must not escape.
globalThis.fetch = (async () => {
  throw new Error('ECONNRESET');
}) as typeof fetch;
assert(
  (await askJev({ a: 1 }, { q: { type: 'noul', instructions: 'x' } })) === null,
  'A network error must resolve to null, not throw',
);

// A 200 with a body that is not the documented shape must not be trusted.
globalThis.fetch = (async () =>
  new Response(JSON.stringify({ nope: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;
assert(
  (await askJev({ a: 1 }, { q: { type: 'noul', instructions: 'x' } })) === null,
  'A response with no answers object must resolve to null',
);

// Every failure above must leave the callers on their existing behaviour.
globalThis.fetch = (async () => {
  throw new Error('down');
}) as typeof fetch;
const stillKept = await classifyCategory(LISTING, '🗄️ Databases');
assert(
  stillKept.category === '🗄️ Databases' && !stillKept.fromJev,
  'classifyCategory must keep the current category when the API errors',
);
const stillUnreviewed = await reviewListing(LISTING);
assert(
  !shouldHoldFromAutoPromotion(stillUnreviewed),
  'A failed review must never hold a listing back',
);

// ── 3. Confidence gating ──
globalThis.fetch = (async () =>
  new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        category: {
          type: 'choice',
          choice: 'Databases',
          confidence: 0.42,
          probabilities: { Databases: 0.42 },
        },
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;
const lowConfidence = await classifyCategory(LISTING, '💻 Developer Tools');
assert(
  lowConfidence.category === '💻 Developer Tools' && !lowConfidence.fromJev,
  'A low-confidence answer must not overwrite the existing category',
);

globalThis.fetch = (async () =>
  new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        category: {
          type: 'choice',
          choice: 'Databases',
          confidence: 0.97,
          probabilities: { Databases: 0.97 },
        },
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;
const highConfidence = await classifyCategory(LISTING, '💻 Developer Tools');
assert(
  highConfidence.fromJev && highConfidence.category.includes('Databases'),
  `A confident answer must be applied and mapped back to its stored label (got "${highConfidence.category}")`,
);

// An option key we never sent must never be written to the category column.
globalThis.fetch = (async () =>
  new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        category: {
          type: 'choice',
          choice: 'Underwater Basket Weaving',
          confidence: 1,
        },
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;
const unknownOption = await classifyCategory(LISTING, '💻 Developer Tools');
assert(
  unknownOption.category === '💻 Developer Tools' && !unknownOption.fromJev,
  'An unrecognised option must fall back rather than be stored',
);

// ── 4. The promotion gate only closes on a real negative verdict ──
const reviewResponse = (noul: number) =>
  new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        is_mcp_server: { type: 'noul', noul },
        listing_quality: { type: 'score', score: 3.1, confidence: 0.8 },
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

globalThis.fetch = (async () => reviewResponse(0.05)) as typeof fetch;
const rejected = await reviewListing(LISTING);
assert(
  rejected.reviewed && rejected.isMcpServer === false,
  'A low noul value must read as "not an MCP server"',
);
assert(
  shouldHoldFromAutoPromotion(rejected),
  'A reviewed negative verdict must hold the listing back',
);

globalThis.fetch = (async () => reviewResponse(0.9)) as typeof fetch;
const accepted = await reviewListing(LISTING);
assert(
  accepted.isMcpServer === true && !shouldHoldFromAutoPromotion(accepted),
  'A high noul value must promote normally',
);
assert(accepted.qualityScore === 3.1, 'The quality score must be surfaced');
assert(
  shouldSkipAiWriteup(rejected),
  'A non-MCP listing must skip the GPT writeup',
);
assert(
  !shouldSkipAiWriteup(accepted),
  'A genuine MCP server must still get a writeup',
);

globalThis.fetch = (async () =>
  new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        link_state: { type: 'score', score: 2.1, confidence: 0.9 },
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;
assert(
  (await alignListings(LISTING, {
    ...LISTING,
    url: 'https://example.com/fork',
  })) === 'same',
  'A score near the top level must read as same project',
);

globalThis.fetch = (async () =>
  new Response(
    JSON.stringify({
      model: 'jev-latest',
      answers: {
        link_state: { type: 'score', score: 0.1, confidence: 0.9 },
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;
assert(
  (await alignListings(LISTING, LISTING)) === 'different',
  'A score near 0 must read as different projects',
);

// ── 5. Helper edge cases ──
assert(
  confidentChoice(undefined, 0.5) === null,
  'confidentChoice must tolerate a missing answer',
);
assert(
  confidentChoice({ type: 'choice', choice: 'a' }, 0.5) === null,
  'confidentChoice must reject an answer with no confidence value',
);
assert(
  noulVerdict({ type: 'noul' }, 0.5) === null,
  'noulVerdict must tolerate a missing noul value',
);
assert(
  nearestScoreLevel({ type: 'score', score: 1.4 }, ['a', 'b', 'c']) === 'b',
  'nearestScoreLevel must round to the closest named level',
);
assert(
  nearestScoreLevel({ type: 'noul', noul: 0.9 }, ['a', 'b']) === null,
  'nearestScoreLevel must reject a noul answer',
);

process.env.TYPESAFE_API_KEY = '';
assert(
  (await classifyListingFields(LISTING)).authType === null,
  'classifyListingFields must no-op without a key',
);
assert(
  (await pickInstallCommand({
    ...LISTING,
    readme: 'npx -y pg-mcp',
  })) !== null,
  'pickInstallCommand must still return the regex candidate when Jev is unset',
);
assert(
  (await pickBestWebsiteAndLogo({
    readmeSnippet: '',
    ghOwner: 'a',
    ghRepo: 'b',
    candidateUrls: ['https://example.com'],
    candidateImages: [],
  })) === null,
  'pickBestWebsiteAndLogo must return null when Jev is unset',
);

globalThis.fetch = realFetch;
process.env.TYPESAFE_API_KEY = '';

console.log('All TypeSafe client and fallback tests passed.');
