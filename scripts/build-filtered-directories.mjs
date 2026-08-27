import fs from 'node:fs';
import path from 'node:path';

const rawCsvPath =
  'C:\\Users\\caden\\.gemini\\antigravity\\brain\\67ab0844-e1e5-4be4-9589-9ebd5f897fcf\\.system_generated\\steps\\214\\content.md';
const content = fs.readFileSync(rawCsvPath, 'utf8');

const lines = content.split(/\r?\n/).filter((l) => l.includes(','));
const headerIndex = lines.findIndex((l) =>
  l.includes('Name,Fee,Domain Rank,Link,Category'),
);
const dataLines = lines.slice(headerIndex + 1);

// Exclude corporate review sites, business directories, and broad enterprise portals
const EXCLUDE_NAMES = [
  'Trustpilot',
  'Gartner',
  'Finances Online',
  'Clutch',
  'Source Forge',
  'Proven Expert',
  'F6S',
  'Get App',
  'Software World',
  'Featured Customers',
  'SelectHub',
  'Crozdesk',
  'Software Suggest',
  'Good Firms',
  'BBB',
  'Yelp',
  'TripAdvisor',
  'YellowPages',
  'Bing Places',
  'Nextdoor',
  'Angie',
  'Better Business',
  'Unsplash',
  'Behance',
  'Google Business',
];

// Target tool discovery, AI directory, micro launch, indie & backlink submission sites
const TOOL_BACKLINK_KEYWORDS = [
  'tool',
  'launch',
  'ai',
  'saas',
  'startup',
  'alternative',
  'hunt',
  'dev',
  'indie',
  'base',
  'stash',
  'buffer',
  'next',
  'pitch',
  'stack',
  'wall',
  'list',
  'rack',
  'top',
  'find',
];

const filtered = [];

dataLines.forEach((line) => {
  const parts = line.split(',');
  if (parts.length < 5) return;

  const name = parts[0].trim();
  const fee = parts[1].trim();
  const rank = parseInt(parts[2].trim(), 10) || 0;
  const url = parts[3].trim();
  const category = parts[4].trim();

  // 1. Must be Free
  if (fee !== 'Free') return;

  // 2. Exclude corporate review portals
  if (EXCLUDE_NAMES.some((ex) => name.toLowerCase().includes(ex.toLowerCase())))
    return;

  // 3. Must match tool/launch/backlink directory keywords or profile category
  const textMatch = `${name} ${category}`.toLowerCase();
  const isToolOrLaunch = TOOL_BACKLINK_KEYWORDS.some((kw) =>
    textMatch.includes(kw),
  );

  if (!isToolOrLaunch) return;
  if (!url.startsWith('http')) return;

  filtered.push({
    name,
    fee,
    domainRank: rank,
    url,
    category,
  });
});

// Sort by Domain Rank descending
filtered.sort((a, b) => b.domainRank - a.domainRank);

console.log(
  `Filtered down to ${filtered.length} TOOL / LAUNCH / BACKLINK target sites!`,
);

const jsonPath = path.resolve('data/directory-submission-info.json');
const existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

existingData.directories = filtered.map((item) => ({
  name: item.name,
  url: item.url,
  category: item.category,
  domainRank: item.domainRank,
}));

fs.writeFileSync(jsonPath, JSON.stringify(existingData, null, 2), 'utf8');
console.log(
  `Successfully updated ${jsonPath} with ${filtered.length} tool & launch directories!`,
);
