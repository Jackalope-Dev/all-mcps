import {
  buildMcpServerTweetText,
  dedupeTweetItems,
  getTwitterCharCount,
  normalizeTweetForDedup,
  truncateToTwitterLimit,
  TWITTER_CHAR_LIMIT,
  TWITTER_SAFE_CHAR_LIMIT,
} from './twitter';

// Basic assertions runner for node execution
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Testing twitter char-limit helpers...');

// 1. The safe limit must sit below the X.com hard cap so posts keep breathing room.
assert(TWITTER_SAFE_CHAR_LIMIT < TWITTER_CHAR_LIMIT, 'safe limit should be below the hard cap');
assert(TWITTER_CHAR_LIMIT === 280, 'X.com hard cap should be 280');

// 2. truncateToTwitterLimit defaults to the safe limit.
const longText = 'word '.repeat(200).trim();
const truncatedDefault = truncateToTwitterLimit(longText);
assert(
  getTwitterCharCount(truncatedDefault) <= TWITTER_SAFE_CHAR_LIMIT,
  'default truncation should keep text within the safe limit',
);

// 3. A pre-existing over-length tweet (e.g. an old DB row) is brought under the safe limit.
const legacyTweet =
  '🔥 Featured MCP Server\n\n' +
  'Super Long Server Name With Lots Of Detail\n' +
  'This is a very long description that goes on and on '.repeat(6) +
  '\n\nExplore & install on @AllMCPs:\nhttps://allmcps.com/mcp/some-very-long-server-id-here\n\n#MCP #AI #Claude #DevTools';
assert(
  getTwitterCharCount(truncateToTwitterLimit(legacyTweet, TWITTER_SAFE_CHAR_LIMIT)) <= TWITTER_SAFE_CHAR_LIMIT,
  'legacy over-length tweet should be truncated under the safe limit',
);

// 4. Freshly built tweets never exceed the safe limit, even with huge inputs.
const builtLong = buildMcpServerTweetText({
  id: 'some-very-long-server-id-with-many-descriptive-words',
  name: 'modelcontextprotocol/an-extremely-long-and-descriptive-server-name',
  description: 'A really long description. '.repeat(40),
  category: 'database',
  isFeatured: true,
});
assert(
  getTwitterCharCount(builtLong) <= TWITTER_SAFE_CHAR_LIMIT,
  'built tweet (long input) should be within the safe limit',
);

// 5. Short inputs are left untouched and still within the safe limit.
const builtShort = buildMcpServerTweetText({
  id: 'memory',
  name: 'server-memory',
  description: 'Persistent memory for your agents.',
  category: 'database',
});
assert(
  getTwitterCharCount(builtShort) <= TWITTER_SAFE_CHAR_LIMIT,
  'built tweet (short input) should be within the safe limit',
);

// 6. Text already under the limit is returned unchanged.
const shortText = 'Just a short tweet.';
assert(
  truncateToTwitterLimit(shortText) === shortText,
  'text under the limit should be returned unchanged',
);

console.log('Testing tweet duplicate-detection helpers...');

// 7. Normalization ignores case and surrounding/inner whitespace, the way X.com
//    does when it flags a repost.
assert(
  normalizeTweetForDedup('Hello   World') === normalizeTweetForDedup('hello world'),
  'normalization should ignore case and collapse whitespace',
);
assert(
  normalizeTweetForDedup('  Spaced  \n out  ') === 'spaced out',
  'normalization should trim and collapse newlines',
);

// 8. dedupeTweetItems keeps the first occurrence of each unique body and drops
//    later duplicates — callers feed items newest-first, so the newest copy wins.
const deduped = dedupeTweetItems([
  { id: 3, tweetText: 'Check out Server A on @AllMCPs' },
  { id: 2, tweetText: 'check out server a on @allmcps' }, // duplicate of id 3 (case/space)
  { id: 1, tweetText: 'A different tweet entirely' },
]);
assert(deduped.length === 2, 'dedupeTweetItems should drop the duplicate body');
assert(
  (deduped[0] as any).id === 3 && (deduped[1] as any).id === 1,
  'dedupeTweetItems should keep the first occurrence of each unique body',
);

// 9. A list with no duplicates is returned intact.
const unique = dedupeTweetItems([
  { tweetText: 'one', serverId: 'server-1' },
  { tweetText: 'two', serverId: 'server-2' },
  { tweetText: 'three', serverId: 'server-3' },
]);
assert(unique.length === 3, 'dedupeTweetItems should leave unique lists unchanged');

// 10. dedupeTweetItems drops duplicate serverId even if tweet text differs slightly.
const dedupedServer = dedupeTweetItems([
  { id: 4, serverId: 'server-alpha', tweetText: '🚀 Server Alpha now on AllMCPs!' },
  { id: 3, serverId: 'server-alpha', tweetText: '🔥 Check out Server Alpha on AllMCPs!' },
  { id: 2, serverId: 'server-beta', tweetText: '⭐ Server Beta spotlight!' },
]);
assert(dedupedServer.length === 2, 'dedupeTweetItems should drop duplicate serverId');
assert(
  (dedupedServer[0] as any).id === 4 && (dedupedServer[1] as any).id === 2,
  'dedupeTweetItems should keep the newest tweet for each serverId',
);

console.log('All twitter deduplication and char-limit tests passed ✔');

