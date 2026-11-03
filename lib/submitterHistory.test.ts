import { describe, expect, it } from 'vitest';
import { submitterDomain } from './submitterHistory';

describe('submitterDomain', () => {
  it('uses a company email domain', () => {
    expect(
      submitterDomain('hi@agentdiet.dev', 'https://github.com/x/y', null),
    ).toBe('agentdiet.dev');
  });

  it('falls back to the site or GitHub owner for a free mailbox', () => {
    expect(
      submitterDomain('a@gmail.com', 'https://github.com/Acme/tool', null),
    ).toBe('github.com/acme');
    expect(
      submitterDomain(
        'a@gmail.com',
        'https://github.com/acme/tool',
        'https://www.acme.io/docs',
      ),
    ).toBe('acme.io');
  });

  it('is null when nothing identifies a domain', () => {
    expect(submitterDomain('a@gmail.com', 'not a url', null)).toBeNull();
  });
});
