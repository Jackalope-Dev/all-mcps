import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InlineMarkdown } from './InlineMarkdown';

const html = (content: string) =>
  renderToStaticMarkup(<InlineMarkdown content={content} />);

describe('InlineMarkdown', () => {
  it('renders code, bold and italic', () => {
    expect(html('Run `npx foo` for **fast** and *safe* access')).toBe(
      'Run <code>npx foo</code> for <strong>fast</strong> and <em>safe</em> access',
    );
  });

  it('flattens links and images to their text', () => {
    expect(html('See [the docs](https://x.y) ![badge](b.svg)')).toBe(
      'See the docs badge',
    );
  });

  it('never emits description HTML', () => {
    expect(html('<script>alert(1)</script><b>hi</b> & <x')).toBe(
      'alert(1)hi &amp; &lt;x',
    );
  });

  it('strips a leading heading marker', () => {
    expect(html('## Postgres MCP')).toBe('Postgres MCP');
  });
});
