import {
  formatBlogPostMarkdown,
  formatBlogIndexMarkdown,
  formatCategoryMarkdown,
  formatCategoryIndexMarkdown,
} from './agentMarkdown';
import type { BlogPost } from './blog';
import type { Server } from './servers';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function fakePost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    slug: 'demo-post',
    title: 'Demo Post Title',
    date: '2026-08-01',
    excerpt: 'A one-sentence summary of the demo post.',
    tags: ['MCP', 'Agents'],
    faq: [{ q: 'Is this a demo?', a: 'Yes.' }],
    readingTime: 4,
    content: 'This is the **full markdown body** of the demo post.',
    ...overrides,
  };
}

function fakeServer(overrides: Partial<Server> = {}): Server {
  return {
    id: 'demo-server',
    name: 'Demo Server',
    url: 'https://github.com/demo/demo-server',
    description: 'A demo MCP server for testing.',
    category: '💻 Developer Tools',
    isOfficial: false,
    status: 'active',
    createdAt: '2026-01-01',
    ...overrides,
  };
}

console.log('Testing lib/agentMarkdown...');

// formatBlogPostMarkdown
const postMd = formatBlogPostMarkdown(fakePost());
assert(postMd.includes('# Demo Post Title'), 'Should render title as H1');
assert(postMd.includes('This is the **full markdown body**'), 'Should include the raw post content, not a summary');
assert(postMd.includes('**Tags:** MCP, Agents'), 'Should list tags');
assert(postMd.includes('## Frequently Asked Questions'), 'Should render FAQ section when present');
assert(postMd.includes('Is this a demo?'), 'Should include FAQ question text');

const postMdNoFaq = formatBlogPostMarkdown(fakePost({ faq: [] }));
assert(!postMdNoFaq.includes('Frequently Asked Questions'), 'Should omit FAQ section when there is none');

// formatBlogIndexMarkdown
const indexMd = formatBlogIndexMarkdown([fakePost(), fakePost({ slug: 'second-post', title: 'Second Post' })]);
assert(indexMd.includes('[Demo Post Title](https://allmcps.com/blog/demo-post)'), 'Should link each post');
assert(indexMd.includes('[Second Post](https://allmcps.com/blog/second-post)'), 'Should list every post given');

// formatCategoryMarkdown
const catMd = formatCategoryMarkdown('💻 Developer Tools', [
  fakeServer({ id: 'a', name: 'Server A', githubStars: 500 }),
  fakeServer({ id: 'b', name: 'Server B', copies: 10 }),
]);
assert(catMd.includes('# Developer Tools MCP Servers'), 'Should render category label as H1');
assert(catMd.includes('[Server A](https://allmcps.com/mcp/a)'), 'Should list every server in the category');
assert(catMd.includes('[Server B](https://allmcps.com/mcp/b)'), 'Should list every server in the category');
assert(catMd.includes('**Listed servers:** 2'), 'Should report the listing count');

const emptyCatMd = formatCategoryMarkdown('🧬 Biology & Bioinformatics', []);
assert(emptyCatMd.includes('No servers are currently listed'), 'Should handle an empty category without crashing');

// formatCategoryIndexMarkdown
const catIndexMd = formatCategoryIndexMarkdown([
  { category: '💻 Developer Tools', count: 42 },
  { category: '🗄️ Databases', count: 7 },
]);
assert(catIndexMd.includes('[💻 Developer Tools](https://allmcps.com/categories/developer-tools) — 42 servers'), 'Should link each category with its count');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
