import { describe, expect, it } from 'vitest';
import {
  AD_EDITABLE_KEYS,
  AD_EDITABLE_STATUSES,
  adRevisionToDbPatch,
  diffAdFields,
  type EditableAdFields,
  parseAdRevision,
  serializeAdRevision,
  validateAdEdit,
} from './adRevision';

const live: EditableAdFields = {
  title: 'QuerySail for GSC',
  description: 'Ask Search Console questions in plain English.',
  ctaText: 'Learn More',
  targetUrl: 'https://querysail.com/google-search-console',
};

describe('validateAdEdit', () => {
  it('accepts the live creative', () => {
    expect(validateAdEdit(live)).toBeNull();
  });

  it('enforces the same length limits as campaign creation', () => {
    expect(validateAdEdit({ ...live, title: 'x' })).toMatch(/Title/);
    expect(validateAdEdit({ ...live, title: 'x'.repeat(51) })).toMatch(/Title/);
    expect(validateAdEdit({ ...live, description: 'shrt' })).toMatch(
      /Description/,
    );
    expect(validateAdEdit({ ...live, description: 'x'.repeat(141) })).toMatch(
      /Description/,
    );
    expect(validateAdEdit({ ...live, ctaText: '  ' })).toMatch(/Button text/);
    expect(validateAdEdit({ ...live, ctaText: 'x'.repeat(26) })).toMatch(
      /Button text/,
    );
  });

  it('only allows public http(s) destinations', () => {
    for (const targetUrl of [
      'javascript:alert(1)',
      'ftp://querysail.com',
      'http://localhost:3000',
      'http://192.168.1.10/',
      'not a url',
    ]) {
      expect(validateAdEdit({ ...live, targetUrl })).toMatch(/Destination URL/);
    }
    expect(
      validateAdEdit({
        ...live,
        targetUrl: 'https://querysail.com/new-landing?ref=ad',
      }),
    ).toBeNull();
  });
});

describe('diffAdFields', () => {
  it('returns only changed, trimmed fields', () => {
    expect(
      diffAdFields(live, {
        ...live,
        title: '  New headline ',
        targetUrl: 'https://querysail.com/new',
      }),
    ).toEqual({
      title: 'New headline',
      targetUrl: 'https://querysail.com/new',
    });
  });

  it('treats whitespace-only differences as no change', () => {
    expect(diffAdFields(live, { ...live, title: ` ${live.title} ` })).toEqual(
      {},
    );
  });
});

describe('revision round-trip', () => {
  it('serializes, parses and patches back to the proposed fields', () => {
    const proposed = {
      description: 'Fresh copy for the second half of the run.',
    };
    const parsed = parseAdRevision(serializeAdRevision(proposed));
    expect(parsed?.proposed).toEqual(proposed);
    expect(typeof parsed?.submittedAt).toBe('string');
    expect(adRevisionToDbPatch(parsed?.proposed ?? {})).toEqual(proposed);
  });

  it('rejects unreadable blobs', () => {
    expect(parseAdRevision(null)).toBeNull();
    expect(parseAdRevision('{oops')).toBeNull();
    expect(parseAdRevision('{"submittedAt":"x"}')).toBeNull();
  });
});

describe('adRevisionToDbPatch', () => {
  it('can never touch delivery fields, even from a tampered blob', () => {
    const tampered = {
      title: 'Hi',
      placement: 'header_banner',
      bidCpm: 1,
      totalImpressionsPurchased: 1_000_000,
      status: 'active',
      ctaText: '   ',
    } as unknown as Partial<EditableAdFields>;
    expect(adRevisionToDbPatch(tampered)).toEqual({ title: 'Hi' });
  });

  it('only whitelists creative keys', () => {
    expect(AD_EDITABLE_KEYS).toEqual([
      'title',
      'description',
      'ctaText',
      'targetUrl',
    ]);
  });
});

describe('AD_EDITABLE_STATUSES', () => {
  it('allows running and queued campaigns, not finished or rejected ones', () => {
    for (const status of ['pending_approval', 'active', 'paused']) {
      expect(AD_EDITABLE_STATUSES.has(status)).toBe(true);
    }
    for (const status of ['completed', 'rejected']) {
      expect(AD_EDITABLE_STATUSES.has(status)).toBe(false);
    }
  });
});
