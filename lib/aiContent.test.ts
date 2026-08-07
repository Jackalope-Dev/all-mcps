import { parseFaqArray, clampFaq } from './aiContent';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Testing parseFaqArray...');

// 1. Valid JSON string array of {q,a} parses correctly.
const valid = parseFaqArray(JSON.stringify([{ q: 'What does it do?', a: 'It does things.' }]));
assert(valid.length === 1, 'Should parse one item');
assert(valid[0].q === 'What does it do?', 'Should keep the question text');
assert(valid[0].a === 'It does things.', 'Should keep the answer text');

// 2. Already-an-array input (e.g. from the static snapshot) passes through.
const fromArray = parseFaqArray([{ q: 'Q', a: 'A' }]);
assert(fromArray.length === 1, 'Should accept an already-parsed array');

// 3. Malformed JSON never throws — returns [].
assert(parseFaqArray('{not json').length === 0, 'Should tolerate malformed JSON');

// 4. Non-array JSON (e.g. a stray object) returns [].
assert(parseFaqArray(JSON.stringify({ q: 'a', a: 'b' })).length === 0, 'Should reject a non-array payload');

// 5. Items missing q or a are dropped, not crashed on.
const partial = parseFaqArray(JSON.stringify([{ q: 'Only a question' }, { q: 'Full', a: 'Pair' }]));
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
const emptyish = clampFaq([{ q: '   ', a: 'Real answer' }, { q: 'Real question', a: 'Real answer' }], 5, 200, 400);
assert(emptyish.length === 1, 'Should drop items with a blank question');

// 10. Non-array input returns [].
assert(clampFaq('not an array', 5, 200, 400).length === 0, 'Should return [] for non-array input');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
