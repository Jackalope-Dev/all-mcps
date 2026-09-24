import { describe, expect, it } from 'vitest';
import {
  type CorpusEntry,
  codeCorpus,
  judgeTopic,
  rankSimilar,
} from './corpus';
import { clampDraft } from './pipeline';
import { BLOG_SEEDS } from './seeds';
import {
  cosineSimilarity,
  keywordOverlap,
  normalizeKeyword,
  shingleContainment,
  shingles,
  slugify,
} from './similarity';
import {
  type DraftFields,
  extractInternalLinks,
  stripUnknownInternalLinks,
  validateDraft,
} from './validate';

describe('keyword similarity', () => {
  it('treats reworded head terms as the same intent', () => {
    expect(
      keywordOverlap('best postgres mcp servers', 'postgres mcp server'),
    ).toBe(1);
    expect(
      keywordOverlap(
        'Best PostgreSQL MCP Servers',
        'best postgresql mcp server',
      ),
    ).toBe(1);
  });

  it('keeps distinct topics apart', () => {
    expect(
      keywordOverlap('mcp prompt injection', 'mcp oauth authorization'),
    ).toBe(0);
  });

  it('ignores empty token sets', () => {
    expect(keywordOverlap('mcp server guide', 'best mcp servers')).toBe(0);
  });

  it('normalizes keywords for the unique queue key', () => {
    expect(normalizeKeyword('  MCP  vs. Function-Calling! ')).toBe(
      'mcp vs. function calling',
    );
  });
});

describe('vector and shingle similarity', () => {
  it('computes cosine similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
  });

  it('measures copied passages by containment', () => {
    const base =
      'the quick brown fox jumps over the lazy dog and then runs far away into the forest at night';
    const copied = shingles(`${base} with a brand new ending sentence here`);
    expect(shingleContainment(copied, shingles(base))).toBeGreaterThan(0.4);
    const fresh = shingles(
      'entirely different words describing an unrelated protocol feature for servers and clients today',
    );
    expect(shingleContainment(fresh, shingles(base))).toBe(0);
  });

  it('ignores code blocks when shingling', () => {
    expect(shingles('```\na b c d e f g h i j\n```').size).toBe(0);
  });
});

describe('topic cannibalization', () => {
  const corpus: CorpusEntry[] = [
    {
      url: '/best/postgres',
      kind: 'best',
      title: 'Best PostgreSQL MCP Servers',
      primaryKeyword: 'best postgresql mcp server',
      embedding: [1, 0, 0],
    },
    {
      url: '/mcp-transports',
      kind: 'guide',
      title: 'MCP Transports Explained',
      primaryKeyword: 'mcp transports stdio streamable http',
      embedding: [0, 1, 0],
    },
  ];

  it('blocks a topic that targets a hub head term', () => {
    const verdict = judgeTopic(
      rankSimilar(corpus, null, 'postgresql mcp servers'),
    );
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.conflict.url).toBe('/best/postgres');
  });

  it('blocks a semantically identical topic', () => {
    const verdict = judgeTopic(
      rankSimilar(corpus, [0, 0.99, 0.05], 'choosing a transport'),
    );
    expect(verdict.ok).toBe(false);
  });

  it('allows a distinct topic and reports close neighbours', () => {
    const verdict = judgeTopic(
      rankSimilar(corpus, [0, 0.85, 0.5], 'streamable http session ids'),
    );
    expect(verdict.ok).toBe(true);
    if (verdict.ok)
      expect(verdict.neighbours.map((n) => n.url)).toContain('/mcp-transports');
  });

  it('no seed collides with a code-owned page on keywords', () => {
    const docs = codeCorpus().filter((d) => d.kind !== 'blog');
    const entries = docs.map((d) => ({ ...d, embedding: null }));
    for (const seed of BLOG_SEEDS) {
      const verdict = judgeTopic(rankSimilar(entries, null, seed.keyword));
      expect(verdict.ok, `${seed.keyword}`).toBe(true);
    }
  });

  it('seed keywords are unique after normalization', () => {
    const keys = BLOG_SEEDS.map((s) => normalizeKeyword(s.keyword));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('draft validation', () => {
  const para =
    'Tool results flow back into the model context, so every server should keep them compact and well structured for the agent. ';
  const body = [
    'Handling MCP server error handling well means separating protocol errors from tool errors. ' +
      para.repeat(3),
    '## Protocol errors',
    para.repeat(12),
    'See [transports](/mcp-transports) and [security](/mcp-security).',
    '## Tool errors',
    para.repeat(12),
    'Browse [servers](/browse) or read [the guide](/build-mcp-server).',
    '## Writing recoverable messages',
    para.repeat(12),
    '## Next steps',
    para.repeat(13),
  ].join('\n\n');
  const draft: DraftFields = {
    title: 'MCP Server Error Handling: Protocol vs Tool Errors',
    slug: 'mcp-server-error-handling',
    excerpt:
      'How MCP servers should report failures: protocol errors, isError tool results, and messages a model can recover from.',
    primaryKeyword: 'mcp server error handling',
    tags: ['MCP', 'Guides'],
    faq: [
      {
        q: 'What is isError?',
        a: 'A flag on a tool result that tells the client the tool failed while the protocol call itself succeeded normally.',
      },
      {
        q: 'Should I throw?',
        a: 'Throw only for protocol-level problems; return an isError result for failures the model should see and react to.',
      },
      {
        q: 'What should messages say?',
        a: 'State what failed, why, and what the model can do next, such as retrying with a narrower query or other input.',
      },
    ],
    content: body,
  };
  const known = new Set([
    '/mcp-transports',
    '/mcp-security',
    '/browse',
    '/build-mcp-server',
  ]);

  it('passes a well-formed draft', () => {
    const res = validateDraft(draft, (p) => known.has(p));
    expect(res.issues).toEqual([]);
    expect(res.internalLinks).toHaveLength(4);
  });

  it('flags broken internal links, styled headings, thin bodies and H1s', () => {
    const res = validateDraft(
      {
        ...draft,
        content: `# Title\n\n## **Bold** heading\n\nShort [x](/mcp/made-up) text.`,
      },
      (p) => known.has(p),
    );
    const joined = res.issues.join('\n');
    expect(joined).toMatch(/do not exist.*\/mcp\/made-up/);
    expect(joined).toMatch(/plain text/);
    expect(joined).toMatch(/level-1/);
    expect(joined).toMatch(/words/);
  });

  it('strips unknown internal links but keeps anchor text', () => {
    const { content, removed } = stripUnknownInternalLinks(
      'See [a](/browse) and [b](https://allmcps.com/nope) and [c](https://example.com).',
      (p) => known.has(p),
    );
    expect(content).toBe(
      'See [a](/browse) and b and [c](https://example.com).',
    );
    expect(removed).toEqual(['/nope']);
  });

  it('extracts absolute allmcps links as paths', () => {
    expect(
      extractInternalLinks('[x](https://allmcps.com/best/postgres/#top)'),
    ).toEqual(['/best/postgres']);
  });
});

describe('clampDraft', () => {
  it('coerces writer output and derives a slug', () => {
    const d = clampDraft({
      title: 'MCP vs Function Calling: What Changes',
      content: 'x '.repeat(400),
      tags: ['MCP', 3, ''],
      faq: [{ q: 'Q?', a: 'A.' }, { q: '' }],
    });
    expect(d?.slug).toBe('mcp-vs-function-calling-what-changes');
    expect(d?.tags).toEqual(['MCP']);
    expect(d?.faq).toEqual([{ q: 'Q?', a: 'A.' }]);
  });

  it('rejects empty output', () => {
    expect(clampDraft({ title: 'x', content: 'short' })).toBeNull();
  });

  it('slugify caps length at a word boundary', () => {
    expect(
      slugify(`${'a'.repeat(30)} ${'b'.repeat(30)} ${'c'.repeat(30)}`).length,
    ).toBeLessThanOrEqual(70);
  });
});
