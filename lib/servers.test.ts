import { formatServerSummaryLine, type Server } from './servers';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function fakeServer(overrides: Partial<Server> = {}): Server {
  return {
    id: 'demo-server',
    name: 'Demo Server',
    url: 'https://github.com/demo/demo-server',
    description: 'A demo MCP server for testing.',
    category: '💻 Developer Tools',
    isOfficial: false,
    status: 'active',
    createdAt: '2026-01-01',
    ...overrides,
  };
}

console.log('Testing formatServerSummaryLine...');

// 1. With stars and installs, both are shown.
const withStats = formatServerSummaryLine(
  fakeServer({ githubStars: 1200, copies: 340 }),
);
assert(
  withStats.includes('[Demo Server](https://allmcps.com/mcp/demo-server)'),
  'Should link to the listing page',
);
assert(withStats.includes('⭐ 1,200'), 'Should show formatted star count');
assert(withStats.includes('340 installs'), 'Should show install count');
assert(
  withStats.includes('A demo MCP server for testing.'),
  'Should include the description',
);

// 2. With no stats at all, no empty parens are emitted.
const noStats = formatServerSummaryLine(
  fakeServer({ githubStars: null, copies: 0 }),
);
assert(
  !noStats.includes('()'),
  'Should not render empty parens when there are no stats',
);

console.log('ALL TESTS PASSED SUCCESSFULLY!');
