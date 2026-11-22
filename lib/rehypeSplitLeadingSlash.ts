type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  children?: HastNode[];
};

/**
 * Rehype plugin: a text node that starts with a slash (`/etc`, inline code
 * like `/path/to/venv/bin/python3`, a table cell holding `/opt`) is split
 * into "/" and the rest. Server-rendered markdown reaches the RSC payload as
 * one string per text node, and Googlebot crawls a standalone "/..." string
 * there as a URL on our domain. Two adjacent text nodes render the same text.
 * `pre` blocks are left whole: their text becomes the copy button's code.
 */
export function rehypeSplitLeadingSlash() {
  return (tree: HastNode) => {
    split(tree);
  };
}

function split(node: HastNode): void {
  if (!node.children || node.tagName === 'pre') return;
  const next: HastNode[] = [];
  for (const child of node.children) {
    const m =
      child.type === 'text' ? /^(\s*\/+)(.+)$/s.exec(child.value ?? '') : null;
    if (m) {
      next.push({ type: 'text', value: m[1] }, { type: 'text', value: m[2] });
    } else {
      split(child);
      next.push(child);
    }
  }
  node.children = next;
}
