import { describe, expect, it } from 'vitest';
import {
  githubRepoToCandidate,
  githubRepoUrlFrom,
  type IngestCandidate,
  ingestRejectReason,
  npmObjectToCandidate,
  parseServerList,
  README_SOURCES,
  registryEntryToCandidate,
} from './sources';

const OFFICIAL = 'io.modelcontextprotocol.registry/official';

describe('parseServerList', () => {
  const awesome = README_SOURCES[0];
  const reference = README_SOURCES[1];

  it('reads only the server section, with sub-headings as categories', () => {
    const md = [
      '## Clients',
      '- [Some Client](https://github.com/a/client) - not a server',
      '## Server Implementations',
      '### 🗄️ Databases',
      '- [Postgres MCP](https://github.com/a/pg-mcp) 🐍 - Query <b>Postgres</b> with `SQL`',
      '- [Awesome Lists](https://github.com/x/awesome-x) - skipped',
      '- [Anchor](#databases)',
      '## Tutorials',
      '- [Guide](https://example.com/guide) - not a server',
    ].join('\n');
    expect(parseServerList(md, awesome)).toEqual([
      {
        name: 'Postgres MCP',
        url: 'https://github.com/a/pg-mcp',
        description: '🐍 - Query Postgres with SQL',
        category: '🗄️ Databases',
        source: 'awesome-list',
      },
    ]);
  });

  it('resolves repo-relative links and skips archived reference servers', () => {
    const md = [
      '## 🌟 Reference Servers',
      '- **[Fetch](src/fetch)** - Web content fetching',
      '### Archived',
      '- **[Old](src/old)** - gone',
    ].join('\n');
    const out = parseServerList(md, reference);
    expect(out.map((c) => c.url)).toEqual([
      'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    ]);
  });
});

describe('registryEntryToCandidate', () => {
  it('skips entries the registry does not consider active and latest', () => {
    const server = {
      name: 'io.github.a/b',
      repository: { url: 'https://github.com/a/b' },
    };
    expect(
      registryEntryToCandidate({
        server,
        _meta: { [OFFICIAL]: { status: 'deleted' } },
      }),
    ).toBeNull();
    expect(
      registryEntryToCandidate({
        server,
        _meta: { [OFFICIAL]: { isLatest: false } },
      }),
    ).toBeNull();
    expect(registryEntryToCandidate({ server: { name: 'x' } })).toBeNull();
  });

  it('replaces a generic leaf name with the GitHub owner/repo', () => {
    const c = registryEntryToCandidate({
      server: {
        name: 'io.github.acme/mcp',
        repository: { url: 'https://github.com/acme/widgets.git' },
      },
    });
    expect(c?.name).toBe('acme/widgets');
  });

  it('carries the declared stdio package and the publisher endpoint', () => {
    const c = registryEntryToCandidate({
      server: {
        name: 'io.github.a/weather',
        title: 'Weather',
        description: 'Forecasts',
        repository: { url: 'https://github.com/a/weather' },
        websiteUrl: 'https://weather.example',
        packages: [
          {
            registryType: 'pypi',
            identifier: 'weather-mcp',
            transport: { type: 'stdio' },
          },
        ],
        remotes: [
          { type: 'streamable-http', url: 'https://weather.example/mcp' },
        ],
      },
    });
    expect(c).toMatchObject({
      name: 'Weather',
      installCommand: 'uvx',
      installPackage: 'weather-mcp',
      remoteEndpointUrl: 'https://weather.example/mcp',
      websiteUrl: 'https://weather.example',
    });
  });

  it('ignores hosted proxies of someone else’s server', () => {
    const c = registryEntryToCandidate({
      server: {
        name: 'io.github.a/b',
        repository: { url: 'https://github.com/a/b' },
        remotes: [
          {
            type: 'streamable-http',
            url: 'https://server.smithery.ai/@a/b/mcp',
          },
        ],
      },
    });
    expect(c?.remoteEndpointUrl).toBeUndefined();
  });
});

describe('npm candidates', () => {
  it('extracts GitHub repo URLs from npm repository strings', () => {
    expect(githubRepoUrlFrom('git+https://github.com/a/b.git')).toBe(
      'https://github.com/a/b',
    );
    expect(githubRepoUrlFrom('git@github.com:a/b.git')).toBe(
      'https://github.com/a/b',
    );
    expect(githubRepoUrlFrom('https://gitlab.com/a/b')).toBeNull();
  });

  it('needs a GitHub repo and some downloads', () => {
    const pkg = {
      name: 'weather-mcp',
      description: 'Forecasts',
      links: { repository: 'git+https://github.com/a/weather-mcp.git' },
    };
    expect(
      npmObjectToCandidate({ downloads: { monthly: 10 }, package: pkg }),
    ).toBeNull();
    expect(
      npmObjectToCandidate({
        downloads: { monthly: 500 },
        package: { ...pkg, links: {} },
      }),
    ).toBeNull();
    expect(
      npmObjectToCandidate({ downloads: { monthly: 500 }, package: pkg }),
    ).toMatchObject({
      url: 'https://github.com/a/weather-mcp',
      installCommand: 'npx',
      installPackage: 'weather-mcp',
      source: 'npm',
    });
  });
});

describe('githubRepoToCandidate', () => {
  it('applies the star floor and keeps archived/fork for the quality floor', () => {
    const repo = {
      name: 'weather-mcp',
      html_url: 'https://github.com/a/weather-mcp',
      description: 'Forecasts',
      homepage: 'https://weather.example',
      stargazers_count: 12,
      archived: true,
    };
    expect(githubRepoToCandidate({ ...repo, stargazers_count: 2 })).toBeNull();
    expect(githubRepoToCandidate(repo)).toMatchObject({
      archived: true,
      githubStars: 12,
      websiteUrl: 'https://weather.example',
      source: 'github-topic',
    });
  });
});

describe('ingestRejectReason', () => {
  const base: IngestCandidate = {
    name: 'Weather MCP',
    url: 'https://github.com/a/weather-mcp',
    description: 'Forecasts for any city',
    source: 'npm',
  };

  it('passes a normal server', () => {
    expect(ingestRejectReason(base)).toBeNull();
  });

  it('rejects missing descriptions, archived repos and starless forks', () => {
    expect(ingestRejectReason({ ...base, description: '  ' })).toBe(
      'no description',
    );
    expect(ingestRejectReason({ ...base, archived: true })).toBe(
      'archived repo',
    );
    expect(ingestRejectReason({ ...base, fork: true, githubStars: 0 })).toBe(
      'fork with no stars',
    );
    expect(
      ingestRejectReason({ ...base, fork: true, githubStars: 3 }),
    ).toBeNull();
  });

  it('rejects adult content at any quality', () => {
    expect(
      ingestRejectReason({
        ...base,
        name: 'Acme Clips',
        url: 'https://brainscanner.dev/mcp',
        description: 'Search adult short-form video: clips and creators.',
        source: 'official-registry',
      }),
    ).toBe('adult content');
  });

  it("rejects the templated network's site boilerplate", () => {
    expect(
      ingestRejectReason({
        ...base,
        name: 'Site',
        url: 'https://brainscanner.dev',
        description:
          "Brainscanner: the site's own MCP server — calculator, enquiry (enquiry = a human handoff, not a purchase)",
        source: 'official-registry',
      }),
    ).toBe('templated site network');
    expect(
      ingestRejectReason({
        ...base,
        description: 'Search the docs site and its own MCP server changelog',
      }),
    ).toBeNull();
  });

  it('rejects scaffold names as whole words only', () => {
    for (const name of [
      'mcp-test',
      'Demo Server',
      'my-first-mcp',
      'mcp template',
    ]) {
      expect(ingestRejectReason({ ...base, name }), name).toBe(
        'scaffold or demo name',
      );
    }
    expect(
      ingestRejectReason({ ...base, url: 'https://github.com/a/mcp-starter' }),
    ).toBe('scaffold or demo name');
    for (const name of [
      'testrail-mcp',
      'Demographics MCP',
      'Templated Docs',
      'Contest Tracker',
    ]) {
      expect(ingestRejectReason({ ...base, name }), name).toBeNull();
    }
  });
});
