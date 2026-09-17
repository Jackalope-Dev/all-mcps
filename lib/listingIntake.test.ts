import { describe, expect, it, vi } from 'vitest';
import {
  buildListingSlug,
  enrichFromGitHub,
  SUGGESTED_INSTALL_COMMAND_MAX,
} from './listingIntake';

describe('buildListingSlug', () => {
  it('slugifies a name', () => {
    expect(buildListingSlug('Brain Scanner')).toBe('brain-scanner');
    expect(buildListingSlug('Foo!! Bar__Baz')).toBe('foo-bar-baz');
  });

  it('caps at the 64-byte Vectorize id limit without a trailing dash', () => {
    const slug = buildListingSlug('a'.repeat(80));
    expect(slug.length).toBeLessThanOrEqual(64);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('falls back to a generated id when nothing survives slugification', () => {
    expect(buildListingSlug('!!!')).toMatch(/^mcp-\d+$/);
  });
});

describe('enrichFromGitHub', () => {
  const base = {
    url: 'https://github.com/owner/repo',
    name: '',
    description: '',
    websiteUrl: '',
  };

  it('sends an Authorization header when a token is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'repo', description: 'd', homepage: '' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await enrichFromGitHub(base, { GITHUB_TOKEN: 'tok_123' });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer tok_123');
    vi.unstubAllGlobals();
  });

  it('fills only the fields the submitter left blank', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'from-github',
          description: 'from-github-desc',
          homepage: 'https://example.com',
        }),
      }),
    );

    const result = await enrichFromGitHub(
      { ...base, name: 'Submitter Name' },
      {},
    );
    expect(result.name).toBe('Submitter Name');
    expect(result.description).toBe('from-github-desc');
    expect(result.websiteUrl).toBe('https://example.com');
    vi.unstubAllGlobals();
  });

  it('never throws when GitHub is down — a submission must still go through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(enrichFromGitHub(base, {})).resolves.toEqual({
      name: '',
      description: '',
      websiteUrl: '',
    });
    vi.unstubAllGlobals();
  });

  it('skips the fetch entirely for a non-GitHub url', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await enrichFromGitHub({ ...base, url: 'https://brainscanner.dev/' }, {});
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('rejects an unsafe homepage rather than storing it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ homepage: 'http://localhost:8080' }),
      }),
    );
    const result = await enrichFromGitHub(base, {});
    expect(result.websiteUrl).toBe('');
    vi.unstubAllGlobals();
  });
});

describe('install command cap', () => {
  it('matches the dashboard edit schema so owners can edit what they submitted', () => {
    expect(SUGGESTED_INSTALL_COMMAND_MAX).toBe(80);
  });
});
