import {
  buildMcpServerTweetText,
  getTwitterCharCount,
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

console.log('All twitter char-limit tests passed ✔');
