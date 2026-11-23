import { describe, expect, it } from 'vitest';
import { starsLookInflated } from './repoStars';

const now = new Date('2026-11-23T00:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe('starsLookInflated', () => {
  it('flags a young repo with an impossible sustained pace', () => {
    // ~2,100 stars a day for seven months.
    expect(starsLookInflated(475_000, daysAgo(223), now)).toBe(true);
  });

  it('accepts big, old projects and real launch spikes', () => {
    expect(starsLookInflated(150_000, daysAgo(2_500), now)).toBe(false);
    // A viral first month is not judged yet.
    expect(starsLookInflated(40_000, daysAgo(25), now)).toBe(false);
    expect(starsLookInflated(60_000, daysAgo(200), now)).toBe(false);
  });

  it('does not judge small counts or unknown ages', () => {
    expect(starsLookInflated(9_000, daysAgo(2), now)).toBe(false);
    expect(starsLookInflated(475_000, null, now)).toBe(false);
    expect(starsLookInflated(null, daysAgo(10), now)).toBe(false);
  });
});
