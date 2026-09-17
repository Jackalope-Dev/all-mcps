import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formatZodError } from './zodError';

const schema = z.object({
  reason: z.enum(['broken_install', 'other']),
  details: z.string().max(10).optional(),
  nested: z.object({ url: z.string().url() }).optional(),
});

function errorFor(input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('expected parse to fail');
  return result.error;
}

describe('formatZodError', () => {
  it('never produces the "[object Object]" a raw issues array stringifies to', () => {
    const message = formatZodError(errorFor({ reason: 'nope' }));
    expect(message).not.toContain('[object Object]');
    expect(message.length).toBeGreaterThan(0);
  });

  it('names the offending field', () => {
    expect(
      formatZodError(errorFor({ reason: 'other', details: 'x'.repeat(50) })),
    ).toMatch(/^details: /);
  });

  it('joins nested paths with dots', () => {
    expect(
      formatZodError(
        errorFor({ reason: 'other', nested: { url: 'not-a-url' } }),
      ),
    ).toMatch(/^nested\.url: /);
  });

  it('caps at three issues and counts the remainder', () => {
    const wide = z.object({
      a: z.string(),
      b: z.string(),
      c: z.string(),
      d: z.string(),
      e: z.string(),
    });
    const result = wide.safeParse({});
    if (result.success) throw new Error('expected parse to fail');
    const message = formatZodError(result.error);
    expect(message.split('; ')).toHaveLength(3);
    expect(message).toContain('(and 2 more)');
  });

  it('falls back to a generic sentence when there are no issues', () => {
    expect(formatZodError({ issues: [] } as unknown as z.ZodError)).toBe(
      'Invalid request.',
    );
  });
});
