import { describe, expect, it } from 'vitest';
import { maskPaths, unmaskPaths } from './payloadPaths';

describe('maskPaths', () => {
  const samples = [
    '/path/to/venv/bin/python3',
    '{"command": "/Users/YOUR_USERNAME/.local/share/x"}',
    '~/.config/~s/~~/a',
    'https://example.com/a?b=~c',
    'no slashes ~server',
    '',
  ];

  it('round-trips any string exactly', () => {
    for (const s of samples) expect(unmaskPaths(maskPaths(s))).toBe(s);
  });

  it('leaves no slash in the serialized value', () => {
    const value = {
      command: '/path/to/venv/bin/python3',
      args: ['/opt/server.py', '--cache', '/absolute/path/to/cache'],
      steps: [{ label: null, command: '/usr/local/bin/x' }],
      count: 2,
    };
    const masked = maskPaths(value);
    expect(JSON.stringify(masked)).not.toContain('/');
    expect(unmaskPaths(masked)).toEqual(value);
  });
});
