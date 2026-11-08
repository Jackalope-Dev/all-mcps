import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./typesafe', async (orig) => ({
  ...(await orig<typeof import('./typesafe')>()),
  askJev: vi.fn(),
}));

import { pickSetupSteps, stepLabel } from './setupStepsExtract';
import { askJev } from './typesafe';

const README = [
  '# Brainscanner',
  '```sh',
  'curl -fsSL https://brainscanner.dev/install.sh | sh',
  'brainscanner login',
  '```',
  'Then `claude mcp add brainscanner -- brainscanner serve`.',
  'Contributors: `npm test`',
].join('\n');

const listing = {
  name: 'Brainscanner',
  url: 'https://github.com/acme/brainscanner',
  description: 'Scans brains over MCP.',
  source: { text: README, url: 'https://github.com/acme/brainscanner' },
};

const noul = (p: number) => ({ type: 'noul' as const, noul: p });
const role = (choice: string, confidence = 0.9) => ({
  type: 'choice' as const,
  choice,
  confidence,
});

describe('pickSetupSteps', () => {
  beforeEach(() => vi.mocked(askJev).mockReset());

  it('keeps the commands Jev calls setup steps, verbatim and in order', async () => {
    vi.mocked(askJev).mockResolvedValue({
      model: 'jev',
      answers: {
        step_0: noul(0.95),
        role_0: role('install'),
        step_1: noul(0.9),
        role_1: role('sign_in'),
        step_2: noul(0.92),
        role_2: role('connect'),
        step_3: noul(0.1),
        role_3: role('verify'),
      },
    });
    expect(await pickSetupSteps(listing)).toEqual({
      status: 'ok',
      steps: [
        {
          label: 'Install',
          command: 'curl -fsSL https://brainscanner.dev/install.sh | sh',
        },
        { label: 'Sign in', command: 'brainscanner login' },
        {
          label: 'Add to Claude Code',
          command: 'claude mcp add brainscanner -- brainscanner serve',
        },
      ],
    });
  });

  it('needs an install, connect or run step to publish anything', async () => {
    vi.mocked(askJev).mockResolvedValue({
      model: 'jev',
      answers: { step_1: noul(0.9), role_1: role('sign_in') },
    });
    expect(await pickSetupSteps(listing)).toEqual({ status: 'none' });
  });

  it('reports Jev being down instead of guessing', async () => {
    vi.mocked(askJev).mockResolvedValue(null);
    expect(await pickSetupSteps(listing)).toEqual({ status: 'unavailable' });
  });

  it('skips Jev when the source has no commands', async () => {
    expect(
      await pickSetupSteps({
        ...listing,
        source: { text: 'Just prose.', url: listing.url },
      }),
    ).toEqual({ status: 'none' });
    expect(askJev).not.toHaveBeenCalled();
  });
});

describe('stepLabel', () => {
  it('names the client for connect steps', () => {
    expect(stepLabel('connect', 'codex mcp add x -- y')).toBe('Add to Codex');
    expect(stepLabel('connect', 'brainscanner connect')).toBe(
      'Add to your MCP client',
    );
    expect(stepLabel(null, 'x')).toBeNull();
  });
});
