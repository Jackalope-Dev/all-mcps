import { describe, expect, it } from 'vitest';
import { redactEmails } from './sequenzy';

describe('redactEmails', () => {
  it('removes every email address from a Sequenzy error body', () => {
    const body =
      '{"error":"Invalid email","email":"Jane.Doe+mcp@example.co.uk","detail":"bob@x.io is blocked"}';
    const out = redactEmails(body);
    expect(out).not.toMatch(/@/);
    expect(out).toContain('"error":"Invalid email"');
  });

  it('leaves bodies without emails untouched', () => {
    const body = '{"error":"lists[0] not found"}';
    expect(redactEmails(body)).toBe(body);
  });
});
