import {
  formatBlogPostMarkdown,
  formatBlogIndexMarkdown,
  formatCategoryMarkdown,
  formatCategoryIndexMarkdown,
  formatBestTopicMarkdown,
  formatBestIndexMarkdown,
  formatClientMarkdown,
  formatClientIndexMarkdown,
  formatPromptMarkdown,
  formatPromptIndexMarkdown,
  formatAlternativesMarkdown,
  formatCompareMarkdown,
} from './agentMarkdown';
import type { BlogPost } from './blog';
import type { Server } from './servers';
import type { BestTopic } from './bestTopics';
import type { McpClient } from './clients';
import type { McpWorkflow } from './prompts';

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

// formatBestTopicMarkdown / formatBestIndexMarkdown
function fakeTopic(overrides: Partial<BestTopic> = {}): BestTopic {
  return {
    slug: 'demo-topic',
    categorySlug: 'developer-tools',
    title: 'Demo Topic',
    lead: 'The best demo MCP servers.',
    faq: [{ q: 'Is this a demo topic?', a: 'Yes.' }],
    ...overrides,
  };
}

const bestMd = formatBestTopicMarkdown(fakeTopic(), [fakeServer({ id: 'a', name: 'Server A', copies: 5 })]);
assert(bestMd.includes('# Best Demo Topic MCP Servers'), 'Should render topic title as H1');
assert(bestMd.includes('[Server A](https://allmcps.com/mcp/a)'), 'Should list every server for the topic');
assert(bestMd.includes('Is this a demo topic?'), 'Should render topic FAQ');

const emptyBestMd = formatBestTopicMarkdown(fakeTopic({ faq: [] }), []);
assert(emptyBestMd.includes('No servers currently match'), 'Should handle an empty topic without crashing');
assert(!emptyBestMd.includes('Frequently Asked Questions'), 'Should omit FAQ section when there is none');

const bestIndexMd = formatBestIndexMarkdown([fakeTopic(), fakeTopic({ slug: 'second-topic', title: 'Second Topic' })]);
assert(bestIndexMd.includes('[Best Demo Topic MCP Servers](https://allmcps.com/best/demo-topic)'), 'Should link each topic');
assert(bestIndexMd.includes('[Best Second Topic MCP Servers](https://allmcps.com/best/second-topic)'), 'Should list every topic given');

// formatClientMarkdown / formatClientIndexMarkdown
function fakeClient(overrides: Partial<McpClient> = {}): McpClient {
  return {
    slug: 'demo-client',
    name: 'Demo Client',
    configFilename: 'demo_config.json',
    badgeText: 'Desktop App',
    lead: 'How to install MCP servers in Demo Client.',
    configKey: 'mcpServers',
    configLocations: [{ os: 'macOS', path: '~/demo_config.json' }],
    configExample: '{ "mcpServers": {} }',
    steps: [{ title: 'Open the config', body: 'Open the config file.' }],
    faq: [{ q: 'Where is the config?', a: 'At ~/demo_config.json.' }],
    ...overrides,
  };
}

const clientMd = formatClientMarkdown(fakeClient());
assert(clientMd.includes('# How to Install MCP Servers in Demo Client'), 'Should render client name as H1');
assert(clientMd.includes('~/demo_config.json'), 'Should list the config file location');
assert(clientMd.includes('1. **Open the config**'), 'Should number setup steps');
assert(clientMd.includes('Where is the config?'), 'Should render client FAQ');

const clientIndexMd = formatClientIndexMarkdown([fakeClient(), fakeClient({ slug: 'second-client', name: 'Second Client' })]);
assert(clientIndexMd.includes('[How to Install MCP Servers in Demo Client](https://allmcps.com/clients/demo-client)'), 'Should link each client');
assert(clientIndexMd.includes('[How to Install MCP Servers in Second Client](https://allmcps.com/clients/second-client)'), 'Should list every client given');

// formatPromptMarkdown / formatPromptIndexMarkdown
function fakeWorkflow(overrides: Partial<McpWorkflow> = {}): McpWorkflow {
  return {
    slug: 'demo-workflow',
    title: 'Demo Workflow Agent',
    subtitle: 'Demo MCP',
    description: 'A demo agent workflow.',
    category: 'Testing',
    requiredMcps: [{ id: 'demo-mcp', name: 'Demo MCP', command: 'npx', args: ['-y', 'demo-mcp'], description: 'Does demo things.' }],
    systemPrompt: 'You are a demo agent.',
    faq: [{ q: 'Is this a demo workflow?', a: 'Yes.' }],
    ...overrides,
  };
}

const promptMd = formatPromptMarkdown(fakeWorkflow());
assert(promptMd.includes('# Demo Workflow Agent'), 'Should render workflow title as H1');
assert(promptMd.includes('**Demo MCP** — Does demo things.'), 'Should list required MCP servers');
assert(promptMd.includes('You are a demo agent.'), 'Should include the raw system prompt');
assert(promptMd.includes('Is this a demo workflow?'), 'Should render workflow FAQ');

const promptIndexMd = formatPromptIndexMarkdown([fakeWorkflow(), fakeWorkflow({ slug: 'second-workflow', title: 'Second Workflow' })]);
assert(promptIndexMd.includes('[Demo Workflow Agent](https://allmcps.com/prompts/demo-workflow)'), 'Should link each workflow');
assert(promptIndexMd.includes('[Second Workflow](https://allmcps.com/prompts/second-workflow)'), 'Should list every workflow given');

// formatAlternativesMarkdown
const altMd = formatAlternativesMarkdown(fakeServer({ id: 'main', name: 'Main Server' }), [
  fakeServer({ id: 'alt-a', name: 'Alt A' }),
]);
assert(altMd.includes('# Alternatives to Main Server'), 'Should render the original server name as H1');
assert(altMd.includes('[Alt A](https://allmcps.com/mcp/alt-a)'), 'Should list every alternative');

const emptyAltMd = formatAlternativesMarkdown(fakeServer({ id: 'main', name: 'Main Server' }), []);
assert(emptyAltMd.includes('No close alternatives'), 'Should handle zero alternatives without crashing');

// formatCompareMarkdown
const compareMd = formatCompareMarkdown(
  fakeServer({ id: 'left-id', name: 'Left Server', githubStars: 100, copies: 10 }),
  fakeServer({ id: 'right-id', name: 'Right Server', githubStars: 200, copies: 20 })
);
assert(compareMd.includes('# Left Server vs Right Server'), 'Should render both server names as H1');
assert(compareMd.includes('| GitHub Stars | 100 | 200 |'), 'Should compare GitHub stars in the table');
assert(compareMd.includes('https://allmcps.com/mcp/left-id'), 'Should link the left listing');
assert(compareMd.includes('https://allmcps.com/mcp/right-id'), 'Should link the right listing');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
