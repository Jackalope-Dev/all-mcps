import { rankServers, scoreServerMatch, compileQuery, buildAiSearchText } from './search';

// Basic assertions runner for node execution (matches lib/twitter.test.ts style).
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

type Row = {
  name: string;
  description: string;
  category: string;
  toolText?: string | null;
  extraText?: string | null;
  upvotes?: number;
};

const rows: Row[] = [
  { name: 'server-postgres', description: 'Read and write PostgreSQL databases.', category: 'Databases' },
  { name: 'pdf-reader', description: 'A generic file utility.', category: 'Developer Tools', extraText: 'Extract text and tables from PDF documents so an agent can answer questions over your files.' },
  { name: 'brave-search', description: 'Web search via the Brave API.', category: 'Search & Data Extraction' },
  { name: 'random-thing', description: 'Totally unrelated widget.', category: 'Other' },
];

// 1. Synonym: querying "postgres" should surface the PostgreSQL server even though
//    the description says "PostgreSQL", not "postgres".
{
  const out = rankServers(rows, 'postgres');
  assert(out.length >= 1, 'postgres query returns results');
  assert(out[0].name === 'server-postgres', 'postgres ranks the Postgres server first');
}

// 2. extraText intent matching: "pdf" appears only in the AI text, not name/description.
{
  const out = rankServers(rows, 'pdf');
  assert(out.some((r) => r.name === 'pdf-reader'), 'pdf query matches via extraText/AI content');
}

// 3. Intent phrase via synonyms + extraText: "extract documents".
{
  const out = rankServers(rows, 'extract documents');
  assert(out.some((r) => r.name === 'pdf-reader'), 'intent query matches the PDF server through AI text');
}

// 4. OR-fallback: a multi-word query where no single row matches ALL terms should
//    still return the closest partial match rather than nothing.
{
  const terms = compileQuery('postgres unicorn');
  // Strict AND: "unicorn" matches nothing, so every row scores 0.
  const strict = rows.map((r) => scoreServerMatch(r, terms, 'postgres unicorn', true));
  assert(strict.every((s) => s === 0), 'strict AND finds no match for postgres+unicorn');
  // rankServers should fall back to OR and still surface the Postgres row.
  const out = rankServers(rows, 'postgres unicorn');
  assert(out.length >= 1 && out[0].name === 'server-postgres', 'OR-fallback returns the closest match');
}

// 5. Unrelated query returns nothing (no false positives from the fallback).
{
  const out = rankServers(rows, 'zzzznope');
  assert(out.length === 0, 'nonsense single-term query returns no results');
}

// 6. buildAiSearchText joins + bounds correctly.
{
  const t = buildAiSearchText({ aiSummary: 'One line.', aiUseCases: ['Do X', 'Do Y'], aiFeatures: ['Fast'] });
  assert(!!t && t.includes('Do X') && t.includes('Fast'), 'buildAiSearchText joins fields');
  const capped = buildAiSearchText({ aiSummary: 'x'.repeat(1000) }, 100);
  assert(!!capped && capped.length === 100, 'buildAiSearchText caps length');
  assert(buildAiSearchText({}) === null, 'buildAiSearchText returns null when empty');
}

// 7. Conversational intent queries with stopwords (e.g. "find latest btc prices", "check transit times")
{
  const intentRows: Row[] = [
    { name: 'coinbase-mcp', description: 'Fetch cryptocurrency exchange rates and market tickers.', category: 'Finance', extraText: 'Query bitcoin btc prices and market quotes.' },
    { name: 'gtfs-transit-mcp', description: 'Realtime subway and bus schedule arrival data.', category: 'Transportation', extraText: 'Check transit schedules and train arrival times.' },
    { name: 'unrelated-tool', description: 'Random developer utility.', category: 'Tools' },
  ];

  const btcOut = rankServers(intentRows, 'find latest btc prices');
  assert(btcOut.length >= 1 && btcOut[0].name === 'coinbase-mcp', 'find latest btc prices ranks Coinbase MCP first');

  const transitOut = rankServers(intentRows, 'check transit times');
  assert(transitOut.length >= 1 && transitOut[0].name === 'gtfs-transit-mcp', 'check transit times ranks GTFS Transit MCP first');
}

console.log('✓ all search tests passed');
