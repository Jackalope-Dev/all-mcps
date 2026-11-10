import { describe, expect, it, vi } from 'vitest';
import { withD1Retry } from './d1Retry';

describe('withD1Retry', () => {
  it('rides out one transient D1 error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('D1_ERROR: D1 DB is overloaded.'))
      .mockResolvedValueOnce([{ id: 'a' }]);
    await expect(withD1Retry('t', run, { delayMs: 0 })).resolves.toEqual([
      { id: 'a' },
    ]);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('throws the second failure for the caller to degrade', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const run = vi
      .fn()
      .mockRejectedValue(new Error('Network connection lost.'));
    await expect(withD1Retry('t', run, { delayMs: 0 })).rejects.toThrow(
      'Network connection lost.',
    );
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not retry a success', async () => {
    const run = vi.fn().mockResolvedValue(1);
    await withD1Retry('t', run, { delayMs: 0 });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
