/**
 * Seed keyword queue for the blog pipeline. Inserted into `blog_topics` with
 * INSERT OR IGNORE on the normalized keyword, so editing this list is safe:
 * new entries are picked up on the next run, existing ones keep their status.
 *
 * Every seed still passes the cannibalization check before it is written — a
 * seed that overlaps a published post or a /best, /clients or guide page is
 * marked `blocked` with the reason instead of being drafted. So the list below
 * deliberately avoids head terms those hubs already own ("best postgres mcp
 * server", "how to add mcp servers to cursor") and targets the long-tail,
 * problem-shaped queries developers type into search and AI assistants.
 *
 * `priority`: higher runs first. Ideation-generated topics default to 50.
 */

export type BlogSeed = {
  keyword: string;
  secondaryKeywords: string[];
  intent: 'informational' | 'comparison' | 'how-to' | 'troubleshooting';
  /** The specific angle that makes this post different from generic coverage. */
  angle: string;
  cluster: string;
  priority: number;
};

export const BLOG_SEEDS: BlogSeed[] = [
  // --- Building servers ---
  {
    keyword: 'build mcp server typescript sdk',
    secondaryKeywords: ['mcp typescript sdk example', 'mcp server node.js'],
    intent: 'how-to',
    angle:
      'A from-zero TypeScript server with one tool, one resource and a test, explaining each SDK call and the stdio vs HTTP entrypoints.',
    cluster: 'building',
    priority: 90,
  },
  {
    keyword: 'build mcp server python fastmcp',
    secondaryKeywords: ['fastmcp tutorial', 'python mcp sdk'],
    intent: 'how-to',
    angle:
      'FastMCP decorators, typed tool arguments, context logging and packaging with uv so the server installs with uvx.',
    cluster: 'building',
    priority: 90,
  },
  {
    keyword: 'mcp tool input schema design',
    secondaryKeywords: ['mcp json schema tools', 'mcp tool parameters'],
    intent: 'informational',
    angle:
      'How argument schemas affect model tool-call accuracy: enums, required fields, descriptions on properties, and avoiding free-form objects.',
    cluster: 'building',
    priority: 70,
  },
  {
    keyword: 'mcp structured tool output',
    secondaryKeywords: ['mcp outputSchema', 'structuredContent mcp'],
    intent: 'informational',
    angle:
      'When to return structuredContent with an outputSchema versus plain text content, and how clients render each.',
    cluster: 'building',
    priority: 75,
  },
  {
    keyword: 'mcp server error handling',
    secondaryKeywords: ['mcp isError', 'mcp tool errors'],
    intent: 'how-to',
    angle:
      'Protocol errors versus tool errors (isError), what the model sees in each case, and writing error messages the model can recover from.',
    cluster: 'building',
    priority: 70,
  },
  {
    keyword: 'wrap rest api as mcp server',
    secondaryKeywords: ['api to mcp', 'convert api to mcp tools'],
    intent: 'how-to',
    angle:
      'Choosing which endpoints become tools, collapsing CRUD into task-shaped tools, pagination and auth passthrough — beyond auto-generating one tool per endpoint.',
    cluster: 'building',
    priority: 80,
  },
  {
    keyword: 'mcp server pagination large results',
    secondaryKeywords: ['mcp cursor pagination', 'mcp token limit results'],
    intent: 'how-to',
    angle:
      'Keeping tool results inside context budgets: cursors, summaries, truncation markers and resource links for large payloads.',
    cluster: 'building',
    priority: 60,
  },
  {
    keyword: 'publish mcp server to npm',
    secondaryKeywords: [
      'npx mcp server package',
      'mcp server bin package.json',
    ],
    intent: 'how-to',
    angle:
      'package.json bin setup, shebangs, stdout hygiene, versioning, and testing the npx -y install path before release.',
    cluster: 'building',
    priority: 65,
  },
  {
    keyword: 'publish mcp server to pypi uvx',
    secondaryKeywords: ['uvx mcp server', 'python mcp package'],
    intent: 'how-to',
    angle:
      'pyproject entry points, uv build and publish, and making the server runnable with a single uvx command.',
    cluster: 'building',
    priority: 60,
  },
  {
    keyword: 'mcp server docker image',
    secondaryKeywords: ['run mcp server in docker', 'dockerize mcp server'],
    intent: 'how-to',
    angle:
      'Running stdio servers in containers with docker run -i, volume mounts, secrets, and when Docker is the right distribution format.',
    cluster: 'building',
    priority: 55,
  },
  // --- Security ---
  {
    keyword: 'mcp prompt injection',
    secondaryKeywords: ['tool poisoning mcp', 'mcp indirect prompt injection'],
    intent: 'informational',
    angle:
      'Concrete injection paths through tool results and descriptions, and layered mitigations: confirmation, scoping, and output isolation.',
    cluster: 'security',
    priority: 85,
  },
  {
    keyword: 'mcp oauth authorization',
    secondaryKeywords: ['mcp oauth 2.1', 'mcp authorization server'],
    intent: 'how-to',
    angle:
      'The authorization flow step by step: protected resource metadata, dynamic client registration, PKCE, and token audience checks.',
    cluster: 'security',
    priority: 80,
  },
  {
    keyword: 'mcp secrets management api keys',
    secondaryKeywords: [
      'mcp env variables secrets',
      'store api keys mcp config',
    ],
    intent: 'how-to',
    angle:
      'Keeping API keys out of committed configs: env blocks, OS keychains, VS Code inputs, and per-project scoping.',
    cluster: 'security',
    priority: 70,
  },
  {
    keyword: 'audit mcp server before installing',
    secondaryKeywords: ['is mcp server safe', 'mcp server security checklist'],
    intent: 'how-to',
    angle:
      'A practical pre-install checklist: source, permissions, network egress, package provenance, and running it sandboxed first.',
    cluster: 'security',
    priority: 75,
  },
  {
    keyword: 'sandbox mcp servers',
    secondaryKeywords: ['mcp server isolation', 'run untrusted mcp server'],
    intent: 'how-to',
    angle:
      'Containers, filesystem roots, network allowlists and least-privilege credentials for servers you do not fully trust.',
    cluster: 'security',
    priority: 60,
  },
  // --- Operations ---
  {
    keyword: 'mcp server logging observability',
    secondaryKeywords: ['mcp logging notifications', 'monitor mcp server'],
    intent: 'how-to',
    angle:
      'Protocol logging messages versus stderr, structured logs, tracing tool calls, and what to alert on for remote servers.',
    cluster: 'operations',
    priority: 55,
  },
  {
    keyword: 'mcp gateway proxy',
    secondaryKeywords: ['mcp aggregator', 'combine multiple mcp servers'],
    intent: 'informational',
    angle:
      'What gateways do (aggregation, auth, policy, tool filtering), when a team needs one, and the trade-offs of a single choke point.',
    cluster: 'operations',
    priority: 70,
  },
  {
    keyword: 'mcp server rate limiting',
    secondaryKeywords: ['throttle mcp tool calls', 'mcp upstream api limits'],
    intent: 'how-to',
    angle:
      'Protecting upstream APIs from agent loops: per-session limits, backoff, and returning retryable errors the model understands.',
    cluster: 'operations',
    priority: 50,
  },
  {
    keyword: 'mcp server stateless scaling',
    secondaryKeywords: ['horizontal scaling mcp', 'mcp session state'],
    intent: 'informational',
    angle:
      'Running streamable HTTP servers behind load balancers: session IDs, sticky routing versus external state, and serverless constraints.',
    cluster: 'operations',
    priority: 55,
  },
  // --- Using MCP / workflows ---
  {
    keyword: 'mcp servers for data analysis',
    secondaryKeywords: ['ai data analysis mcp', 'query spreadsheets with mcp'],
    intent: 'informational',
    angle:
      'A worked workflow combining a database, a file server and a code-execution server to go from question to chart.',
    cluster: 'workflows',
    priority: 60,
  },
  {
    keyword: 'mcp for customer support automation',
    secondaryKeywords: ['support agent mcp tools', 'helpdesk mcp'],
    intent: 'informational',
    angle:
      'Which tools a support agent needs (ticketing, knowledge base, CRM lookups), and where to keep humans in the loop.',
    cluster: 'workflows',
    priority: 45,
  },
  {
    keyword: 'share mcp config with team',
    secondaryKeywords: ['project mcp config git', 'team mcp setup'],
    intent: 'how-to',
    angle:
      'Committing project-scoped configs (.mcp.json, .vscode/mcp.json, .cursor/mcp.json) without committing secrets, across mixed editors.',
    cluster: 'workflows',
    priority: 70,
  },
  {
    keyword: 'mcp tool approval auto approve',
    secondaryKeywords: ['always allow mcp tools', 'mcp tool permissions'],
    intent: 'informational',
    angle:
      'How each client handles per-tool approval, which tools are reasonable to auto-approve, and which never should be.',
    cluster: 'workflows',
    priority: 60,
  },
  {
    keyword: 'use mcp servers with local llm',
    secondaryKeywords: ['ollama mcp', 'local model tool calling mcp'],
    intent: 'how-to',
    angle:
      'What local models need for reliable tool calling, which clients bridge local models to MCP, and realistic expectations.',
    cluster: 'workflows',
    priority: 65,
  },
  {
    keyword: 'mcp in ci pipelines',
    secondaryKeywords: ['headless mcp agent', 'mcp github actions'],
    intent: 'how-to',
    angle:
      'Running agents with MCP servers non-interactively: config files, secrets in CI, disabling approvals safely, and timeouts.',
    cluster: 'workflows',
    priority: 50,
  },
  // --- Concepts & comparisons ---
  {
    keyword: 'mcp vs function calling',
    secondaryKeywords: ['mcp vs tool use', 'mcp vs openai functions'],
    intent: 'comparison',
    angle:
      'What MCP standardizes on top of provider tool calling — discovery, transport, reuse across clients — and when plain function calling is enough.',
    cluster: 'concepts',
    priority: 85,
  },
  {
    keyword: 'mcp vs a2a agent protocol',
    secondaryKeywords: ['agent2agent vs mcp', 'mcp a2a difference'],
    intent: 'comparison',
    angle:
      'Tool access (MCP) versus agent-to-agent delegation (A2A): where each fits and how they compose.',
    cluster: 'concepts',
    priority: 75,
  },
  {
    keyword: 'mcp roots',
    secondaryKeywords: ['mcp roots capability', 'mcp filesystem boundaries'],
    intent: 'informational',
    angle:
      'What roots are, how clients announce them, and how servers should use them to scope file access.',
    cluster: 'concepts',
    priority: 55,
  },
  {
    keyword: 'mcp tool annotations',
    secondaryKeywords: ['readOnlyHint destructiveHint', 'mcp tool hints'],
    intent: 'informational',
    angle:
      'readOnlyHint, destructiveHint, idempotentHint and openWorldHint: what clients do with them and why they are hints, not guarantees.',
    cluster: 'concepts',
    priority: 65,
  },
  {
    keyword: 'remote vs local mcp servers',
    secondaryKeywords: ['hosted mcp server vs stdio', 'when to use remote mcp'],
    intent: 'comparison',
    angle:
      'Latency, auth, secrets custody, updates and team sharing — a decision guide for choosing local stdio or a hosted endpoint.',
    cluster: 'concepts',
    priority: 70,
  },
];
