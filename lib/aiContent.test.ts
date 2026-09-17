import {
  clampDoc,
  clampFaq,
  parseFaqArray,
  stripBannedOpener,
} from './aiContent';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Testing parseFaqArray...');

// 1. Valid JSON string array of {q,a} parses correctly.
const valid = parseFaqArray(
  JSON.stringify([{ q: 'What does it do?', a: 'It does things.' }]),
);
assert(valid.length === 1, 'Should parse one item');
assert(valid[0].q === 'What does it do?', 'Should keep the question text');
assert(valid[0].a === 'It does things.', 'Should keep the answer text');

// 2. Already-an-array input (e.g. from the static snapshot) passes through.
const fromArray = parseFaqArray([{ q: 'Q', a: 'A' }]);
assert(fromArray.length === 1, 'Should accept an already-parsed array');

// 3. Malformed JSON never throws — returns [].
assert(
  parseFaqArray('{not json').length === 0,
  'Should tolerate malformed JSON',
);

// 4. Non-array JSON (e.g. a stray object) returns [].
assert(
  parseFaqArray(JSON.stringify({ q: 'a', a: 'b' })).length === 0,
  'Should reject a non-array payload',
);

// 5. Items missing q or a are dropped, not crashed on.
const partial = parseFaqArray(
  JSON.stringify([{ q: 'Only a question' }, { q: 'Full', a: 'Pair' }]),
);
assert(partial.length === 1, 'Should drop items missing an answer');
assert(partial[0].q === 'Full', 'Should keep the well-formed item');

// 6. null/undefined/empty-string input all return [].
assert(parseFaqArray(null).length === 0, 'null should return []');
assert(parseFaqArray(undefined).length === 0, 'undefined should return []');
assert(parseFaqArray('').length === 0, 'empty string should return []');

console.log('Testing clampFaq...');

// 7. Caps item count.
const many = Array.from({ length: 10 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }));
assert(clampFaq(many, 5, 200, 400).length === 5, 'Should cap at maxItems');

// 8. Caps question/answer length with an ellipsis.
const long = clampFaq([{ q: 'x'.repeat(300), a: 'y'.repeat(300) }], 5, 50, 100);
assert(long[0].q.length <= 50, 'Question should be clamped to maxQLen');
assert(long[0].a.length <= 100, 'Answer should be clamped to maxALen');

// 9. Drops items with an empty question or answer after trimming.
const emptyish = clampFaq(
  [
    { q: '   ', a: 'Real answer' },
    { q: 'Real question', a: 'Real answer' },
  ],
  5,
  200,
  400,
);
assert(emptyish.length === 1, 'Should drop items with a blank question');

// 10. Non-array input returns [].
assert(
  clampFaq('not an array', 5, 200, 400).length === 0,
  'Should return [] for non-array input',
);

// 11. Non-string q/a values (null, number, object, boolean) are dropped, not coerced into garbage strings.
const nonString = parseFaqArray(
  JSON.stringify([
    { q: null, a: 'Real answer' },
    { q: 42, a: 'Real answer' },
    { q: 'Real question', a: 'Real answer' },
  ]),
);
assert(
  nonString.length === 1,
  'Should drop items with non-string q/a instead of coercing them',
);
assert(
  nonString[0].q === 'Real question',
  'Should keep only the well-formed item',
);

console.log('Testing stripBannedOpener...');

// 12. Strips a generic "This MCP server ... that" subject phrase.
assert(
  stripBannedOpener(
    'This MCP server that syncs Notion pages into a local cache.',
  ).startsWith('Syncs Notion pages'),
  'Should re-point past "This MCP server ... that"',
);

// 13. Leaves a substantive opener untouched.
const good = 'Queries and mutates a Postgres database over MCP.';
assert(
  stripBannedOpener(good) === good,
  'Should not touch a sentence that already leads with the capability',
);

// 14. Handles a banned opener with no relative clause without crashing.
assert(
  typeof stripBannedOpener('This server. Extra.') === 'string',
  'Should return a string even with no "that"/"which" clause',
);

console.log('Testing clampDoc...');

const KP = 'Acme MCP server';

const goodDoc = `## What the Acme MCP server does

The Acme MCP server exposes an internal ticketing API to agents as MCP tools so they can file, update, and close tickets without a browser.

## How it works

The Acme MCP server authenticates with a scoped API token and proxies each tool call to the REST endpoint, mapping responses into structured tool results.

## Setup and configuration

Set ACME_TOKEN and run the published Acme MCP server package with npx. Optional flags select the workspace and default queue.`;

// 15. A well-formed multi-heading writeup passes through.
assert(
  clampDoc(goodDoc, 'some unrelated readme text here that is long enough', KP)
    .length > 0,
  'Should accept a grounded, multi-heading doc',
);

// 16. Too few of our headings → rejected.
assert(
  clampDoc(`## Random heading\n\n${'word '.repeat(120)}`, null, KP) === '',
  'Should reject a doc without at least two recognised headings',
);

// 17. Too short → rejected.
assert(
  clampDoc('## What Acme does\n\nShort.', null, KP) === '',
  'Should reject a tiny doc',
);

// 18. Near-verbatim README copy → rejected.
const readmeBody = Array.from(
  { length: 8 },
  (_, i) =>
    `This is line number ${i} of the upstream readme and it is definitely long enough to count.`,
).join('\n');
const copiedDoc = `## What Acme does\n\n## How it works\n\n${readmeBody}`;
assert(
  clampDoc(copiedDoc, readmeBody, KP) === '',
  'Should reject a doc that is mostly the README pasted back',
);

// 19. Missing focus keyphrase → appended as a safe fallback rather than discarded.
const noKeyphrase = clampDoc(
  goodDoc.replace(/Acme MCP server/g, 'Acme'),
  null,
  KP,
);
assert(
  noKeyphrase.includes(KP),
  'Should append the focus keyphrase when the model omitted it',
);

// 20. Non-string input → ''.
assert(
  clampDoc(null, null, KP) === '',
  'null input should return empty string',
);
assert(
  clampDoc(42, null, KP) === '',
  'number input should return empty string',
);

console.log('ALL TESTS PASSED SUCCESSFULLY!');
