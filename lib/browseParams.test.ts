import { describe, expect, it } from 'vitest';
import { browseQueryString, parseBrowseParams } from './browseParams';

const parse = (qs: string) => parseBrowseParams(new URLSearchParams(qs));

describe('parseBrowseParams', () => {
  it('defaults to trending without a query and relevance with one', () => {
    expect(parse('').sort).toBe('trending');
    expect(parse('q=github').sort).toBe('relevance');
    expect(parse('sort=relevance').sort).toBe('trending');
  });

  it('drops unknown facet values instead of failing', () => {
    const p = parse('stack=cobol&transport=pigeon&sort=random&limit=9999');
    expect(p.stack).toBeNull();
    expect(p.transport).toBeNull();
    expect(p.sort).toBe('trending');
    expect(p.limit).toBe(60);
  });

  it('round-trips through the query string', () => {
    const p = parse(
      'q=postgres&stack=python&transport=remote&verified=1&sort=popular&offset=30',
    );
    expect(parse(browseQueryString(p))).toEqual(p);
  });
});
