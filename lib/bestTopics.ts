/**
 * Curated "Best MCP Servers for X" topics powering /best/[topic]. Each maps to a
 * directory category (by slug) so the ranked list is pulled live from the catalog,
 * and carries editorial framing + a short FAQ for answer-engine visibility.
 *
 * Keep `categorySlug` values in sync with lib/category-manifest.json slugs.
 */
export type BestTopic = {
  /** URL slug: /best/<slug> */
  slug: string;
  /** Category slug (categorySlug of a stored category) the ranking is drawn from. */
  categorySlug: string;
  /** <title> / H1 subject, e.g. "Databases". */
  title: string;
  /** One-line meta/intro summary. */
  lead: string;
  faq: { q: string; a: string }[];
};

export const BEST_TOPICS: BestTopic[] = [
  {
    slug: 'databases',
    categorySlug: 'databases',
    title: 'Databases',
    lead: 'The best MCP servers for connecting AI agents to SQL and NoSQL databases — query, inspect schemas, and safely read or write real records from Claude, Cursor, and other clients.',
    faq: [
      { q: 'What is the best MCP server for databases?', a: 'It depends on your database. For Postgres, the official modelcontextprotocol/server-postgres and crystaldba/postgres-mcp are the most widely installed. The ranking on this page is ordered by real usage across the AllMCPs directory.' },
      { q: 'Can an MCP server write to my database, or only read?', a: 'Most database MCP servers default to read-only access for safety; several offer an opt-in write mode. Always check the server’s README and connect with a least-privilege, scoped database credential.' },
      { q: 'How do I connect Claude to a database with MCP?', a: 'Install a database MCP server in your client config (e.g. under mcpServers in claude_desktop_config.json), give it a connection string via environment variables, and restart the client. Each listing links to its setup instructions.' },
    ],
  },
  {
    slug: 'developer-tools',
    categorySlug: 'developer-tools',
    title: 'Developers',
    lead: 'The best developer-focused MCP servers — run code, manage repositories, query build systems, and automate the everyday engineering tasks AI agents can take off your plate.',
    faq: [
      { q: 'What are the best MCP servers for developers?', a: 'The most-installed developer MCP servers cover source control, code execution, and CI. This page ranks them by usage across the AllMCPs directory so you can start with what the community relies on.' },
      { q: 'Do these MCP servers work with Cursor and Claude Code?', a: 'Yes. MCP is a shared protocol, so any server listed here works with any MCP-compatible client — Claude Desktop, Claude Code, Cursor, Windsurf, and others.' },
      { q: 'Are these MCP servers free?', a: 'The vast majority are open source and free to self-host. Some wrap paid third-party APIs that require your own key or account.' },
    ],
  },
  {
    slug: 'web-search',
    categorySlug: 'search-and-data-extraction',
    title: 'Web Search & Scraping',
    lead: 'The best MCP servers for web search and data extraction — let AI agents search the web, scrape pages, and pull structured data out of unstructured sources.',
    faq: [
      { q: 'What is the best MCP server for web search?', a: 'Popular options wrap search APIs and headless scraping. This page ranks web search and extraction servers by real usage so you can pick a proven one.' },
      { q: 'Can MCP servers scrape any website?', a: 'They can fetch and parse most public pages, but respect each site’s terms of service and robots directives. Some servers add rate limiting and caching to stay polite.' },
      { q: 'Do web search MCP servers need an API key?', a: 'Those backed by a commercial search API (e.g. Brave, Tavily, SerpAPI) need your own key; fully self-contained scrapers usually do not.' },
    ],
  },
  {
    slug: 'security',
    categorySlug: 'security',
    title: 'Security',
    lead: 'The best security-focused MCP servers — scanning, auditing, secrets management, and threat analysis with scoped, least-privilege access for AI agents.',
    faq: [
      { q: 'What are the best MCP servers for security work?', a: 'Security MCP servers span vulnerability scanning, secrets detection, and auditing. This page ranks them by usage across the AllMCPs directory.' },
      { q: 'Is it safe to give an AI agent security tooling over MCP?', a: 'Use scoped credentials, prefer read-only/analysis modes, and review each server’s permissions. MCP servers run with the access you grant them, so least privilege matters most here.' },
      { q: 'Can MCP help with secrets management?', a: 'Yes — several servers integrate with vaults and secret stores so agents can reference secrets without exposing raw values in prompts.' },
    ],
  },
  {
    slug: 'browser-automation',
    categorySlug: 'browser-automation',
    title: 'Browser Automation',
    lead: 'The best MCP servers for browser automation — drive a real browser from an AI agent to navigate, click, fill forms, and extract page content.',
    faq: [
      { q: 'What is the best MCP server for browser automation?', a: 'Servers wrapping Playwright, Puppeteer, and browser-use are the most installed. This page ranks browser automation servers by real usage.' },
      { q: 'Do browser automation MCP servers run headless?', a: 'Most support both headless and headed modes. Headless is typical for servers and CI; headed is useful for debugging or when a site needs a visible session.' },
      { q: 'Can an AI agent log into sites through these servers?', a: 'Yes, if you provide credentials — but treat that access carefully and prefer scoped or throwaway accounts for automation.' },
    ],
  },
  {
    slug: 'communication',
    categorySlug: 'communication',
    title: 'Slack & Communication',
    lead: 'The best MCP servers for team communication — let AI agents read, post, and analyze across Slack, Discord, email, and other messaging platforms.',
    faq: [
      { q: 'What is the best MCP server for Slack?', a: 'Community Slack MCP servers are the most installed for reading and posting messages. This page ranks communication servers by real usage.' },
      { q: 'Can MCP servers send messages on my behalf?', a: 'Yes, with a token you provide. Scope the token to the channels and actions you actually want the agent to have.' },
      { q: 'Which chat platforms have MCP servers?', a: 'Slack, Discord, Telegram, email (IMAP/SMTP), and more — browse the full Communication category for the complete list.' },
    ],
  },
  {
    slug: 'memory-knowledge',
    categorySlug: 'knowledge-and-memory',
    title: 'Memory & Knowledge',
    lead: 'The best MCP servers for memory and knowledge — give agents persistent memory, note stores, and searchable knowledge bases that survive across sessions.',
    faq: [
      { q: 'What is the best MCP server for agent memory?', a: 'Memory servers range from simple key-value stores to vector-backed knowledge bases. This page ranks them by usage so you can pick a proven approach.' },
      { q: 'How does MCP give an AI agent long-term memory?', a: 'A memory MCP server persists information outside the model’s context window and exposes tools to store and retrieve it, so the agent can recall facts in later sessions.' },
      { q: 'Can I use my own notes or docs as agent knowledge?', a: 'Yes — several servers index local files, note apps, or knowledge bases so agents can search and cite your own content.' },
    ],
  },
  {
    slug: 'finance',
    categorySlug: 'finance-and-fintech',
    title: 'Finance & Fintech',
    lead: 'The best MCP servers for finance and fintech — market data, payments, accounting, and on-chain activity exposed to AI agents with the guardrails the domain demands.',
    faq: [
      { q: 'What are the best MCP servers for finance?', a: 'Finance MCP servers cover market data, payments, and accounting. This page ranks them by real usage across the AllMCPs directory.' },
      { q: 'Can AI agents move money through MCP servers?', a: 'Some payment servers can, with your keys and explicit scopes. Treat these with extra care: use test/sandbox modes first and least-privilege API credentials.' },
      { q: 'Where do finance MCP servers get their data?', a: 'From market-data and fintech APIs — most require your own API key for the underlying provider.' },
    ],
  },
  {
    slug: 'cloud',
    categorySlug: 'cloud-platforms',
    title: 'Cloud Platforms',
    lead: 'The best MCP servers for cloud platforms — provision, inspect, and manage infrastructure across AWS, GCP, Azure, Cloudflare, and more from an AI agent.',
    faq: [
      { q: 'What is the best MCP server for cloud infrastructure?', a: 'Cloud MCP servers wrap provider APIs and IaC tooling. This page ranks the most-used ones so you can start with a proven integration.' },
      { q: 'Is it safe to let an agent manage cloud resources?', a: 'Grant scoped IAM credentials with only the permissions the task needs, and prefer read/plan modes before allowing changes. MCP servers act with the access you give them.' },
      { q: 'Which cloud providers have MCP servers?', a: 'AWS, GCP, Azure, Cloudflare, and several platform-as-a-service providers — browse the full Cloud Platforms category for the complete set.' },
    ],
  },
  {
    slug: 'coding-agents',
    categorySlug: 'coding-agents',
    title: 'Coding Agents',
    lead: 'The best MCP servers for coding agents — orchestration, task management, and autonomous development workflows that make AI coding assistants more capable.',
    faq: [
      { q: 'What are the best MCP servers for coding agents?', a: 'These servers add planning, task tracking, and multi-step orchestration to coding assistants. This page ranks them by real usage.' },
      { q: 'How are coding-agent MCP servers different from developer tools?', a: 'Developer-tools servers expose individual capabilities (run code, hit an API); coding-agent servers focus on orchestrating those capabilities into autonomous workflows.' },
      { q: 'Do these work with Claude Code and Cursor?', a: 'Yes — they use the standard MCP protocol and work with any MCP-compatible coding client.' },
    ],
  },
  {
    slug: 'monitoring',
    categorySlug: 'monitoring',
    title: 'Monitoring & Observability',
    lead: 'The best MCP servers for monitoring and observability — query metrics, logs, traces, and alerts so AI agents can investigate incidents and report on system health.',
    faq: [
      { q: 'What is the best MCP server for monitoring?', a: 'Observability MCP servers connect agents to metrics, logs, and tracing backends. This page ranks the most-used ones across the directory.' },
      { q: 'Can an AI agent investigate an incident through MCP?', a: 'Yes — with a monitoring server, an agent can pull recent metrics, search logs, and correlate traces to help triage, all read-only if you scope it that way.' },
      { q: 'Which observability platforms have MCP servers?', a: 'Common ones include Prometheus/Grafana, Sentry, and various APM and log platforms — browse the full Monitoring category for more.' },
    ],
  },
  {
    slug: 'file-systems',
    categorySlug: 'file-systems',
    title: 'File Systems',
    lead: 'The best MCP servers for file systems — give AI agents scoped read and write access to local files, directories, and cloud storage.',
    faq: [
      { q: 'What is the best MCP server for file access?', a: 'The official filesystem server is the most widely used, alongside servers for cloud storage. This page ranks file-system servers by real usage.' },
      { q: 'How do I limit which files an agent can access?', a: 'Filesystem MCP servers take an allowed-directory configuration — point them only at the folders the agent should touch, never your whole drive.' },
      { q: 'Can MCP servers access cloud storage like S3 or Google Drive?', a: 'Yes — several servers wrap cloud storage APIs so agents can list, read, and write objects with credentials you provide.' },
    ],
  },
];

export function bestTopicBySlug(slug: string): BestTopic | undefined {
  return BEST_TOPICS.find((t) => t.slug === slug);
}
