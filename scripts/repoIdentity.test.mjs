import { describe, expect, it } from 'vitest';
import { findRepoIdentityMismatch } from './repoIdentity.mjs';

const at = (name, url, githubStars) => ({ name, url, githubStars });

describe('findRepoIdentityMismatch — real mismatches', () => {
  it('flags a listing pointing at an unrelated popular project', () => {
    expect(
      findRepoIdentityMismatch(
        at('ai-netcafe', 'https://github.com/ChatGPTNextWeb/NextChat', 88713),
      ),
    ).toMatch(/shares no identity/);

    expect(
      findRepoIdentityMismatch(
        at(
          'labelhead-artist-momentum',
          'https://github.com/paperclipai/paperclip',
          80077,
        ),
      ),
    ).toMatch(/shares no identity/);

    expect(
      findRepoIdentityMismatch(
        at(
          'basebalance.cloud — x402 RPC & MCP gateway',
          'https://github.com/Conway-Research/automaton.git',
          6130,
        ),
      ),
    ).toMatch(/shares no identity/);
  });

  it('reports the star count so a reviewer can judge the impact', () => {
    const warning = findRepoIdentityMismatch(
      at('ai-netcafe', 'https://github.com/ChatGPTNextWeb/NextChat', 88713),
    );
    expect(warning).toContain('88,713');
  });
});

describe('findRepoIdentityMismatch — must not flag legitimate listings', () => {
  it('accepts monorepo subpaths where the name matches a deep segment', () => {
    for (const name of ['Time', 'Memory', 'Git', 'Filesystem', 'Fetch']) {
      const url = `https://github.com/modelcontextprotocol/servers/tree/main/src/${name.toLowerCase()}`;
      expect(findRepoIdentityMismatch(at(name, url, 90185)), name).toBeNull();
    }
  });

  it('accepts a spaced name against a concatenated repo name', () => {
    expect(
      findRepoIdentityMismatch(
        at(
          'Sequential Thinking',
          'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
          90185,
        ),
      ),
    ).toBeNull();
    expect(
      findRepoIdentityMismatch(
        at('World Monitor', 'https://github.com/koala73/worldmonitor', 85591),
      ),
    ).toBeNull();
  });

  it('accepts punctuation-only differences', () => {
    expect(
      findRepoIdentityMismatch(
        at('draw.io', 'https://github.com/jgraph/drawio-mcp', 5344),
      ),
    ).toBeNull();
  });

  it('accepts camelCase repo and owner names', () => {
    expect(
      findRepoIdentityMismatch(
        at(
          'Finance Toolkit',
          'https://github.com/JerBouma/FinanceToolkit',
          5297,
        ),
      ),
    ).toBeNull();
    expect(
      findRepoIdentityMismatch(
        at('Microsoft Learn MCP', 'https://github.com/MicrosoftDocs/mcp', 1873),
      ),
    ).toBeNull();
  });
});

describe('findRepoIdentityMismatch — scope limits', () => {
  it('stays quiet below the star floor, where a mismatch is unverifiable', () => {
    expect(
      findRepoIdentityMismatch(
        at('something-else', 'https://github.com/someone/obscure-repo', 12),
      ),
    ).toBeNull();
  });

  it('stays quiet when star data is missing', () => {
    expect(
      findRepoIdentityMismatch(
        at('something-else', 'https://github.com/someone/obscure-repo', null),
      ),
    ).toBeNull();
  });

  it('ignores non-GitHub URLs', () => {
    expect(
      findRepoIdentityMismatch(
        at('Anything', 'https://example.dev/mcp', 99999),
      ),
    ).toBeNull();
  });

  it('ignores a nameless candidate rather than guessing', () => {
    expect(
      findRepoIdentityMismatch(at('', 'https://github.com/a/b', 99999)),
    ).toBeNull();
  });

  it('is unaffected by query strings and .git suffixes', () => {
    expect(
      findRepoIdentityMismatch(
        at(
          'Paperclip',
          'https://github.com/paperclipai/paperclip.git?x=1',
          80077,
        ),
      ),
    ).toBeNull();
  });
});
