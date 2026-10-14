import { describe, expect, it } from 'vitest';
import { selectNewCandidates } from './run';
import type { IngestCandidate } from './sources';

const c = (over: Partial<IngestCandidate>): IngestCandidate => ({
  name: 'Weather MCP',
  url: 'https://github.com/a/weather-mcp',
  description: 'Forecasts',
  source: 'official-registry',
  ...over,
});

describe('selectNewCandidates', () => {
  it('drops anything already on file by URL key or package key', () => {
    const existing = {
      urlKeys: new Set(['github.com/a/weather-mcp']),
      packageKeys: new Set(['npm:@a/maps']),
    };
    const out = selectNewCandidates(
      [
        c({ url: 'https://www.github.com/A/Weather-MCP.git' }),
        c({
          name: 'Maps',
          url: 'https://github.com/other/maps',
          installCommand: 'npx',
          installPackage: '@a/maps',
        }),
        c({ name: 'Tides', url: 'https://github.com/a/tides' }),
      ],
      existing,
    );
    expect(out.alreadyListed).toBe(2);
    expect(out.fresh.map((x) => x.name)).toEqual(['Tides']);
  });

  it('keeps the first of two sources listing the same repo', () => {
    const out = selectNewCandidates(
      [
        c({ source: 'official-registry' }),
        c({ source: 'awesome-list', url: 'https://github.com/a/weather-mcp/' }),
      ],
      { urlKeys: new Set(), packageKeys: new Set() },
    );
    expect(out.fresh).toHaveLength(1);
    expect(out.fresh[0].source).toBe('official-registry');
    expect(out.alreadyListed).toBe(1);
  });

  it('counts floor rejections and unsafe URLs by reason', () => {
    const out = selectNewCandidates(
      [
        c({ url: 'http://localhost:3000' }),
        c({ url: 'https://github.com/a/x', description: '' }),
        c({ url: 'https://github.com/a/demo-mcp' }),
      ],
      { urlKeys: new Set(), packageKeys: new Set() },
    );
    expect(out.fresh).toEqual([]);
    expect(out.belowFloor).toEqual({
      'unsafe url': 1,
      'no description': 1,
      'scaffold or demo name': 1,
    });
  });
});
