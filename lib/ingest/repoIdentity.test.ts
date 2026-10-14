import { describe, expect, it } from 'vitest';
import { findRepoIdentityMismatch as scriptVersion } from '../../scripts/repoIdentity.mjs';
import { findRepoIdentityMismatch } from './repoIdentity';

/**
 * The cron ingest and the manual script must flag the same rows, so every
 * case here runs through both. Behavioural cases live in
 * scripts/repoIdentity.test.mjs.
 */
const CASES: Array<[string, string, number | null]> = [
  ['ai-netcafe', 'https://github.com/ChatGPTNextWeb/NextChat', 88713],
  [
    'labelhead-artist-momentum',
    'https://github.com/paperclipai/paperclip',
    80077,
  ],
  [
    'basebalance.cloud — x402 RPC & MCP gateway',
    'https://github.com/Conway-Research/automaton.git',
    6130,
  ],
  [
    'Time',
    'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
    90185,
  ],
  [
    'Sequential Thinking',
    'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    90185,
  ],
  ['World Monitor', 'https://github.com/koala73/worldmonitor', 85591],
  ['draw.io', 'https://github.com/jgraph/drawio-mcp', 5344],
  ['Finance Toolkit', 'https://github.com/JerBouma/FinanceToolkit', 5297],
  ['Microsoft Learn MCP', 'https://github.com/MicrosoftDocs/mcp', 1873],
  ['something-else', 'https://github.com/someone/obscure-repo', 12],
  ['something-else', 'https://github.com/someone/obscure-repo', null],
  ['Anything', 'https://example.dev/mcp', 99999],
  ['', 'https://github.com/a/b', 99999],
  ['Paperclip', 'https://github.com/paperclipai/paperclip.git?x=1', 80077],
];

describe('findRepoIdentityMismatch (TS port)', () => {
  it('agrees with scripts/repoIdentity.mjs on every case', () => {
    for (const [name, url, githubStars] of CASES) {
      expect(findRepoIdentityMismatch({ name, url, githubStars }), name).toBe(
        scriptVersion({ name, url, githubStars }),
      );
    }
  });

  it('flags a borrowed popular repo', () => {
    expect(
      findRepoIdentityMismatch({
        name: 'ai-netcafe',
        url: 'https://github.com/ChatGPTNextWeb/NextChat',
        githubStars: 88713,
      }),
    ).toMatch(/shares no identity/);
  });
});
