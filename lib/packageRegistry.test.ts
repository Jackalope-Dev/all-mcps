import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bareName,
  checkRegistry,
  npmPackageFor,
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
    ).toEqual({ kind: 'ok', repo: null });
    expect(
      npmStatusFromDoc({
        'dist-tags': { latest: '2.0.0' },
        versions: { '2.0.0': { deprecated: 'Moved to @x/y' } },
      }),
    ).toEqual({ kind: 'deprecated', message: 'Moved to @x/y', repo: null });
  });

  it("reads the package's GitHub repository, latest version first", () => {
    expect(
      npmStatusFromDoc({
        'dist-tags': { latest: '1.0.0' },
        repository: { url: 'git+https://github.com/old/place.git' },
        versions: {
          '1.0.0': {
            repository: {
              url: 'git+https://github.com/Acme/MCP-Server.git',
            },
          },
        },
      }),
    ).toEqual({ kind: 'ok', repo: 'acme/mcp-server' });
    expect(
      npmStatusFromDoc({
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': { repository: 'github:acme/tool' } },
      }),
    ).toEqual({ kind: 'ok', repo: 'acme/tool' });
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
      repo: null,
    });
    expect(pypiStatusFromDoc({ info: {} })).toEqual({ kind: 'ok', repo: null });
  });

  it('prefers a Source link over Homepage for the repository', () => {
    expect(
      pypiStatusFromDoc({
        info: {
          project_urls: {
            Homepage: 'https://acme.dev',
            Source: 'https://github.com/acme/mcp-tool/tree/main',
          },
        },
      }),
    ).toEqual({ kind: 'ok', repo: 'acme/mcp-tool' });
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

describe('checkRegistry', () => {
  afterEach(() => vi.unstubAllGlobals());
  /** Routes fetches by URL; records every URL requested. */
  const registry = (routes: Record<string, Response | (() => Response)>) => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        const r = routes[url];
        if (!r) return new Response('', { status: 404 });
        return typeof r === 'function' ? r() : r;
      }),
    );
    return urls;
  };
  const json = (doc: unknown, status = 200) =>
    new Response(JSON.stringify(doc), { status });
  const NPM = 'https://registry.npmjs.org/@acme%2Ftool';

  it('reads only the latest manifest for npm, never the full packument', async () => {
    const urls = registry({
      [`${NPM}/latest`]: json({
        deprecated: 'Use @acme/tool2',
        repository: { url: 'git+https://github.com/acme/tool.git' },
      }),
    });
    expect(await checkRegistry('npx', '@acme/tool@1.0.0')).toMatchObject({
      kind: 'deprecated',
      message: 'Use @acme/tool2',
    });
    expect(urls).toEqual([`${NPM}/latest`]);
  });

  it('confirms a missing npm latest against the packument', async () => {
    registry({});
    expect(await checkRegistry('npx', '@acme/tool')).toEqual({
      kind: 'missing',
    });
    registry({ [NPM]: json({ time: { unpublished: { time: 'x' } } }) });
    expect(await checkRegistry('npx', '@acme/tool')).toEqual({
      kind: 'missing',
    });
    // Published, just no `latest` tag: not gone.
    registry({ [NPM]: json({ 'dist-tags': {}, versions: {} }) });
    expect((await checkRegistry('npx', '@acme/tool')).kind).toBe('ok');
  });

  it('treats registry errors as unknown', async () => {
    const urls = registry({ [`${NPM}/latest`]: json({}, 503) });
    expect(await checkRegistry('npx', '@acme/tool')).toEqual({
      kind: 'unknown',
    });
    expect(urls).toHaveLength(1);
  });

  it('gives up on an oversized document instead of buffering it', async () => {
    const PYPI = 'https://pypi.org/pypi/big-mcp/json';
    registry({
      [PYPI]: () =>
        new Response(
          JSON.stringify({
            info: { yanked: true },
            pad: 'x'.repeat(1_100_000),
          }),
        ),
    });
    expect(await checkRegistry('uvx', 'big-mcp')).toEqual({ kind: 'unknown' });
    registry({
      [PYPI]: json({ info: { yanked: true, yanked_reason: 'bad' } }),
    });
    expect(await checkRegistry('uvx', 'big-mcp')).toMatchObject({
      kind: 'deprecated',
      message: 'bad',
    });
  });
});

describe('npmPackageFor', () => {
  it('returns the bare npm package for npm runners only', () => {
    expect(
      npmPackageFor({
        installCommand: 'npx',
        installPackage: '@modelcontextprotocol/server-github@1.2.0',
      }),
    ).toBe('@modelcontextprotocol/server-github');
    expect(
      npmPackageFor({
        installCommand: 'uvx',
        installPackage: 'mcp-server-git',
      }),
    ).toBeNull();
  });

  it('never falls back to the listing name', () => {
    expect(
      npmPackageFor({ installCommand: 'npx', installPackage: '' }),
    ).toBeNull();
    expect(npmPackageFor({})).toBeNull();
  });
});
