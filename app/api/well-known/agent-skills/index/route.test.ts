import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('/.well-known/agent-skills/index.json', () => {
  it('publishes the real sha256 of every SKILL.md it lists', async () => {
    const index = (await (await GET()).json()) as {
      skills: { url: string; sha256: string }[];
    };
    expect(index.skills.length).toBeGreaterThan(0);

    for (const skill of index.skills) {
      const path = new URL(skill.url).pathname;
      // Served bytes are LF (.gitattributes text=auto); normalize a CRLF checkout.
      const body = readFileSync(
        join(process.cwd(), 'public', path),
        'utf8',
      ).replace(/\r\n/g, '\n');
      const digest = createHash('sha256').update(body).digest('hex');
      expect(skill.sha256, `${path} changed; update its sha256`).toBe(digest);
    }
  });
});
