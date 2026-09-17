import { describe, expect, it } from 'vitest';
import {
  normalizeNameSiteKey,
  normalizePackageKey,
  normalizeUrlKey,
} from './urlDedup';

describe('normalizeUrlKey', () => {
  it('treats www and non-www as the same listing', () => {
    // Four of the five duplicate groups in production differed only by `www.`
    // — this key lowercased the host but never stripped it.
    expect(normalizeUrlKey('https://postey.ai')).toBe(
      normalizeUrlKey('https://www.postey.ai'),
    );
    expect(normalizeUrlKey('https://glushkov-modelling.com')).toBe(
      normalizeUrlKey('https://www.glushkov-modelling.com'),
    );
  });

  it('agrees with normalizeNameSiteKey about www, which already stripped it', () => {
    const a = normalizeNameSiteKey('Postey', 'https://postey.ai');
    const b = normalizeNameSiteKey('Postey', 'https://www.postey.ai');
    expect(a).toBe(b);
    expect(normalizeUrlKey('https://postey.ai')).toBe(
      normalizeUrlKey('https://www.postey.ai'),
    );
  });

  it('normalizes protocol, trailing slash, case and .git', () => {
    expect(normalizeUrlKey('https://GitHub.com/Owner/Repo.git')).toBe(
      normalizeUrlKey('http://github.com/owner/repo/'),
    );
  });

  it('keeps genuinely different hosts and paths apart', () => {
    expect(normalizeUrlKey('https://github.com/a/b')).not.toBe(
      normalizeUrlKey('https://github.com/a/c'),
    );
    expect(normalizeUrlKey('https://example.com')).not.toBe(
      normalizeUrlKey('https://example.dev'),
    );
    // Only a leading www. is a prefix — don't collapse an unrelated subdomain.
    expect(normalizeUrlKey('https://api.example.com')).not.toBe(
      normalizeUrlKey('https://example.com'),
    );
  });

  it('falls back to a trimmed lowercase string for unparseable input', () => {
    expect(normalizeUrlKey('  NotAUrl  ')).toBe('notaurl');
  });
});

describe('normalizePackageKey', () => {
  it('builds an ecosystem-scoped key', () => {
    expect(normalizePackageKey('npm', '@Foo/Bar')).toBe('npm:@foo/bar');
  });

  it('rejects empty, missing, and URL-shaped package names', () => {
    expect(normalizePackageKey(null, 'x')).toBeNull();
    expect(normalizePackageKey('npm', '')).toBeNull();
    expect(normalizePackageKey('npm', 'https://example.com')).toBeNull();
  });
});
