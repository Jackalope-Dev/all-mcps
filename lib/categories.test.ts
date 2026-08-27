import { categoryIntroCopy } from './categories';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Testing categoryIntroCopy...');

// 1. Curated categories return their hand-written intro verbatim.
const curated = categoryIntroCopy('💻 Developer Tools', 42, [
  'Foo',
  'Bar',
  'Baz',
]);
assert(
  curated.startsWith('MCP servers that plug AI agents'),
  'Curated intro should be used for Developer Tools',
);

// 2. Uncurated categories fall back to the templated paragraph.
const templated = categoryIntroCopy('🧬 Biology & Bioinformatics', 3, [
  'Foo',
  'Bar',
]);
assert(
  templated.includes('3 Biology & Bioinformatics MCP servers'),
  'Templated intro should include count + label',
);
assert(
  templated.includes('Popular picks include Foo, Bar'),
  'Templated intro should list top examples when >= 2 given',
);

// 3. Singular count doesn't pluralize "server".
const singular = categoryIntroCopy('🧬 Biology & Bioinformatics', 1, []);
assert(
  singular.includes('1 Biology & Bioinformatics MCP server.') ||
    singular.includes('1 Biology & Bioinformatics MCP server '),
  'Count of 1 should not pluralize "server"',
);
assert(
  !singular.includes('Popular picks'),
  'No examples should be listed when fewer than 2 names given',
);

console.log('ALL TESTS PASSED SUCCESSFULLY!');
