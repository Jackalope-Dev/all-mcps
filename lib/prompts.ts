export interface McpWorkflow {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  requiredMcps: Array<{
    id: string;
    name: string;
    command: string;
    args: string[];
    description: string;
  }>;
  systemPrompt: string;
  faq: Array<{ q: string; a: string }>;
}

export const WORKFLOW_PROMPTS: McpWorkflow[] = [
  {
    slug: 'fullstack-developer',
    title: 'Full-Stack Web Developer Agent',
    subtitle: 'Postgres + GitHub + Puppeteer / Browser Automation',
    category: 'Software Engineering',
    description:
      'An end-to-end agent workflow for building, testing, and debugging full-stack web applications with direct database access, GitHub repository control, and live browser verification.',
    requiredMcps: [
      {
        id: 'modelcontextprotocol-server-postgres',
        name: 'PostgreSQL MCP',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-postgres',
          'postgresql://localhost/mydb',
        ],
        description:
          'Queries schema, executes SELECT/INSERT/UPDATE queries, and verifies database migrations.',
      },
      {
        id: 'modelcontextprotocol-server-git',
        name: 'Git MCP',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-git'],
        description:
          'Reads commit logs, checks git status, diffs changes, and commits code changes.',
      },
      {
        id: 'modelcontextprotocol-server-fetch',
        name: 'Fetch & Scrape MCP',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
        description:
          'Fetches web endpoints, inspects API responses, and parses HTML.',
      },
    ],
    systemPrompt: `You are an expert Full-Stack Senior Software Engineer paired with a developer. You have active access to the project's PostgreSQL database, Git version control system, and HTTP fetch tools via Model Context Protocol (MCP).

When writing code:
1. Always inspect database schemas using PostgreSQL MCP before writing queries or ORM models.
2. Differentiate between safe read operations and state-mutating queries; verify mutation parameters carefully.
3. Use Git MCP to inspect status and recent diffs before modifying complex modules.
4. Test local API endpoints or web surfaces using Fetch MCP to confirm changes work runtime before declaring success.`,
    faq: [
      {
        q: 'Which AI clients support this full-stack workflow?',
        a: 'This workflow runs seamlessly in Cursor IDE, Claude Desktop, Windsurf Cascade, and Cline / VS Code.',
      },
      {
        q: 'How do I pass my database credentials safely?',
        a: 'Specify connection strings in your local config or environment variables (e.g. DATABASE_URL). Never hardcode secrets in repository files.',
      },
    ],
  },
  {
    slug: 'research-agent',
    title: 'Automated Research & Knowledge Agent',
    subtitle: 'Memory + Web Search/Fetch + Obsidian Note Storage',
    category: 'Research & Knowledge Management',
    description:
      'A continuous research assistant that searches the web, synthesizes technical topics, stores persistent notes, and remembers user preferences across sessions.',
    requiredMcps: [
      {
        id: 'modelcontextprotocol-server-memory',
        name: 'Server Memory MCP',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        description:
          'Persistent knowledge graph and entity memory across chat sessions.',
      },
      {
        id: 'modelcontextprotocol-server-fetch',
        name: 'Search & Fetch MCP',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
        description: 'Scrapes web pages, docs, and search results.',
      },
    ],
    systemPrompt: `You are an elite Knowledge Researcher and Technical Analyst. You possess long-term memory graph access and web data extraction capabilities over Model Context Protocol (MCP).

Your research procedure:
1. Query your Memory MCP graph at the start of every request to check for user context, past findings, or established preferences.
2. When researching new topics, fetch authoritative sources using Fetch MCP.
3. Extract core technical facts and store synthesized knowledge entities back into your Memory MCP graph so knowledge accumulates permanently across sessions.`,
    faq: [
      {
        q: 'Where is the memory graph stored?',
        a: 'Server Memory MCP stores JSON entities locally on your machine, completely private and offline.',
      },
    ],
  },
  {
    slug: 'devops-engineer',
    title: 'DevOps & Cloud Infrastructure Engineer',
    subtitle: 'Cloudflare + Git + Docker/CLI',
    category: 'Cloud & Infrastructure',
    description:
      'An autonomous cloud engineering workflow for inspecting Workers, managing DNS records, verifying deployments, and troubleshooting build logs.',
    requiredMcps: [
      {
        id: 'modelcontextprotocol-server-git',
        name: 'Git MCP',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-git'],
        description: 'Inspects deployment commits and release tags.',
      },
      {
        id: 'modelcontextprotocol-server-fetch',
        name: 'API Fetch MCP',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
        description:
          'Pings cloud health check endpoints and deployment monitors.',
      },
    ],
    systemPrompt: `You are a Principal DevOps and Reliability Engineer. You have direct access to git repositories, deployment status endpoints, and infrastructure tools via MCP.

Your workflow principles:
1. Always audit recent git commits and release diffs before diagnosing build failures.
2. Test deployment health endpoints using Fetch MCP after every deployment.
3. Prioritize non-destructive inspection before executing infrastructure modifications.`,
    faq: [
      {
        q: 'Can this agent trigger deployments automatically?',
        a: 'Yes, if configured with git push triggers or Cloudflare/AWS API credentials in your local environment.',
      },
    ],
  },
  {
    slug: 'data-analyst',
    title: 'Data Analyst & SQL Scientist Agent',
    subtitle: 'SQLite / Postgres + Data Science & Visualization',
    category: 'Data Science & Analytics',
    description:
      'An AI data analyst capable of writing complex SQL queries, building analytical data pipelines, and outputting charts.',
    requiredMcps: [
      {
        id: 'modelcontextprotocol-server-sqlite',
        name: 'SQLite MCP',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sqlite'],
        description: 'Inspects database schemas and runs SQL queries.',
      },
    ],
    systemPrompt: `You are a Lead Data Analyst and SQL Expert. You have direct query execution access over SQLite/Postgres MCP servers.

Analytical process:
1. Inspect table definitions and column types before writing SQL queries.
2. Output clear tabular data summaries and explain statistical anomalies.
3. Always include EXPLAIN performance considerations for queries over large datasets.`,
    faq: [
      {
        q: 'Does it work with local SQLite database files?',
        a: 'Yes! Simply pass the path to your .sqlite / .db file in the MCP server config.',
      },
    ],
  },
  {
    slug: 'product-ops',
    title: 'Product & Operations Coordinator',
    subtitle: 'Slack / Discord + Linear / Jira + Customer Support',
    category: 'Productivity & Operations',
    description:
      'An operational agent that coordinates bug reports, user feedback, and issue tracking across team communication and project management tools.',
    requiredMcps: [
      {
        id: 'modelcontextprotocol-server-fetch',
        name: 'API Integrations MCP',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
        description: 'Connects to REST APIs for Slack, Linear, and Jira.',
      },
    ],
    systemPrompt: `You are an Operations Coordinator and Product Specialist. You interface with team communication channels and issue trackers via MCP tools.

Operational protocol:
1. Summarize customer feedback into structured, actionable bug reports.
2. Cross-reference new issues against existing tickets to prevent duplicates.
3. Draft clear update communications for team channels.`,
    faq: [
      {
        q: 'How do I authenticate with Slack or Linear?',
        a: 'Store API tokens in your environment variables or local MCP config file.',
      },
    ],
  },
];

export function getWorkflowBySlug(slug: string): McpWorkflow | undefined {
  return WORKFLOW_PROMPTS.find((w) => w.slug === slug);
}
