import { describe, expect, it } from 'vitest';
import { truncateTitle } from './ogHelpers';

describe('truncateTitle', () => {
  // Satori fetches any emoji from a CDN at render time, so card text must not
  // carry one, nor the variation selector or joiner an emoji leaves behind.
  it('strips emoji and their selectors', () => {
    expect(truncateTitle('🗄️ Databases 🧑‍💻 🪄 tools', 75)).toBe(
      'Databases tools',
    );
  });
});
