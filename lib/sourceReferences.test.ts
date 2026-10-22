import { describe, expect, it } from 'vitest';
import { stripFaqSourceReferences, stripSourceReferences } from './aiContent';

describe('stripSourceReferences', () => {
  it('drops sentences that talk about the source material', () => {
    const doc = `## Setup and configuration

Set GRAFANA_URL and the token. The repository also documents Docker and Helm, though the supplied quick-start excerpt does not provide their individual commands. Grafana 9.0 or later is required.`;
    const out = stripSourceReferences(doc);
    expect(out).toContain('Set GRAFANA_URL and the token.');
    expect(out).toContain('Grafana 9.0 or later is required.');
    expect(out).not.toMatch(/excerpt/i);
  });

  it('catches README and provided-material phrasing', () => {
    expect(
      stripSourceReferences(
        'Queries the API. The README does not describe rate limits. Supplied material does not specify pricing.',
      ),
    ).toBe('Queries the API.');
    expect(
      stripSourceReferences(
        'Works offline. The provided material states that x402 needs no account.',
      ),
    ).toBe('Works offline.');
  });

  it('keeps legitimate uses of "supplied" and "provided"', () => {
    const text =
      'Calls a contract when supplied with an ABI. Results are provided by the page.';
    expect(stripSourceReferences(text)).toBe(text);
  });

  it('removes headings whose section becomes empty', () => {
    const doc = `## What Acme does

Files tickets.

## Limitations and notes

The README does not document rate limits.`;
    expect(stripSourceReferences(doc)).toBe(
      '## What Acme does\n\nFiles tickets.',
    );
  });

  it('leaves code fences and list markers intact', () => {
    const doc =
      '- Runs locally. The README states it needs Node 20.\n\n```\nprovided material inside code\n```';
    expect(stripSourceReferences(doc)).toBe(
      '- Runs locally.\n\n```\nprovided material inside code\n```',
    );
  });

  it('passes null through', () => {
    expect(stripSourceReferences(null)).toBeNull();
  });
});

describe('stripFaqSourceReferences', () => {
  it('drops answers that were only source commentary', () => {
    expect(
      stripFaqSourceReferences([
        {
          q: 'Does it work with Cursor?',
          a: 'The README does not mention Cursor.',
        },
        { q: 'Is it free?', a: 'Yes. It is MIT licensed.' },
      ]),
    ).toEqual([{ q: 'Is it free?', a: 'Yes. It is MIT licensed.' }]);
  });
});
