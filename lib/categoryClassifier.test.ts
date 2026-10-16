import { describe, expect, it } from 'vitest';
import { DIRECTORY_CATEGORIES } from './categories';
import { CATEGORY_DEFINITIONS, categoryOptionKey } from './categoryClassifier';

describe('CATEGORY_DEFINITIONS', () => {
  const keys = DIRECTORY_CATEGORIES.map(categoryOptionKey);

  it('defines every directory category, so Jev never sees a bare name', () => {
    expect(keys.filter((k) => !CATEGORY_DEFINITIONS[k])).toEqual([]);
  });

  it('defines nothing that is not a directory category', () => {
    expect(
      Object.keys(CATEGORY_DEFINITIONS).filter((k) => !keys.includes(k)),
    ).toEqual([]);
  });

  it('keeps option keys unique', () => {
    expect(new Set(keys).size).toBe(keys.length);
  });
});
