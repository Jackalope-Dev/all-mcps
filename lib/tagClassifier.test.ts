import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JevResponse } from './typesafe';

const askJev = vi.fn<() => Promise<JevResponse | null>>();
vi.mock('./typesafe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./typesafe')>()),
  askJev: (...args: unknown[]) => askJev(...(args as [])),
}));

const { candidateTags, classifyTags, runtimeTags } = await import(
  './tagClassifier'
);
const { TAG_VOCABULARY, vocabularyTags } = await import('./tagVocabulary');

const noul = (p: number) => ({ type: 'noul' as const, noul: p });

describe('TAG_VOCABULARY', () => {
  it('has unique slugs and labels', () => {
    const slugs = TAG_VOCABULARY.map((t) => t.slug);
    const labels = TAG_VOCABULARY.map((t) => t.label);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('gives every Jev-judged tag a hint, and runtime tags none', () => {
    for (const t of TAG_VOCABULARY) {
      expect(Boolean(t.hint), t.slug).toBe(t.group !== 'runtime');
    }
  });

  it('keeps slugs URL-safe', () => {
    for (const t of TAG_VOCABULARY) expect(t.slug).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('vocabularyTags', () => {
  it('keeps only vocabulary slugs, deduped, case-insensitive', () => {
    expect(
      vocabularyTags(['Slack', 'slack', 'slack-bot', 42, 'postgres']).map(
        (t) => t.slug,
      ),
    ).toEqual(['slack', 'postgres']);
    expect(vocabularyTags('not an array')).toEqual([]);
  });
});

describe('runtimeTags', () => {
  it('reads the runtime from install data', () => {
    expect(runtimeTags({ installCommand: 'npx' })).toEqual(['nodejs']);
    expect(runtimeTags({ installCommand: 'uvx' })).toEqual(['python']);
    expect(runtimeTags({ installCommand: 'docker' })).toEqual(['docker']);
    expect(runtimeTags({ installKind: 'remote' })).toEqual(['remote']);
    expect(runtimeTags({})).toEqual([]);
  });
});

describe('candidateTags', () => {
  it('matches hints in tool names split from snake_case', () => {
    const slugs = candidateTags({
      name: 'acme',
      tools: JSON.stringify([{ name: 'browser_navigate' }]),
    }).map((t) => t.slug);
    expect(slugs).toContain('browser-automation');
  });

  it('puts tags from the listing own words ahead of tool-name matches', () => {
    const slugs = candidateTags({
      name: 'mcp-grafana',
      description: 'Query Grafana dashboards.',
      tools: JSON.stringify(
        ['slack_notify', 'github_search', 'postgres_query', 'aws_list'].map(
          (name) => ({ name }),
        ),
      ),
    }).map((t) => t.slug);
    expect(slugs.indexOf('grafana')).toBeLessThan(slugs.indexOf('slack'));
    expect(slugs.indexOf('grafana')).toBeLessThan(slugs.indexOf('github'));
  });

  it('asks about nothing when there is no text', () => {
    expect(candidateTags({})).toEqual([]);
  });
});

describe('classifyTags', () => {
  beforeEach(() => askJev.mockReset());

  const slackServer = {
    name: 'slack-mcp',
    description: 'Send Slack messages and read channels.',
    installCommand: 'npx',
  };

  it('keeps confident tags, most probable first, then runtime', async () => {
    askJev.mockResolvedValue({
      model: 'm',
      answers: { slack: noul(0.97), 'social-media': noul(0.4) },
    });
    expect(await classifyTags(slackServer)).toEqual(['slack', 'nodejs']);
  });

  it('accepts a lower probability when the tag is in the listing name', async () => {
    askJev.mockResolvedValue({
      model: 'm',
      answers: { cloudflare: noul(0.67), observability: noul(0.67) },
    });
    expect(
      await classifyTags({
        name: 'cloudflare/mcp-server-cloudflare',
        description: 'Manage Workers and monitor logs.',
      }),
    ).toEqual(['cloudflare']);
  });

  it('returns null when Jev is unavailable, so callers keep existing tags', async () => {
    askJev.mockResolvedValue(null);
    expect(await classifyTags(slackServer)).toBeNull();
  });

  it('skips Jev when no tag hint matches', async () => {
    expect(await classifyTags({ name: 'zzz', installCommand: 'uvx' })).toEqual([
      'python',
    ]);
    expect(askJev).not.toHaveBeenCalled();
  });
});
