import { resolveServerId, toVectorId } from './vectorSearch';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Testing vectorSearch id surrogates...');

// 1. Short ids (<= 64 bytes) pass through unchanged so existing vectors keep matching.
const shortId = 'reapx-influencer-checks';
assert(
  (await toVectorId(shortId)) === shortId,
  'Ids within the 64-byte limit are returned verbatim',
);

const exactly64 = 'a'.repeat(64);
assert(
  (await toVectorId(exactly64)) === exactly64,
  'A 64-byte id is still within the limit',
);

// 2. Over-limit ids get a deterministic surrogate that fits Vectorize's 64-byte cap.
const longId =
  'reapx-influencer-checks-bought-followers-real-engagement-paid-partnerships';
assert(longId.length === 74, 'Fixture id is the real 74-byte offender');
const surrogate = await toVectorId(longId);
assert(
  new TextEncoder().encode(surrogate).length <= 64,
  'Surrogate id fits the 64-byte limit',
);
assert(surrogate !== longId, 'Over-limit id is replaced');
assert(
  surrogate === (await toVectorId(longId)),
  'Surrogate is deterministic across calls',
);
assert(
  surrogate !==
    (await toVectorId(`${longId}-manychdisplay-collaboration-workspace`)),
  'Different long ids get different surrogates',
);

// 3. Query results map back to the listing id via metadata.serverId, else fall back to match.id.
assert(
  resolveServerId({ id: surrogate, metadata: { serverId: longId } }) === longId,
  'metadata.serverId restores the real listing id',
);
assert(
  resolveServerId({ id: shortId, metadata: null }) === shortId,
  'Legacy vectors with no serverId fall back to match.id',
);
assert(
  resolveServerId({ id: shortId, metadata: { name: 'x' } }) === shortId,
  'Vectors with metadata but no serverId fall back to match.id',
);

console.log('ALL TESTS PASSED SUCCESSFULLY!');
