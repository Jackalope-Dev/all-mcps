import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  manifestInstallCandidates,
  npmCandidates,
  pypiCandidates,
} from './repoManifest';

describe('npmCandidates', () => {
  it('runs a package with one bin directly', () => {
    expect(
      npmCandidates({ name: '@acme/weather-mcp', bin: 'dist/cli.js' }),
    ).toEqual([
      {
        command: 'npx',
        args: ['-y', '@acme/weather-mcp'],
        package: '@acme/weather-mcp',
      },
    ]);
    expect(
      npmCandidates({ name: 'tool', bin: { tool: 'a.js', other: 'b.js' } }),
    ).toEqual([{ command: 'npx', args: ['-y', 'tool'], package: 'tool' }]);
  });

  it('names the bin when several exist and none matches the package', () => {
    expect(
      npmCandidates({
        name: 'kit',
        bin: { 'kit-mcp': 'a.js', 'kit-cli': 'b.js' },
      }),
    ).toEqual([
      { command: 'npx', args: ['-y', '-p', 'kit', 'kit-mcp'], package: 'kit' },
      { command: 'npx', args: ['-y', '-p', 'kit', 'kit-cli'], package: 'kit' },
    ]);
  });

  it('skips private packages and libraries with nothing to run', () => {
    expect(npmCandidates({ name: 'app', private: true, bin: 'x.js' })).toEqual(
      [],
    );
    expect(npmCandidates({ name: 'lib-only' })).toEqual([]);
    expect(npmCandidates(null)).toEqual([]);
  });
});

describe('pypiCandidates', () => {
  it('runs the entry point named after the package', () => {
    const toml =
      '[project]\nname = "tripitaka_mcp"\n\n[project.scripts]\ntripitaka-mcp = "tripitaka.server:main"\n';
    expect(pypiCandidates(toml)).toEqual([
      { command: 'uvx', args: ['tripitaka_mcp'], package: 'tripitaka_mcp' },
    ]);
  });

  it('uses --from for differently named entry points, including Poetry ones', () => {
    const toml =
      '[tool.poetry]\nname = "agentward"\n\n[tool.poetry.scripts]\naw = "agentward.cli:main"\n';
    expect(pypiCandidates(toml)).toEqual([
      {
        command: 'uvx',
        args: ['--from', 'agentward', 'aw'],
        package: 'agentward',
      },
    ]);
  });

  it('skips a project with no entry point', () => {
    expect(pypiCandidates('[project]\nname = "lib"\n')).toEqual([]);
  });
});

describe('manifestInstallCandidates', () => {
  afterEach(() => vi.unstubAllGlobals());
  const LISTING = 'https://github.com/acme/weather-mcp';

  const stubNetwork = (files: Record<string, string>, registryDoc: unknown) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('https://raw.githubusercontent.com/')) {
          const file = Object.keys(files).find((f) =>
            url.endsWith(`/HEAD/${f}`),
          );
          return new Response(file ? files[file] : 'nope', {
            status: file ? 200 : 404,
          });
        }
        return registryDoc
          ? new Response(JSON.stringify(registryDoc), { status: 200 })
          : new Response('{}', { status: 404 });
      }),
    );

  it('proposes a package the registry says is published from this repo', async () => {
    stubNetwork(
      {
        'package.json': JSON.stringify({ name: 'weather-mcp', bin: 'cli.js' }),
      },
      { repository: 'git+https://github.com/acme/weather-mcp.git' },
    );
    expect(await manifestInstallCandidates(LISTING)).toEqual([
      { command: 'npx', args: ['-y', 'weather-mcp'], package: 'weather-mcp' },
    ]);
  });

  it("drops a same-named package whose source is a stranger's repo", async () => {
    stubNetwork(
      {
        'package.json': JSON.stringify({ name: 'weather-mcp', bin: 'cli.js' }),
      },
      { repository: 'https://github.com/someone/else' },
    );
    expect(await manifestInstallCandidates(LISTING)).toEqual([]);
  });

  it('drops an unpublished package and ignores non-GitHub listings', async () => {
    stubNetwork(
      {
        'package.json': JSON.stringify({ name: 'weather-mcp', bin: 'cli.js' }),
      },
      null,
    );
    expect(await manifestInstallCandidates(LISTING)).toEqual([]);
    expect(await manifestInstallCandidates('https://example.com/x')).toEqual(
      [],
    );
  });
});
