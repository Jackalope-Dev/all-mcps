import { describe, expect, it } from 'vitest';
import {
  categoryIntroCopy,
  categorySlug,
  DEFAULT_SUBMIT_CATEGORY,
  DIRECTORY_CATEGORIES,
  normalizeCategory,
  parseCategoryLabel,
  resolveCategoryParam,
} from './categories';

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

describe('resolveCategoryParam', () => {
  it('accepts the full stored name, its label, and its slug alike', () => {
    for (const input of [
      '🗄️ Databases',
      '🗄️ databases',
      'Databases',
      'databases',
      'DATABASES',
      '  databases  ',
    ]) {
      expect(resolveCategoryParam(input)).toBe('🗄️ Databases');
    }
  });

  it('resolves every catalog category from all three formats', () => {
    for (const canonical of DIRECTORY_CATEGORIES) {
      const { label } = parseCategoryLabel(canonical);
      expect(resolveCategoryParam(canonical)).toBe(canonical);
      expect(resolveCategoryParam(canonical.toLowerCase())).toBe(canonical);
      expect(resolveCategoryParam(label)).toBe(canonical);
      expect(resolveCategoryParam(categorySlug(canonical))).toBe(canonical);
    }
  });

  it('handles "&" spelled out and collapsed whitespace', () => {
    expect(resolveCategoryParam('Search and Data Extraction')).toBe(
      '🔎 Search & Data Extraction',
    );
    expect(resolveCategoryParam('Search & Data Extraction')).toBe(
      '🔎 Search & Data Extraction',
    );
    expect(resolveCategoryParam('☁️  Cloud   Platforms')).toBe(
      '☁️ Cloud Platforms',
    );
  });

  it('resolves legacy slugs and known aliases', () => {
    expect(resolveCategoryParam('dev-tools')).toBe('💻 Developer Tools');
    expect(resolveCategoryParam('sql')).toBe('🗄️ Databases');
  });

  it('returns undefined for empty and unknown input instead of guessing', () => {
    // normalizeCategory() coerces these to a default because a *write* must land
    // on a valid category; a read filter must not silently answer a different
    // question, so the resolver reports "unknown" and the caller 400s.
    expect(resolveCategoryParam('')).toBeUndefined();
    expect(resolveCategoryParam('   ')).toBeUndefined();
    expect(resolveCategoryParam(null)).toBeUndefined();
    expect(resolveCategoryParam(undefined)).toBeUndefined();
    expect(resolveCategoryParam('not-a-real-category')).toBeUndefined();
    expect(resolveCategoryParam('🗄️')).toBeUndefined();
    expect(normalizeCategory('not-a-real-category')).toBe(
      DEFAULT_SUBMIT_CATEGORY,
    );
  });
});
