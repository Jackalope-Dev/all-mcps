import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from './jsonLd';

describe('serializeJsonLd', () => {
  it('leaves nothing that can close the script element', () => {
    const out = serializeJsonLd({
      description: '</script><script>alert(1)</script>',
    });
    expect(out).not.toMatch(/<|>/);
    expect(out.toLowerCase()).not.toContain('</script');
  });

  it('round-trips to the original value', () => {
    const data = {
      name: 'A & B <tools>',
      text: 'line\u2028sep\u2029end',
      nested: [{ q: '"quoted"', n: 3 }],
    };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});
