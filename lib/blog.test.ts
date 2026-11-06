import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { postTopics, stripFaqSection, toBlogPost } from './blog';

/** A post exactly as LopeBase's GitHub "markdown" format writes it. */
const LOPEBASE_FILE = `---
title: "Acme Tool Schemas: A Checklist"
description: "Check every Acme MCP tool schema before you ship it to clients."
date: 2026-11-05
updated: 2026-11-20
slug: "acme-tool-schemas-checklist"
tags: ["Building Servers", "tool schemas", "json schema"]
image: "https://img.brainscanner.dev/acme/schema.png"
image_alt: "Diagram of a tool schema review"
faq: [{"q":"Do schemas need descriptions?","a":"Yes, every field."}]
---

Intro paragraph.

## Write the schema first

Body text.

## FAQ

### Do schemas need descriptions?

Yes, every field.
`;

function parse(raw: string, file = 'acme-tool-schemas-checklist.md') {
  const { data, content } = matter(raw);
  return toBlogPost({ file, data, content });
}

describe('toBlogPost (LopeBase markdown format)', () => {
  it('reads a LopeBase post: bare YAML dates, topics, keywords, image, FAQ', () => {
    const post = parse(LOPEBASE_FILE);
    expect(post.slug).toBe('acme-tool-schemas-checklist');
    expect(post.date).toBe('2026-11-05');
    expect(post.updated).toBe('2026-11-20');
    expect(post.excerpt).toMatch(/^Check every Acme/);
    expect(post.tags).toEqual(['Building Servers']);
    expect(post.keywords).toEqual(['tool schemas', 'json schema']);
    expect(post.image).toEqual({
      url: 'https://img.brainscanner.dev/acme/schema.png',
      alt: 'Diagram of a tool schema review',
    });
    expect(post.faq).toEqual([
      { q: 'Do schemas need descriptions?', a: 'Yes, every field.' },
    ]);
    // FAQ renders from front matter, so the body copy is dropped.
    expect(post.content).not.toMatch(/## FAQ/);
    expect(post.content).toMatch(/## Write the schema first/);
  });

  it('reads the same post from the Worker manifest (dates as JSON strings)', () => {
    const { data, content } = matter(LOPEBASE_FILE);
    const fromJson = JSON.parse(JSON.stringify({ data, content }));
    const post = toBlogPost({
      file: 'acme-tool-schemas-checklist.md',
      ...fromJson,
    });
    expect(post.date).toBe('2026-11-05');
    expect(post.updated).toBe('2026-11-20');
  });

  it('defaults updated to date and omits a non-https image', () => {
    const post = parse(
      '---\ntitle: "T"\ndescription: "D"\ndate: 2026-11-05\nimage: "http://x.test/a.png"\n---\nBody',
      'acme.md',
    );
    expect(post.updated).toBe('2026-11-05');
    expect(post.image).toBeUndefined();
    expect(post.tags).toEqual(['Using MCP']);
  });

  it('rejects files missing required front matter or a slug filename', () => {
    expect(() => parse('---\ntitle: "T"\ndate: 2026-11-05\n---\nx')).toThrow(
      /description/,
    );
    expect(() =>
      parse(
        '---\ntitle: "T"\ndescription: "D"\ndate: 2026-11-05\n---\nx',
        'Acme Post.md',
      ),
    ).toThrow(/kebab-case/);
  });
});

describe('postTopics', () => {
  it('keeps exact BLOG_TOPICS (case-insensitive), at most two, in order', () => {
    expect(
      postTopics(['security', 'Deployment', 'Using MCP', 'oauth'], 'x'),
    ).toEqual(['Security', 'Deployment']);
  });

  it('infers a topic from keyword cues when no tag is a topic', () => {
    expect(postTopics(['mcp oauth', 'tokens'], 'Acme auth')).toEqual([
      'Security',
    ]);
    expect(postTopics(['docker'], 'Run Acme in a container')).toEqual([
      'Deployment',
    ]);
    expect(postTopics([], 'Acme for everyday chat')).toEqual(['Using MCP']);
  });
});

describe('stripFaqSection', () => {
  it('drops a middle FAQ section and keeps the sections after it', () => {
    const body = 'Intro\n\n## FAQ\n\n### Q?\n\nA.\n\n## Next steps\n\nMore.';
    expect(stripFaqSection(body)).toBe('Intro\n\n## Next steps\n\nMore.');
  });

  it('leaves a body with no FAQ section alone', () => {
    expect(stripFaqSection('Intro\n\n## Steps\n\nDo it.')).toBe(
      'Intro\n\n## Steps\n\nDo it.',
    );
  });
});
