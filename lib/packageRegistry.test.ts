import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bareName,
  npmStatusFromDoc,
  packageBelongsElsewhere,
  pypiStatusFromDoc,
  registryFor,
  sourceReposFromDoc,
} from './packageRegistry';

describe('bareName', () => {
  it('keeps scopes and drops versions', () => {
    expect(bareName('@modelcontextprotocol/server-github@1.2.0')).toBe(
      '@modelcontextprotocol/server-github',
    );
    expect(bareName('@scope/pkg')).toBe('@scope/pkg');
    expect(bareName('mcp-server-time==0.6')).toBe('mcp-server-time');
  });
});

describe('registryFor', () => {
  it('maps runners to registries and ignores the rest', () => {
    expect(registryFor('npx')).toBe('npm');
    expect(registryFor('uvx')).toBe('pypi');
    expect(registryFor('docker')).toBeNull();
  });
});

describe('npmStatusFromDoc', () => {
  it('reads deprecation from the latest version only', () => {
    expect(
      npmStatusFromDoc({
        'dist-tags': { latest: '2.0.0' },
        versions: { '1.0.0': { deprecated: 'old' }, '2.0.0': {} },
      }),
    ).toEqual({ kind: 'ok' });
    expect(
      npmStatusFromDoc({
        'dist-tags': { latest: '2.0.0' },
        versions: { '2.0.0': { deprecated: 'Moved to @x/y' } },
      }),
    ).toEqual({ kind: 'deprecated', message: 'Moved to @x/y' });
  });

  it('treats an unpublished package as missing', () => {
    expect(npmStatusFromDoc({ time: { unpublished: { time: 'x' } } })).toEqual({
      kind: 'missing',
    });
  });
});

describe('pypiStatusFromDoc', () => {
  it('treats a yanked latest as deprecated', () => {
    expect(
      pypiStatusFromDoc({ info: { yanked: true, yanked_reason: 'broken' } }),
    ).toEqual({
      kind: 'deprecated',
      message: 'broken',
    });
    expect(pypiStatusFromDoc({ info: {} })).toEqual({ kind: 'ok' });
  });
});

describe('sourceReposFromDoc', () => {
  it('reads npm repository, homepage and bugs links', () => {
    expect(
      sourceReposFromDoc('npm', {
        repository: { url: 'git+https://github.com/Owner/Repo.git' },
        homepage: 'https://example.com',
      }),
    ).toEqual([{ owner: 'owner', repo: 'repo' }]);
  });

  it('reads PyPI project urls', () => {
    expect(
      sourceReposFromDoc('pypi', {
        info: { project_urls: { Source: 'https://github.com/a/b' } },
      }),
    ).toEqual([{ owner: 'a', repo: 'b' }]);
  });
});

describe('packageBelongsElsewhere', () => {
  afterEach(() => vi.unstubAllGlobals());
  const registryReturns = (status: number, doc: unknown = {}) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(doc), { status })),
    );
  const LISTING = 'https://github.com/acme/audit-mcp';

  it("flags a package whose source is another project's repo", async () => {
    registryReturns(200, {
      repository: {
        url: 'git+https://github.com/modelcontextprotocol/servers.git',
      },
    });
    expect(
      await packageBelongsElsewhere(
        'npx',
        '@modelcontextprotocol/server-filesystem',
        LISTING,
      ),
    ).toBe(true);
  });

  it('flags a package the registry does not have', async () => {
    registryReturns(404);
    expect(await packageBelongsElsewhere('npx', 'without', LISTING)).toBe(true);
  });

  it('keeps a package from the same owner or a renamed org', async () => {
    registryReturns(200, { repository: 'github:acme/other-repo' });
    expect(await packageBelongsElsewhere('npx', 'acme-tool', LISTING)).toBe(
      false,
    );
    registryReturns(200, {
      repository: 'https://github.com/old-org/audit-mcp',
    });
    expect(await packageBelongsElsewhere('npx', 'audit-mcp', LISTING)).toBe(
      false,
    );
  });

  it('keeps a package named exactly like the listing repo', async () => {
    registryReturns(200, { repository: 'https://github.com/someone/else' });
    expect(await packageBelongsElsewhere('uvx', 'audit-mcp', LISTING)).toBe(
      false,
    );
  });

  it('keeps a package with no source metadata or on a registry error', async () => {
    registryReturns(200, { name: 'x' });
    expect(await packageBelongsElsewhere('npx', 'x', LISTING)).toBe(false);
    registryReturns(503);
    expect(await packageBelongsElsewhere('npx', 'x', LISTING)).toBe(false);
  });

  it('skips non-GitHub listings and unknown runners', async () => {
    registryReturns(404);
    expect(
      await packageBelongsElsewhere('npx', 'x', 'https://example.com'),
    ).toBe(false);
    expect(await packageBelongsElsewhere('docker', 'x', LISTING)).toBe(false);
  });
});
