import type { Hue } from '../../lib/palette';

/**
 * The evergreen guide set, in reading order. Drives the /guides hub, the
 * reading-time meta on each guide, and the previous/next pagination at the
 * foot of every guide (ArticleLayout), so a new guide only needs one entry.
 */

type GuideTopic =
  | 'basics'
  | 'setup'
  | 'protocol'
  | 'build'
  | 'security'
  | 'troubleshooting'
  | 'use-cases'
  | 'data';

export const GUIDE_TOPICS: { id: GuideTopic; label: string; hue: Hue }[] = [
  { id: 'basics', label: 'Basics', hue: 'blue' },
  { id: 'setup', label: 'Setup', hue: 'teal' },
  { id: 'protocol', label: 'Protocol', hue: 'indigo' },
  { id: 'build', label: 'Build & deploy', hue: 'orange' },
  { id: 'security', label: 'Security', hue: 'red' },
  { id: 'troubleshooting', label: 'Troubleshooting', hue: 'amber' },
  { id: 'use-cases', label: 'Use cases', hue: 'pink' },
  { id: 'data', label: 'Data', hue: 'violet' },
];

/** Identity hue for a guide topic (guide cards, article headers, nav). */
export function guideTopicHue(topic: string): Hue {
  return GUIDE_TOPICS.find((t) => t.id === topic)?.hue ?? 'cyan';
}

export type GuideIcon =
  | 'book'
  | 'terminal'
  | 'cable'
  | 'branch'
  | 'cpu'
  | 'server'
  | 'key'
  | 'shield'
  | 'wrench'
  | 'search'
  | 'chart';

export interface GuideEntry {
  href: string;
  title: string;
  /** Short label used in breadcrumbs and pagination. */
  shortTitle: string;
  description: string;
  topic: GuideTopic;
  level: string;
  readMinutes: number;
  icon: GuideIcon;
  highlights: string[];
}

export const GUIDES: GuideEntry[] = [
  {
    href: '/what-is-mcp',
    title: 'What is Model Context Protocol?',
    shortTitle: 'What is MCP',
    description:
      'Learn what MCP is, why it replaces one-off integrations, how host-client-server roles interact, and how JSON-RPC primitives work.',
    topic: 'basics',
    level: 'Beginner',
    readMinutes: 5,
    icon: 'book',
    highlights: [
      'Core architecture & USB-C analogy',
      'Tools vs Resources vs Prompts',
      'Local (stdio) vs Remote (HTTP)',
      'Security & Prompt Injection safety',
    ],
  },
  {
    href: '/guide',
    title: 'LLM Agents Setup & Configuration Guide',
    shortTitle: 'LLM Agents Guide',
    description:
      'Step-by-step walkthrough to connect Claude Desktop, Claude Code, Cursor, and Windsurf to MCP servers with real JSON config snippets.',
    topic: 'setup',
    level: 'Setup & Config',
    readMinutes: 6,
    icon: 'terminal',
    highlights: [
      'Configuring claude_desktop_config.json',
      'Adding local stdio servers (npx/uvx)',
      'Connecting remote HTTP/SSE servers',
      'Combining multiple servers & troubleshooting',
    ],
  },
  {
    href: '/mcp-transports',
    title: 'MCP Transports Explained',
    shortTitle: 'MCP Transports',
    description:
      'How MCP clients and servers actually exchange messages: the stdio transport, Streamable HTTP, and the deprecated HTTP+SSE model. Which to choose, what breaks on each, and how to run both during migration.',
    topic: 'protocol',
    level: 'Protocol',
    readMinutes: 10,
    icon: 'cable',
    highlights: [
      'Choosing between local stdio and a remote server',
      'What Streamable HTTP changed, and why sessions went away',
      'Why the HTTP+SSE dual-endpoint model was deprecated',
      'Failure modes by transport, and the proxy settings behind them',
    ],
  },
  {
    href: '/mcp-protocol-versioning',
    title: 'MCP Protocol Versioning Explained',
    shortTitle: 'Protocol Versioning',
    description:
      'MCP dropped the initialize handshake for a stateless, per-request protocol. What changed, why, and how servers and clients support both eras, with an interactive walkthrough.',
    topic: 'protocol',
    level: 'Protocol',
    readMinutes: 13,
    icon: 'branch',
    highlights: [
      'Why MCP moved to a stateless, per-request model',
      'server/discover & Multi Round-Trip Requests (MRTR)',
      'What is now deprecated: Roots, Sampling, Logging, HTTP+SSE',
      'Interactive era-compatibility & MRTR simulator',
    ],
  },
  {
    href: '/build-mcp-server',
    title: 'How to Build an MCP Server',
    shortTitle: 'Build an MCP Server',
    description:
      'Build a custom MCP server from scratch: full TypeScript and Python code for tools, resources, and prompts, local testing, and deployment.',
    topic: 'build',
    level: 'Developer',
    readMinutes: 9,
    icon: 'cpu',
    highlights: [
      'TypeScript SDK & FastMCP for Python',
      'Implementing tools, resources & prompts',
      'Testing with MCP Inspector',
      'Deploying to Cloudflare & publishing',
    ],
  },
  {
    href: '/deploy-mcp-server',
    title: 'Deploying & Hosting Remote MCP Servers',
    shortTitle: 'Deploy an MCP Server',
    description:
      'Deploy remote MCP servers to production: step-by-step blueprints for Cloudflare Workers, Docker, Fly.io, AWS, SSE transport setup, CORS, SSL, and monitoring.',
    topic: 'build',
    level: 'DevOps',
    readMinutes: 14,
    icon: 'server',
    highlights: [
      'Cloudflare Workers, Docker & Fly.io blueprints',
      'Express & FastMCP SSE transport implementation',
      'CORS, SSL, & environment secrets management',
      'Health checks & production logging hygiene',
    ],
  },
  {
    href: '/blog/securing-remote-mcp-servers-authentication-guide',
    title: 'Securing & Authenticating Remote MCP Servers',
    shortTitle: 'Securing Remote Servers',
    description:
      'Master remote MCP server security over HTTP/SSE: OAuth 2.0 PKCE auth flow, JWT validation, multi-tenant token propagation, and prompt injection defense.',
    topic: 'security',
    level: 'Enterprise',
    readMinutes: 9,
    icon: 'key',
    highlights: [
      'stdio vs Remote HTTP/SSE security boundary',
      'OAuth 2.0 PKCE & JWT Bearer authentication',
      'TypeScript Express multi-tenant server code',
      'Prompt injection & tool poisoning defenses',
    ],
  },
  {
    href: '/mcp-security',
    title: 'MCP Security Best Practices',
    shortTitle: 'MCP Security',
    description:
      'Use MCP servers safely: the threat model, prompt injection & tool poisoning, vetting servers, least-privilege credentials, sandboxing, and a pre-install checklist.',
    topic: 'security',
    level: 'Security',
    readMinutes: 10,
    icon: 'shield',
    highlights: [
      'The MCP threat model, plainly explained',
      'Prompt injection & tool poisoning defenses',
      'Least-privilege credentials & sandboxing',
      'A pre-install security checklist',
    ],
  },
  {
    href: '/mcp-troubleshooting',
    title: 'MCP Troubleshooting',
    shortTitle: 'Troubleshooting',
    description:
      'Server not connecting, zero tools, PATH errors, stdout corruption, missing env vars, and timeouts — map the symptom to the fix across every major client.',
    topic: 'troubleshooting',
    level: 'Troubleshooting',
    readMinutes: 8,
    icon: 'wrench',
    highlights: [
      'Symptom → cause map for common failures',
      'Where to find Claude / Cursor / Claude Code logs',
      'PATH, config JSON, env vars, and stdio hygiene',
      'Checklist + links to validator & deep-dive posts',
    ],
  },
  {
    href: '/mcp-for-seo',
    title: 'MCP for SEO & AEO Automation',
    shortTitle: 'MCP for SEO',
    description:
      'Automate Google Search Console, Bing Webmaster, IndexNow, technical site audits, and AEO/GEO llms.txt readiness using MCP servers and AI agents.',
    topic: 'use-cases',
    level: 'SEO & AEO',
    readMinutes: 11,
    icon: 'search',
    highlights: [
      'GSC & Bing Webmaster API automation',
      'Instant indexing via IndexNow protocol',
      'AEO, GEO & llms.txt readiness checks',
      'Technical site crawler & audit blueprints',
    ],
  },
  {
    href: '/state-of-mcp',
    title: 'State of MCP',
    shortTitle: 'State of MCP',
    description:
      'Live numbers on the MCP server ecosystem: how many servers exist, local vs remote transports, npx vs uvx, authentication, licenses, health, and security advisories — computed from the full AllMCPs index.',
    topic: 'data',
    level: 'Data',
    readMinutes: 4,
    icon: 'chart',
    highlights: [
      'How many MCP servers exist, and how fast the index grows',
      'Local stdio vs remote HTTP, and npx vs uvx',
      'Auth, pricing and license breakdowns',
      'Health checks and OSV security advisories',
    ],
  },
];

export function guideByHref(href: string): GuideEntry | undefined {
  return GUIDES.find((g) => g.href === href);
}

/** Previous / next guide in reading order, for the article footer. */
export function guideNeighbors(href: string): {
  prev?: GuideEntry;
  next?: GuideEntry;
} {
  const i = GUIDES.findIndex((g) => g.href === href);
  if (i === -1) return {};
  return { prev: GUIDES[i - 1], next: GUIDES[i + 1] };
}
