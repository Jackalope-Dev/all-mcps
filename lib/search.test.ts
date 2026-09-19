import {
  buildAiSearchText,
  buildSearchPrefilter,
  compileQuery,
  rankServers,
  scoreServerMatch,
} from './search';

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
  {
    name: 'server-postgres',
    description: 'Read and write PostgreSQL databases.',
    category: 'Databases',
  },
  {
    name: 'pdf-reader',
    description: 'A generic file utility.',
    category: 'Developer Tools',
    extraText:
      'Extract text and tables from PDF documents so an agent can answer questions over your files.',
  },
  {
    name: 'brave-search',
    description: 'Web search via the Brave API.',
    category: 'Search & Data Extraction',
  },
  {
    name: 'random-thing',
    description: 'Totally unrelated widget.',
    category: 'Other',
  },
];

// 1. Synonym: querying "postgres" should surface the PostgreSQL server even though
//    the description says "PostgreSQL", not "postgres".
{
  const out = rankServers(rows, 'postgres');
  assert(out.length >= 1, 'postgres query returns results');
  assert(
    out[0].name === 'server-postgres',
    'postgres ranks the Postgres server first',
  );
}

// 2. extraText intent matching: "pdf" appears only in the AI text, not name/description.
{
  const out = rankServers(rows, 'pdf');
  assert(
    out.some((r) => r.name === 'pdf-reader'),
    'pdf query matches via extraText/AI content',
  );
}

// 3. Intent phrase via synonyms + extraText: "extract documents".
{
  const out = rankServers(rows, 'extract documents');
  assert(
    out.some((r) => r.name === 'pdf-reader'),
    'intent query matches the PDF server through AI text',
  );
}

// 4. OR-fallback: a multi-word query where no single row matches ALL terms should
//    still return the closest partial match rather than nothing.
{
  const terms = compileQuery('postgres unicorn');
  // Strict AND: "unicorn" matches nothing, so every row scores 0.
  const strict = rows.map((r) =>
    scoreServerMatch(r, terms, 'postgres unicorn', true),
  );
  assert(
    strict.every((s) => s === 0),
    'strict AND finds no match for postgres+unicorn',
  );
  // rankServers should fall back to OR and still surface the Postgres row.
  const out = rankServers(rows, 'postgres unicorn');
  assert(
    out.length >= 1 && out[0].name === 'server-postgres',
    'OR-fallback returns the closest match',
  );
}

// 5. Unrelated query returns nothing (no false positives from the fallback).
{
  const out = rankServers(rows, 'zzzznope');
  assert(out.length === 0, 'nonsense single-term query returns no results');
}

// 6. buildAiSearchText joins + bounds correctly.
{
  const t = buildAiSearchText({
    aiSummary: 'One line.',
    aiUseCases: ['Do X', 'Do Y'],
    aiFeatures: ['Fast'],
  });
  assert(
    !!t && t.includes('Do X') && t.includes('Fast'),
    'buildAiSearchText joins fields',
  );
  const capped = buildAiSearchText({ aiSummary: 'x'.repeat(1000) }, 100);
  assert(!!capped && capped.length === 100, 'buildAiSearchText caps length');
  assert(
    buildAiSearchText({}) === null,
    'buildAiSearchText returns null when empty',
  );
}

// 6b. FAQ Q&A pairs feed the search blob (questions often match user intent).
{
  const withFaq = buildAiSearchText({
    aiSummary: 'A database bridge.',
    aiFaq: [
      {
        q: 'How do I connect with a connection string?',
        a: 'Set DATABASE_URL to your Postgres DSN.',
      },
      { q: 'Does it support read-only mode?', a: 'Yes, pass READ_ONLY=true.' },
    ],
  });
  assert(
    !!withFaq && withFaq.includes('connection string'),
    'buildAiSearchText includes FAQ questions',
  );
  assert(
    !!withFaq && withFaq.includes('READ_ONLY'),
    'buildAiSearchText includes FAQ answers',
  );
  // FAQ-only listings still produce a blob (no summary/overview required).
  const faqOnly = buildAiSearchText({
    aiFaq: [
      { q: 'Can agents write rows?', a: 'Only when write tools are enabled.' },
    ],
  });
  assert(
    !!faqOnly && faqOnly.includes('write rows'),
    'FAQ-only content still builds a search blob',
  );
}

// 7. Conversational intent queries with stopwords (e.g. "find latest btc prices", "check transit times")
{
  const intentRows: Row[] = [
    {
      name: 'coinbase-mcp',
      description: 'Fetch cryptocurrency exchange rates and market tickers.',
      category: 'Finance',
      extraText: 'Query bitcoin btc prices and market quotes.',
    },
    {
      name: 'gtfs-transit-mcp',
      description: 'Realtime subway and bus schedule arrival data.',
      category: 'Transportation',
      extraText: 'Check transit schedules and train arrival times.',
    },
    {
      name: 'unrelated-tool',
      description: 'Random developer utility.',
      category: 'Tools',
    },
  ];

  const btcOut = rankServers(intentRows, 'find latest btc prices');
  assert(
    btcOut.length >= 1 && btcOut[0].name === 'coinbase-mcp',
    'find latest btc prices ranks Coinbase MCP first',
  );

  const transitOut = rankServers(intentRows, 'check transit times');
  assert(
    transitOut.length >= 1 && transitOut[0].name === 'gtfs-transit-mcp',
    'check transit times ranks GTFS Transit MCP first',
  );
}

// buildSearchPrefilter — the SQL LIKE plan searchActiveServers runs before JS scoring.
// It must never be *narrower* than scoreServerMatch, or D1 would drop real hits
// before the ranker ever sees them. Emulate the SQL (substring test on the
// concatenated fields) and check every strict JS hit survives it.
{
  const plan = buildSearchPrefilter('find me a postgres db');
  assert(
    JSON.stringify(plan.terms.map((g) => g[0])) ===
      JSON.stringify(['postgres', 'db']),
    'prefilter drops stopwords like the scorer does',
  );
  assert(
    plan.terms[0].includes('postgresql') && plan.terms[1].includes('database'),
    'prefilter term groups carry the synonyms that can satisfy each term',
  );
  assert(
    plan.terms.flat().every((p) => /^[a-z0-9]+$/.test(p)) &&
      plan.fuzzy.every((p) => /^[a-z0-9]+$/.test(p)),
    'every LIKE pattern is plain [a-z0-9]+ (no wildcards to escape)',
  );
  assert(
    buildSearchPrefilter('!!!').terms.length === 0,
    'all-punctuation query yields no terms',
  );
  assert(
    buildSearchPrefilter('postgre').fuzzy.includes('pos') &&
      buildSearchPrefilter('postgre').fuzzy.includes('gre'),
    'fuzzy patterns are the leading and trailing trigrams',
  );

  const rows: Row[] = [
    {
      name: 'PG Admin',
      description: 'Manage PostgreSQL clusters.',
      category: '🗄️ Databases',
    },
    {
      name: 'Coin Tracker',
      description: 'Portfolio tools.',
      category: '💰 Finance',
      toolText: 'get_bitcoin_price',
    },
    {
      name: 'Notes',
      description: 'Plain notes.',
      category: '📝 Productivity',
      extraText: 'Sync your obsidian vault',
    },
  ];
  const queries = ['postgres', 'crypto', 'obsidian notes', 'pg admin', 'db'];
  for (const q of queries) {
    const terms = compileQuery(q);
    const full = terms.map((t) => t.term).join(' ');
    const groups = buildSearchPrefilter(q).terms;
    for (const r of rows) {
      if (scoreServerMatch(r, terms, full) === 0) continue;
      const hay =
        `${r.name} ${r.category} ${r.description} ${r.toolText || ''} ${r.extraText || ''}`.toLowerCase();
      assert(
        groups.every((alts) => alts.some((a) => hay.includes(a))),
        `prefilter keeps strict hit "${r.name}" for "${q}"`,
      );
    }
  }
}

console.log('✓ all search tests passed');
