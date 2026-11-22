import { describe, expect, it } from 'vitest';
import { rehypeSplitLeadingSlash } from './rehypeSplitLeadingSlash';

type Node = {
  type: string;
  tagName?: string;
  value?: string;
  children?: Node[];
};
const text = (value: string): Node => ({ type: 'text', value });

describe('rehypeSplitLeadingSlash', () => {
  it('splits text that starts with a slash, outside pre', () => {
    const tree: Node & { children: Node[] } = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'code', children: [text('/etc')] },
        text('//tmp'),
        text('see /opt'),
        { type: 'element', tagName: 'pre', children: [text('/srv')] },
      ],
    };
    rehypeSplitLeadingSlash()(tree);
    expect(tree.children[0].children).toEqual([text('/'), text('etc')]);
    expect(tree.children.slice(1, 4)).toEqual([
      text('//'),
      text('tmp'),
      text('see /opt'),
    ]);
    expect(tree.children[4].children).toEqual([text('/srv')]);
  });
});
