/**
 * Curated "Best MCP Servers for X" topics powering /best/[topic]. Each maps to a
 * directory category (by slug) so the ranked list is pulled live from the catalog,
 * and carries editorial framing + a short FAQ for answer-engine visibility.
 *
 * Keep `categorySlug` values in sync with lib/category-manifest.json slugs.
 */

import {
  categoryFromSlug,
  categorySlug as slugFromCategory,
} from './categories';

export type BestTopic = {
  /** URL slug: /best/<slug> */
  slug: string;
  /**
   * Category-hub mode: draw the ranking from every listing in this stored category.
   * Mutually exclusive with `match` (keyword-hub mode).
   */
  categorySlug?: string;
  /**
   * Keyword-hub mode: draw the ranking from every listing whose name or description
   * mentions one of these terms (whole-word match, case-insensitive). Powers the
   * integration-specific pages that target long-tail "<tool> mcp server" queries.
   */
  match?: string[];
  /** <title> / H1 subject, e.g. "Databases" or "PostgreSQL". */
  title: string;
  /** One-line meta/intro summary. */
  lead: string;
  /**
   * Optional 2-3 paragraph "which one should you use" guidance, specific to this
   * topic's real decision factors (official vs. community, read vs. write access,
   * self-hosted vs. managed, etc.) — grounded in how the protocol/ecosystem works,
   * not claims about any single listing's quality we can't verify. Falls back to a
   * generic paragraph on /best/[topic] when omitted.
   */
  guidance?: string[];
  faq: { q: string; a: string }[];
  /**
   * Slugs of other /best/{slug} topics worth cross-linking, for adjacent-intent
   * topics that would otherwise compete for the same head term (e.g. marketing vs.
   * seo) — a real anchor-text link disambiguates scope for both users and search
   * engines instead of leaving two pages to silently split relevance signals.
   */
  relatedTopicSlugs?: string[];
};

export const CATEGORY_TOPICS: BestTopic[] = [
  {
    slug: 'databases',
    categorySlug: 'databases',
    title: 'Databases',
    lead: 'The best MCP servers for connecting AI agents to SQL and NoSQL databases — query, inspect schemas, and safely read or write real records from Claude, Cursor, and other clients.',
    guidance: [
      'Start with the engine-specific page for your database (Postgres, MySQL, MongoDB, SQLite) rather than a generic multi-database server — a purpose-built server usually has better schema introspection and fewer surprises than a lowest-common-denominator wrapper.',
      'The single biggest decision is read vs. write access. Most database MCP servers default to read-only, which is the right starting point: connect with a database role that can only SELECT, watch how the agent actually uses it for a while, and only grant write access to specific tables once you trust the workflow.',
      'Never point one of these at a database credential with admin/superuser rights. Create a dedicated, least-privilege user for the MCP server — most engines support scoping a role to specific schemas or tables, which limits the blast radius if a prompt goes wrong.',
    ],
    faq: [
      {
        q: 'What is the best MCP server for databases?',
        a: 'It depends on your database. For Postgres, the official modelcontextprotocol/server-postgres and crystaldba/postgres-mcp are the most widely installed. The ranking on this page is ordered by real usage across the AllMCPs directory.',
      },
      {
        q: 'Can an MCP server write to my database, or only read?',
        a: 'Most database MCP servers default to read-only access for safety; several offer an opt-in write mode. Always check the server’s README and connect with a least-privilege, scoped database credential.',
      },
      {
        q: 'How do I connect Claude to a database with MCP?',
        a: 'Install a database MCP server in your client config (e.g. under mcpServers in claude_desktop_config.json), give it a connection string via environment variables, and restart the client. Each listing links to its setup instructions.',
      },
    ],
  },
  {
    slug: 'developer-tools',
    categorySlug: 'developer-tools',
    title: 'Developers',
    lead: 'The best developer-focused MCP servers — run code, manage repositories, query build systems, and automate the everyday engineering tasks AI agents can take off your plate.',
    guidance: [
      "For source control and CI (GitHub, GitLab, Docker, Terraform), prefer the official vendor-maintained server when one exists — it tracks that platform's API as it evolves, so you get new endpoints without waiting on a community maintainer. Fall back to a community server when the official one lacks a feature you need.",
      "Anything that can execute code, run containers, or push commits needs a scoped credential, not your main account token. Use a fine-grained personal access token limited to the specific repositories or resources the agent should touch, and treat write-capable dev tools the same way you'd treat CI secrets.",
      "For local, zero-network tasks (running a script, reading files, inspecting a build), a lightweight community server is often simpler to set up than an enterprise-oriented one — you don't need OAuth or a hosted account just to shell out to a linter.",
    ],
    faq: [
      {
        q: 'What are the best MCP servers for developers?',
        a: 'The most-installed developer MCP servers cover source control, code execution, and CI. This page ranks them by usage across the AllMCPs directory so you can start with what the community relies on.',
      },
      {
        q: 'Do these MCP servers work with Cursor and Claude Code?',
        a: 'Yes. MCP is a shared protocol, so any server listed here works with any MCP-compatible client — Claude Desktop, Claude Code, Cursor, Windsurf, and others.',
      },
      {
        q: 'Are these MCP servers free?',
        a: 'The vast majority are open source and free to self-host. Some wrap paid third-party APIs that require your own key or account.',
      },
    ],
  },
  {
    slug: 'web-search',
    categorySlug: 'search-and-data-extraction',
    title: 'Web Search & Scraping',
    lead: 'The best MCP servers for web search and data extraction — let AI agents search the web, scrape pages, and pull structured data out of unstructured sources.',
    faq: [
      {
        q: 'What is the best MCP server for web search?',
        a: 'Popular options wrap search APIs and headless scraping. This page ranks web search and extraction servers by real usage so you can pick a proven one.',
      },
      {
        q: 'Can MCP servers scrape any website?',
        a: 'They can fetch and parse most public pages, but respect each site’s terms of service and robots directives. Some servers add rate limiting and caching to stay polite.',
      },
      {
        q: 'Do web search MCP servers need an API key?',
        a: 'Those backed by a commercial search API (e.g. Brave, Tavily, SerpAPI) need your own key; fully self-contained scrapers usually do not.',
      },
    ],
  },
  {
    slug: 'security',
    categorySlug: 'security',
    title: 'Security',
    lead: 'The best security-focused MCP servers — scanning, auditing, secrets management, and threat analysis with scoped, least-privilege access for AI agents.',
    faq: [
      {
        q: 'What are the best MCP servers for security work?',
        a: 'Security MCP servers span vulnerability scanning, secrets detection, and auditing. This page ranks them by usage across the AllMCPs directory.',
      },
      {
        q: 'Is it safe to give an AI agent security tooling over MCP?',
        a: 'Use scoped credentials, prefer read-only/analysis modes, and review each server’s permissions. MCP servers run with the access you grant them, so least privilege matters most here.',
      },
      {
        q: 'Can MCP help with secrets management?',
        a: 'Yes — several servers integrate with vaults and secret stores so agents can reference secrets without exposing raw values in prompts.',
      },
    ],
  },
  {
    slug: 'browser-automation',
    categorySlug: 'browser-automation',
    title: 'Browser Automation',
    lead: 'The best MCP servers for browser automation — drive a real browser from an AI agent to navigate, click, fill forms, and extract page content.',
    guidance: [
      "Microsoft's official playwright-mcp is the most widely used starting point — it exposes Playwright's accessibility-tree snapshot to the agent instead of raw screenshots, which tends to make click/fill actions more reliable than vision-based automation.",
      "Run browser automation servers headless by default; switch to a headed/visible browser only when you're debugging a flow that isn't working, since watching the browser act is the fastest way to see where a selector or step is failing.",
      'If a workflow needs to log into a site, use a scoped or disposable test account wherever the site supports one — an agent driving a real browser session has the same access a logged-in human would.',
    ],
    faq: [
      {
        q: 'What is the best MCP server for browser automation?',
        a: 'Servers wrapping Playwright, Puppeteer, and browser-use are the most installed. This page ranks browser automation servers by real usage.',
      },
      {
        q: 'Do browser automation MCP servers run headless?',
        a: 'Most support both headless and headed modes. Headless is typical for servers and CI; headed is useful for debugging or when a site needs a visible session.',
      },
      {
        q: 'Can an AI agent log into sites through these servers?',
        a: 'Yes, if you provide credentials — but treat that access carefully and prefer scoped or throwaway accounts for automation.',
      },
    ],
  },
  {
    slug: 'communication',
    categorySlug: 'communication',
    title: 'Slack & Communication',
    lead: 'The best MCP servers for team communication — let AI agents read, post, and analyze across Slack, Discord, email, and other messaging platforms.',
    guidance: [
      'For Slack specifically, check whether a server uses a bot token (`xoxb-`) or a user token (`xoxp-`) before installing — a bot token posts as a visible "App" and only sees channels it\'s invited to, which is usually the safer and more auditable choice for an AI agent than a token that acts as your own user.',
      'Scope the token to the channels the agent actually needs to read or post in rather than a workspace-wide token, and start with read-only (search/read) permissions before granting post/write scopes.',
    ],
    faq: [
      {
        q: 'What is the best MCP server for Slack?',
        a: 'Community Slack MCP servers are the most installed for reading and posting messages. This page ranks communication servers by real usage.',
      },
      {
        q: 'Can MCP servers send messages on my behalf?',
        a: 'Yes, with a token you provide. Scope the token to the channels and actions you actually want the agent to have.',
      },
      {
        q: 'Which chat platforms have MCP servers?',
        a: 'Slack, Discord, Telegram, email (IMAP/SMTP), and more — browse the full Communication category for the complete list.',
      },
    ],
  },
  {
    slug: 'memory-knowledge',
    categorySlug: 'knowledge-and-memory',
    title: 'Memory & Knowledge',
    lead: 'The best MCP servers for memory and knowledge — give agents persistent memory, note stores, and searchable knowledge bases that survive across sessions.',
    faq: [
      {
        q: 'What is the best MCP server for agent memory?',
        a: 'Memory servers range from simple key-value stores to vector-backed knowledge bases. This page ranks them by usage so you can pick a proven approach.',
      },
      {
        q: 'How does MCP give an AI agent long-term memory?',
        a: 'A memory MCP server persists information outside the model’s context window and exposes tools to store and retrieve it, so the agent can recall facts in later sessions.',
      },
      {
        q: 'Can I use my own notes or docs as agent knowledge?',
        a: 'Yes — several servers index local files, note apps, or knowledge bases so agents can search and cite your own content.',
      },
    ],
  },
  {
    slug: 'finance',
    categorySlug: 'finance-and-fintech',
    title: 'Finance & Fintech',
    lead: 'The best MCP servers for finance and fintech — market data, payments, accounting, and on-chain activity exposed to AI agents with the guardrails the domain demands.',
    faq: [
      {
        q: 'What are the best MCP servers for finance?',
        a: 'Finance MCP servers cover market data, payments, and accounting. This page ranks them by real usage across the AllMCPs directory.',
      },
      {
        q: 'Can AI agents move money through MCP servers?',
        a: 'Some payment servers can, with your keys and explicit scopes. Treat these with extra care: use test/sandbox modes first and least-privilege API credentials.',
      },
      {
        q: 'Where do finance MCP servers get their data?',
        a: 'From market-data and fintech APIs — most require your own API key for the underlying provider.',
      },
    ],
  },
  {
    slug: 'cloud',
    categorySlug: 'cloud-platforms',
    title: 'Cloud Platforms',
    lead: 'The best MCP servers for cloud platforms — provision, inspect, and manage infrastructure across AWS, GCP, Azure, Cloudflare, and more from an AI agent.',
    faq: [
      {
        q: 'What is the best MCP server for cloud infrastructure?',
        a: 'Cloud MCP servers wrap provider APIs and IaC tooling. This page ranks the most-used ones so you can start with a proven integration.',
      },
      {
        q: 'Is it safe to let an agent manage cloud resources?',
        a: 'Grant scoped IAM credentials with only the permissions the task needs, and prefer read/plan modes before allowing changes. MCP servers act with the access you give them.',
      },
      {
        q: 'Which cloud providers have MCP servers?',
        a: 'AWS, GCP, Azure, Cloudflare, and several platform-as-a-service providers — browse the full Cloud Platforms category for the complete set.',
      },
    ],
  },
  {
    slug: 'coding-agents',
    categorySlug: 'coding-agents',
    title: 'Coding Agents',
    lead: 'The best MCP servers for coding agents — orchestration, task management, and autonomous development workflows that make AI coding assistants more capable.',
    faq: [
      {
        q: 'What are the best MCP servers for coding agents?',
        a: 'These servers add planning, task tracking, and multi-step orchestration to coding assistants. This page ranks them by real usage.',
      },
      {
        q: 'How are coding-agent MCP servers different from developer tools?',
        a: 'Developer-tools servers expose individual capabilities (run code, hit an API); coding-agent servers focus on orchestrating those capabilities into autonomous workflows.',
      },
      {
        q: 'Do these work with Claude Code and Cursor?',
        a: 'Yes — they use the standard MCP protocol and work with any MCP-compatible coding client.',
      },
    ],
  },
  {
    slug: 'monitoring',
    categorySlug: 'monitoring',
    title: 'Monitoring & Observability',
    lead: 'The best MCP servers for monitoring and observability — query metrics, logs, traces, and alerts so AI agents can investigate incidents and report on system health.',
    faq: [
      {
        q: 'What is the best MCP server for monitoring?',
        a: 'Observability MCP servers connect agents to metrics, logs, and tracing backends. This page ranks the most-used ones across the directory.',
      },
      {
        q: 'Can an AI agent investigate an incident through MCP?',
        a: 'Yes — with a monitoring server, an agent can pull recent metrics, search logs, and correlate traces to help triage, all read-only if you scope it that way.',
      },
      {
        q: 'Which observability platforms have MCP servers?',
        a: 'Common ones include Prometheus/Grafana, Sentry, and various APM and log platforms — browse the full Monitoring category for more.',
      },
    ],
  },
  {
    slug: 'file-systems',
    categorySlug: 'file-systems',
    title: 'File Systems',
    lead: 'The best MCP servers for file systems — give AI agents scoped read and write access to local files, directories, and cloud storage.',
    faq: [
      {
        q: 'What is the best MCP server for file access?',
        a: 'The official filesystem server is the most widely used, alongside servers for cloud storage. This page ranks file-system servers by real usage.',
      },
      {
        q: 'How do I limit which files an agent can access?',
        a: 'Filesystem MCP servers take an allowed-directory configuration — point them only at the folders the agent should touch, never your whole drive.',
      },
      {
        q: 'Can MCP servers access cloud storage like S3 or Google Drive?',
        a: 'Yes — several servers wrap cloud storage APIs so agents can list, read, and write objects with credentials you provide.',
      },
    ],
  },
  {
    slug: 'version-control',
    categorySlug: 'version-control',
    title: 'Git & Version Control',
    lead: 'The best MCP servers for Git and version control — let AI agents read repositories, inspect diffs, manage branches, and open pull requests on GitHub, GitLab, and more.',
    faq: [
      {
        q: 'What is the best MCP server for GitHub?',
        a: 'The official GitHub MCP server is the most widely installed — it covers issues, pull requests, code search, and Actions. This page ranks version-control servers by real usage across the AllMCPs directory.',
      },
      {
        q: 'Can an MCP server open pull requests for me?',
        a: 'Yes. GitHub and GitLab MCP servers can create branches, commit files, and open PRs when you grant a token with write scope. Use a fine-grained token limited to the specific repositories the agent should touch.',
      },
      {
        q: 'Do I need a personal access token to use a Git MCP server?',
        a: 'For hosted platforms like GitHub or GitLab, yes — you supply a token via an environment variable. Local Git servers that operate on a checked-out repo on disk usually need no token at all.',
      },
    ],
  },
  {
    slug: 'workplace-productivity',
    categorySlug: 'workplace-and-productivity',
    title: 'Workplace & Productivity',
    lead: 'The best MCP servers for workplace productivity — connect AI agents to Notion, Google Workspace, calendars, task managers, and the tools your team runs on every day.',
    faq: [
      {
        q: 'What are the best MCP servers for productivity tools?',
        a: 'Servers for Notion, Google Workspace, Linear, and calendar apps are the most installed. This page ranks productivity MCP servers by real usage so you can start with proven options.',
      },
      {
        q: 'Can an AI agent manage my calendar or tasks over MCP?',
        a: 'Yes — calendar and task-manager MCP servers let agents read events, create tasks, and update statuses using OAuth or an API key you provide. Prefer read-only scopes until you trust the workflow.',
      },
      {
        q: 'Do these work with Claude Desktop and Cursor?',
        a: 'Yes. MCP is a shared protocol, so every server listed here works with any MCP-compatible client, including Claude Desktop, Claude Code, Cursor, and Windsurf.',
      },
    ],
  },
  {
    slug: 'marketing',
    categorySlug: 'marketing',
    title: 'Marketing',
    lead: 'The best MCP servers for marketing — give AI agents access to ad platforms, email tools, and CRMs to research, report, and automate campaigns.',
    guidance: [
      "Marketing MCP servers split into two groups: campaign tools (ad platforms, email senders, CRMs) that act on live audiences, and analytics/reporting tools that only read data back. Start with read-only analytics servers if you're new to a workflow — they carry no risk of touching a real campaign or sending to real recipients.",
      "Looking specifically for search-ranking, technical-audit, or backlink data? That's covered separately below.",
      'For sending, scope API keys as narrowly as the platform allows (a single list, a single ad account) and keep a human reviewing anything before it goes out to real recipients or spends real budget.',
    ],
    relatedTopicSlugs: ['seo'],
    faq: [
      {
        q: 'What is the best MCP server for marketing?',
        a: 'The most popular marketing MCP servers connect analytics and ad or email platforms. This page ranks them by real usage across the AllMCPs directory.',
      },
      {
        q: 'Can MCP servers pull marketing analytics data?',
        a: 'Yes — several wrap analytics and ad-platform APIs so an agent can fetch campaign, traffic, and spend data and turn it into reports. You supply the account credentials or API key. For search-ranking and technical-audit data specifically, see our best SEO MCP servers page.',
      },
      {
        q: 'Can an agent send marketing emails through MCP?',
        a: 'Some email-platform MCP servers support sending, but treat that access carefully — scope the API key narrowly and keep a human in the loop for anything that reaches real recipients.',
      },
    ],
  },
  {
    slug: 'social-media',
    categorySlug: 'social-media',
    title: 'Social Media',
    lead: 'The best MCP servers for social media — let AI agents read, post, schedule, and analyze content across X, Reddit, LinkedIn, Discord, and other platforms.',
    faq: [
      {
        q: 'What is the best MCP server for social media?',
        a: 'It depends on the platform — servers for X, Reddit, and Discord are the most installed. This page ranks social media MCP servers by real usage.',
      },
      {
        q: 'Can an AI agent post to social media through MCP?',
        a: 'Yes, when you provide platform credentials with posting scope. Because posts are public and hard to undo, keep a human approval step for anything an agent publishes.',
      },
      {
        q: 'Do social media MCP servers need API keys?',
        a: 'Almost always — each platform requires its own app credentials or OAuth token, which you set via environment variables. Read-heavy servers may work with lighter, read-only scopes.',
      },
    ],
  },
  {
    slug: 'customer-data-platforms',
    categorySlug: 'customer-data-platforms',
    title: 'Customer Data Platforms',
    lead: 'The best MCP servers for CDPs and customer data — profiles, segments, and event streams that marketing and product agents can use responsibly.',
    faq: [
      {
        q: 'What is the best MCP server for a CDP?',
        a: 'It depends on your stack (Segment, mParticle, etc.). This page ranks CDP-related MCP servers by usage on AllMCPs.',
      },
      {
        q: 'Can agents update customer profiles?',
        a: 'Some servers allow writes — scope API keys tightly and keep PII policies in mind before enabling write tools.',
      },
      {
        q: 'Do these integrate with marketing tools?',
        a: 'Often yes, via the CDP itself. MCP gives agents a single interface into profiles and events you already store.',
      },
    ],
  },
  {
    slug: 'data-platforms',
    categorySlug: 'data-platforms',
    title: 'Data Platforms',
    lead: 'The best MCP servers for data platforms — connect AI agents to warehouses, lakes, and analytics engines like Snowflake, BigQuery, and ClickHouse to query and explore data.',
    faq: [
      {
        q: 'What is the best MCP server for a data warehouse?',
        a: 'Servers for Snowflake, BigQuery, and ClickHouse are the most widely installed. This page ranks data-platform MCP servers by real usage across the AllMCPs directory.',
      },
      {
        q: 'Can an agent run analytics queries safely?',
        a: 'Yes — connect the server with a read-only role scoped to the datasets the agent should see. Most data-platform servers support parameterized, read-only querying by default.',
      },
      {
        q: 'How is this different from a plain database MCP server?',
        a: 'Database servers target transactional systems like Postgres and MySQL; data-platform servers target analytical warehouses and lakes built for large-scale queries and reporting.',
      },
    ],
  },
  {
    slug: 'research',
    categorySlug: 'research',
    title: 'Research',
    lead: 'The best MCP servers for research — let AI agents search academic papers, pull references, query knowledge bases, and gather primary sources with citations.',
    faq: [
      {
        q: 'What is the best MCP server for academic research?',
        a: 'Servers wrapping arXiv, PubMed, and scholarly search APIs are the most installed. This page ranks research MCP servers by real usage so you can pick a proven one.',
      },
      {
        q: 'Can MCP servers return citations, not just summaries?',
        a: 'Yes — most research servers return structured metadata (title, authors, DOI, and links) alongside content, so an agent can cite primary sources rather than paraphrase them.',
      },
      {
        q: 'Do research MCP servers need paid API access?',
        a: 'Many use free public APIs like arXiv or PubMed; some premium databases require your own subscription key, supplied via an environment variable.',
      },
    ],
  },
  {
    slug: 'data-science',
    categorySlug: 'data-science-tools',
    title: 'Data Science',
    lead: 'The best MCP servers for data science — give AI agents tools to run notebooks, execute Python, analyze datasets, and generate charts as part of an analysis workflow.',
    faq: [
      {
        q: 'What are the best MCP servers for data science?',
        a: 'Servers that run Python, Jupyter, or dataframe operations are the most installed. This page ranks data-science MCP servers by real usage across the AllMCPs directory.',
      },
      {
        q: 'Can an MCP server run Python code for analysis?',
        a: 'Yes — code-execution and notebook MCP servers let an agent run Python in a sandboxed kernel and return results, tables, and plots. Run them in an isolated environment, not against production systems.',
      },
      {
        q: 'Can these generate charts and visualizations?',
        a: 'Several return rendered charts or the data behind them, so an agent can visualize a dataset and hand you back an image or a reproducible script.',
      },
    ],
  },
  {
    slug: 'code-execution',
    categorySlug: 'code-execution',
    title: 'Code Execution',
    lead: 'The best MCP servers for code execution — let AI agents run code, shell commands, and scripts in sandboxed environments and get results back.',
    faq: [
      {
        q: 'What is the best MCP server for running code?',
        a: 'Sandboxed code-execution servers that support Python and JavaScript are the most installed. This page ranks code-execution MCP servers by real usage.',
      },
      {
        q: 'Is it safe to let an AI agent execute code?',
        a: 'Only inside a sandbox. Prefer servers that run code in an isolated container or ephemeral environment, never with direct access to your host, credentials, or production data.',
      },
      {
        q: 'Which languages do code-execution MCP servers support?',
        a: 'Python and JavaScript are the most common; several also handle shell commands or arbitrary languages via a container. Check each listing for the exact runtime.',
      },
    ],
  },
  {
    slug: 'command-line',
    categorySlug: 'command-line',
    title: 'Command Line & Terminal',
    lead: 'The best MCP servers for the command line — let AI agents run terminal commands, manage processes, and drive CLI tools with scoped, auditable access.',
    faq: [
      {
        q: 'What is the best MCP server for terminal access?',
        a: 'Shell and terminal MCP servers that support allow-lists and working-directory limits are the most trusted. This page ranks command-line MCP servers by real usage.',
      },
      {
        q: 'How do I stop an agent from running dangerous commands?',
        a: 'Use a server that supports command allow-lists or confirmation prompts, run it as a low-privilege user, and scope it to a specific working directory. Never grant unrestricted root shell access.',
      },
      {
        q: 'Can these run long-running processes?',
        a: 'Some manage background processes and stream output; others are built for one-shot commands. Check each listing for process-management support.',
      },
    ],
  },
  {
    slug: 'e-commerce',
    categorySlug: 'e-commerce',
    title: 'E-Commerce',
    lead: 'The best MCP servers for e-commerce — connect AI agents to Shopify, payment processors, and storefront APIs to manage products, orders, and customers.',
    faq: [
      {
        q: 'What is the best MCP server for e-commerce?',
        a: 'Servers for Shopify and major payment processors are the most installed. This page ranks e-commerce MCP servers by real usage across the AllMCPs directory.',
      },
      {
        q: 'Can an agent manage orders and products over MCP?',
        a: 'Yes — storefront MCP servers let agents read and update products, inventory, and orders with an API key you provide. Start with read-only scope before allowing writes to live stores.',
      },
      {
        q: 'Are payment MCP servers safe to use?',
        a: 'Use them with restricted, test-mode, or narrowly scoped keys. Never give an agent unrestricted access to a live payments account, and keep a human step for refunds or charges.',
      },
    ],
  },
  {
    slug: 'legal',
    categorySlug: 'legal',
    title: 'Legal',
    lead: 'The best MCP servers for legal work — give AI agents access to case law, contract analysis, and legal research tools with careful, scoped permissions.',
    faq: [
      {
        q: 'What are the best MCP servers for legal research?',
        a: 'Servers wrapping case-law and legal-database APIs are the most installed. This page ranks legal MCP servers by real usage across the AllMCPs directory.',
      },
      {
        q: 'Can an MCP server review contracts?',
        a: 'Some servers extract clauses and structure from contract text so an agent can analyze them, but treat output as a draft aid, not legal advice — keep a qualified reviewer in the loop.',
      },
      {
        q: 'Is it safe to send confidential documents to a legal MCP server?',
        a: 'Only to servers you control or trust with clear data-handling terms. For sensitive matters, prefer self-hosted servers and avoid sending privileged material to third-party APIs.',
      },
    ],
  },
  {
    slug: 'multimedia',
    categorySlug: 'multimedia-process',
    title: 'Multimedia & Media Processing',
    lead: 'The best MCP servers for multimedia — let AI agents generate, edit, transcribe, and process images, audio, and video through a single protocol.',
    faq: [
      {
        q: 'What is the best MCP server for image or video processing?',
        a: 'Servers for image generation, transcription, and media conversion are the most installed. This page ranks multimedia MCP servers by real usage.',
      },
      {
        q: 'Can an AI agent transcribe audio through MCP?',
        a: 'Yes — several servers wrap speech-to-text APIs so an agent can transcribe audio and video, returning timestamps and text you can act on.',
      },
      {
        q: 'Do multimedia MCP servers need paid API keys?',
        a: 'Those backed by commercial generation or transcription APIs need your own key; self-contained tools that use local libraries (for format conversion, for example) usually do not.',
      },
    ],
  },
  {
    slug: 'gaming',
    categorySlug: 'gaming',
    title: 'Gaming',
    lead: 'The best MCP servers for gaming — connect AI agents to game engines, servers, and platform APIs to build, automate, and interact with games.',
    faq: [
      {
        q: 'What are the best MCP servers for gaming?',
        a: 'Servers for game engines and popular platform APIs are the most installed. This page ranks gaming MCP servers by real usage across the AllMCPs directory.',
      },
      {
        q: 'Can an AI agent control a game through MCP?',
        a: 'Some servers expose game state and actions so an agent can read and interact with a running game or engine. Capabilities vary widely — check each listing for what it exposes.',
      },
      {
        q: 'Do these work with any MCP client?',
        a: 'Yes. Because MCP is a shared protocol, gaming servers listed here work with Claude Desktop, Cursor, Windsurf, and any other MCP-compatible client.',
      },
    ],
  },
  {
    slug: 'location-services',
    categorySlug: 'location-services',
    title: 'Maps & Location',
    lead: 'The best MCP servers for maps and location — let AI agents geocode addresses, get directions, search places, and work with geographic data.',
    faq: [
      {
        q: 'What is the best MCP server for maps?',
        a: 'Servers wrapping major mapping and geocoding APIs are the most installed. This page ranks location MCP servers by real usage across the AllMCPs directory.',
      },
      {
        q: 'Can an agent get directions or geocode addresses over MCP?',
        a: 'Yes — location MCP servers expose geocoding, place search, and routing so an agent can turn an address into coordinates or plan a route, using an API key you provide.',
      },
      {
        q: 'Do maps MCP servers cost money to use?',
        a: 'The servers are free, but the mapping APIs they wrap often bill per request beyond a free tier. Supply your own key and watch usage on high-volume workflows.',
      },
    ],
  },
  {
    slug: 'travel',
    categorySlug: 'travel-and-transportation',
    title: 'Travel & Transportation',
    lead: 'The best MCP servers for travel and transportation — give AI agents access to flight, transit, and booking data to plan trips and answer logistics questions.',
    faq: [
      {
        q: 'What are the best MCP servers for travel?',
        a: 'Servers for flight search, transit data, and booking platforms are the most installed. This page ranks travel MCP servers by real usage across the AllMCPs directory.',
      },
      {
        q: 'Can an AI agent book travel through MCP?',
        a: 'Some servers support booking flows, but most focus on search and information. For anything that spends money or reserves seats, keep a human confirmation step.',
      },
      {
        q: 'Do travel MCP servers need API keys?',
        a: 'Usually — flight and booking APIs require provider credentials you set via environment variables. Some public transit servers use open data and need no key.',
      },
    ],
  },
];

/**
 * Integration-specific "Best <tool> MCP Servers" hubs. Each targets the long-tail
 * queries people actually search (e.g. "postgres mcp server", "youtube transcript mcp",
 * "openapi to mcp") rather than a broad category. The ranking is drawn live from every
 * listing that mentions one of `match` — so the page is only as good as the catalog is
 * deep, and every term below was chosen because the directory has a real cluster of
 * servers for it. Keep terms unambiguous (whole-word matched) to avoid false positives.
 */
export const KEYWORD_TOPICS: BestTopic[] = [
  {
    slug: 'postgres',
    match: ['postgres', 'postgresql'],
    title: 'PostgreSQL',
    lead: 'The best MCP servers for PostgreSQL — let AI agents run queries, inspect schemas, and read or write records in your Postgres database from Claude, Cursor, and other MCP clients.',
    guidance: [
      'The official modelcontextprotocol/server-postgres and crystaldba/postgres-mcp are the two most widely deployed Postgres servers — both cover schema introspection and querying, and crystaldba/postgres-mcp additionally ships EXPLAIN-based query analysis, which is useful if you want the agent to help diagnose slow queries rather than just run them.',
      'Connect with a read-only role first (`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ...`). If you later want the agent to write, most Postgres servers gate that behind an explicit flag or a separate write-capable connection string — treat that as a deliberate opt-in, not the default.',
      'For managed Postgres (Supabase, Neon, RDS), use the connection string your provider issues for a scoped/read replica role if one is available, rather than the primary admin connection string.',
    ],
    faq: [
      {
        q: 'What is the best Postgres MCP server?',
        a: 'The official modelcontextprotocol/server-postgres and crystaldba/postgres-mcp are the most widely installed. This page ranks Postgres MCP servers by real usage across the AllMCPs directory so you can start with a proven one.',
      },
      {
        q: 'Can a Postgres MCP server write to my database?',
        a: 'Some support writes, but most default to read-only for safety. Connect with a least-privilege role scoped to only the tables the agent needs, and enable write mode explicitly if the server offers it.',
      },
      {
        q: 'How do I connect Claude to Postgres?',
        a: 'Install a Postgres MCP server in your client config, pass your connection string via an environment variable, and restart the client. Each listing links to its exact setup steps.',
      },
    ],
  },
  {
    slug: 'sqlite',
    match: ['sqlite'],
    title: 'SQLite',
    lead: 'The best MCP servers for SQLite — give AI agents direct access to a local SQLite database file to query tables, inspect schemas, and analyze data without a separate database server.',
    guidance: [
      "SQLite is file-based, so there's no network access or connection string to scope — the entire security model comes down to which .db file path you point the server at and whether that file is writable. Copy the file to a scratch location first if you want the agent to experiment without risk to the original.",
      "The official modelcontextprotocol/server-sqlite is a reasonable default for straightforward query/inspect workflows; reach for a community alternative only if you need something it doesn't support, like full-text search extensions.",
    ],
    faq: [
      {
        q: 'What is the best SQLite MCP server?',
        a: 'The official modelcontextprotocol/server-sqlite is the most widely installed. This page ranks SQLite MCP servers by real usage so you can pick a maintained option.',
      },
      {
        q: 'Do I need a running database server to use SQLite over MCP?',
        a: 'No — SQLite is file-based, so the MCP server reads a .db/.sqlite file on disk directly. You just point it at the file path in your client config.',
      },
      {
        q: 'Can an agent modify a SQLite database?',
        a: 'Yes, if the server exposes write tools. Keep a backup of the file and prefer read-only mode when the agent only needs to analyze data.',
      },
    ],
  },
  {
    slug: 'mysql',
    match: ['mysql', 'mariadb'],
    title: 'MySQL',
    lead: 'The best MCP servers for MySQL and MariaDB — connect AI agents to your relational database to run queries, explore schemas, and safely read or update records.',
    guidance: [
      "MariaDB is wire-compatible with MySQL, so almost any MySQL MCP server connects to a MariaDB instance without modification — check the listing's README for an explicit MariaDB callout only if you're relying on MariaDB-specific features.",
      'As with any relational database, create a dedicated MySQL user for the MCP server with grants limited to the schemas it needs (`GRANT SELECT ON yourdb.* TO ...`), rather than reusing an application or root credential.',
    ],
    faq: [
      {
        q: 'What is the best MySQL MCP server?',
        a: 'Several community MySQL/MariaDB servers are widely used. This page ranks them by real usage across the AllMCPs directory.',
      },
      {
        q: 'Is it safe to give an agent MySQL access?',
        a: 'Use a dedicated database user with least-privilege grants, and prefer read-only access until you trust the workflow. MCP servers act with exactly the credentials you provide.',
      },
      {
        q: 'Does the same server work with MariaDB?',
        a: 'Usually yes — MariaDB is wire-compatible with MySQL, so most MySQL MCP servers connect to it without changes. Check the listing to be sure.',
      },
    ],
  },
  {
    slug: 'mongodb',
    match: ['mongodb', 'mongo'],
    title: 'MongoDB',
    lead: 'The best MCP servers for MongoDB — let AI agents query collections, inspect documents, and work with your NoSQL data through the Model Context Protocol.',
    guidance: [
      'Unlike a fixed SQL schema, MongoDB collections can hold documents with varying shapes — so a server\'s "inspect schema" tool is really sampling documents to infer structure. If your collections are inconsistent, expect the agent to occasionally miss a field that only exists on some documents.',
      "Use a MongoDB user scoped to specific databases via role-based access control (`db.grantRolesToUser`) rather than an atlasAdmin/root role, and prefer a read-only role until you've seen how the agent behaves with the collections in question.",
    ],
    faq: [
      {
        q: 'What is the best MongoDB MCP server?',
        a: 'This page ranks MongoDB MCP servers by real usage across the AllMCPs directory so you can start with a maintained, popular option.',
      },
      {
        q: 'Can an agent run aggregation pipelines over MCP?',
        a: 'Many MongoDB servers expose find and aggregate operations, so an agent can run pipelines and return results. Check each listing for the exact operations supported.',
      },
      {
        q: 'How do I limit what the agent can access?',
        a: 'Connect with a scoped MongoDB user restricted to specific databases or collections, and prefer read-only roles where possible.',
      },
    ],
  },
  {
    slug: 'github',
    match: ['github'],
    title: 'GitHub',
    lead: 'The best MCP servers for GitHub — let AI agents read repositories, search code, manage issues and pull requests, and drive GitHub Actions right from your client.',
    guidance: [
      'The official github/github-mcp-server is maintained by GitHub itself and is the safest default — it tracks the GitHub API directly, supports both repository-scoped and org-scoped tokens, and is the one most other MCP clients document by name.',
      'Use a fine-grained personal access token scoped to the specific repositories you want the agent working in, not a classic token with account-wide access. If you only need the agent to read code and open PRs for review (not merge them), a token without admin/merge scopes is enough.',
      'For read-heavy workflows — searching code, reading issues, summarizing PRs — a token with only `contents:read` and `issues:read` is sufficient and meaningfully lower-risk than a full read/write token.',
    ],
    faq: [
      {
        q: 'What is the best GitHub MCP server?',
        a: 'The official GitHub MCP server is the most widely installed — it covers issues, pull requests, code search, and Actions. This page ranks GitHub MCP servers by real usage.',
      },
      {
        q: 'Can a GitHub MCP server open pull requests?',
        a: 'Yes, when you supply a token with write scope it can create branches, commit files, and open PRs. Use a fine-grained token limited to the specific repositories the agent should touch.',
      },
      {
        q: 'Do I need a personal access token?',
        a: 'Yes — you provide a GitHub token via an environment variable. Scope it to only the repositories and permissions the agent actually needs.',
      },
    ],
  },
  {
    slug: 'gitlab',
    match: ['gitlab'],
    title: 'GitLab',
    lead: 'The best MCP servers for GitLab — connect AI agents to your GitLab projects to browse code, manage issues and merge requests, and inspect pipelines.',
    guidance: [
      "If you run self-hosted GitLab, confirm the server accepts a custom instance base URL before installing — most do, but a few are hardcoded to gitlab.com and won't work against a private instance.",
      "Prefer a project- or group-access token over a personal access token when the agent should only touch specific projects — it's revocable independently of your account and doesn't carry your full personal permissions.",
    ],
    faq: [
      {
        q: 'What is the best GitLab MCP server?',
        a: 'This page ranks GitLab MCP servers by real usage across the AllMCPs directory so you can pick a maintained option.',
      },
      {
        q: 'Does it work with self-hosted GitLab?',
        a: 'Many GitLab MCP servers accept a custom instance URL, so they work with self-hosted and gitlab.com alike. Check the listing for a base-URL setting.',
      },
      {
        q: 'Can an agent open merge requests?',
        a: 'Yes, with a token that has the right scope. Prefer a project- or group-scoped token over a full-access one.',
      },
    ],
  },
  {
    slug: 'docker',
    match: ['docker'],
    title: 'Docker',
    lead: 'The best MCP servers for Docker — let AI agents list containers, inspect logs, run images, and manage your local or remote Docker environment.',
    guidance: [
      'Docker access is effectively host access — a container can mount volumes and reach the network, so treat the Docker socket the MCP server connects to with the same caution as SSH access to that machine. Run it against a disposable dev host or VM rather than a machine with production containers on it.',
      "Start with a server limited to read/inspect operations (list containers, read logs, inspect images) while you evaluate it, and only move to a lifecycle-management server (start/stop/run) once you're comfortable with what the agent does with the read-only tools.",
    ],
    faq: [
      {
        q: 'What is the best Docker MCP server?',
        a: 'This page ranks Docker MCP servers by real usage across the AllMCPs directory so you can start with a proven integration.',
      },
      {
        q: 'Can an agent start and stop containers?',
        a: 'Yes — most Docker MCP servers expose container lifecycle tools. Run them against a non-production Docker host and review what they can do before granting access.',
      },
      {
        q: 'Is it safe to give an agent Docker access?',
        a: 'Docker access is powerful, so scope it carefully: prefer a dedicated host or socket, avoid production, and review the server’s available tools first.',
      },
    ],
  },
  {
    slug: 'kubernetes',
    match: ['kubernetes', 'k8s'],
    title: 'Kubernetes',
    lead: 'The best MCP servers for Kubernetes — let AI agents inspect clusters, query workloads, read logs, and help troubleshoot deployments through the Model Context Protocol.',
    faq: [
      {
        q: 'What is the best Kubernetes MCP server?',
        a: 'This page ranks Kubernetes MCP servers by real usage across the AllMCPs directory so you can pick a maintained option.',
      },
      {
        q: 'Can an agent make changes to my cluster?',
        a: 'Some servers support write operations, but prefer a read-only kubeconfig context for investigation. Scope RBAC tightly and never point an agent at production with cluster-admin.',
      },
      {
        q: 'How does it authenticate to the cluster?',
        a: 'Most use your existing kubeconfig or a service-account token you provide. Point it at a specific context with least-privilege RBAC.',
      },
    ],
  },
  {
    slug: 'aws',
    match: ['aws'],
    title: 'AWS',
    lead: 'The best MCP servers for AWS — connect AI agents to Amazon Web Services to inspect resources, query services, and help manage your cloud infrastructure.',
    faq: [
      {
        q: 'What is the best AWS MCP server?',
        a: 'This page ranks AWS MCP servers by real usage across the AllMCPs directory. Many focus on specific services (S3, EC2, Lambda, CloudWatch), so pick by the service you need.',
      },
      {
        q: 'Is it safe to let an agent manage AWS?',
        a: 'Grant a scoped IAM role or user with only the permissions the task needs, and prefer read-only policies before allowing changes. MCP servers act with exactly the IAM access you give them.',
      },
      {
        q: 'How do AWS MCP servers authenticate?',
        a: 'Typically via standard AWS credentials — an access key/secret or a named profile you set through environment variables. Use short-lived, least-privilege credentials where possible.',
      },
    ],
  },
  {
    slug: 'openapi',
    match: ['openapi', 'swagger'],
    title: 'OpenAPI',
    lead: 'The best MCP servers for OpenAPI and Swagger — turn any REST API with an OpenAPI spec into MCP tools an AI agent can call, without hand-writing an integration.',
    faq: [
      {
        q: 'How do I turn an OpenAPI spec into an MCP server?',
        a: 'Several servers on this page take an OpenAPI/Swagger document and expose each operation as an MCP tool automatically. Point one at your spec URL or file and it generates the tools for you.',
      },
      {
        q: 'What is the best OpenAPI-to-MCP server?',
        a: 'This page ranks OpenAPI/Swagger MCP servers by real usage across the AllMCPs directory so you can start with a maintained generator.',
      },
      {
        q: 'Do these handle authentication to the API?',
        a: 'Most let you pass API keys or bearer tokens through configuration so the generated tools call your API authenticated. Check each listing for the auth methods it supports.',
      },
    ],
  },
  {
    slug: 'notion',
    match: ['notion'],
    title: 'Notion',
    lead: 'The best MCP servers for Notion — let AI agents read, search, create, and update pages and databases in your Notion workspace.',
    faq: [
      {
        q: 'What is the best Notion MCP server?',
        a: 'This page ranks Notion MCP servers by real usage across the AllMCPs directory so you can pick a maintained option.',
      },
      {
        q: 'Can an agent edit my Notion pages?',
        a: 'Yes, with a Notion integration token that has edit access to the pages you share with it. Share only the specific pages or databases the agent should touch.',
      },
      {
        q: 'How do I connect an agent to Notion?',
        a: 'Create a Notion internal integration, share the relevant pages with it, and give the MCP server the integration token via an environment variable.',
      },
    ],
  },
  {
    slug: 'jira',
    match: ['jira'],
    title: 'Jira',
    lead: 'The best MCP servers for Jira — connect AI agents to your Jira projects to search issues, create and update tickets, and report on sprint progress.',
    faq: [
      {
        q: 'What is the best Jira MCP server?',
        a: 'This page ranks Jira MCP servers by real usage across the AllMCPs directory so you can start with a maintained integration.',
      },
      {
        q: 'Can an agent create and update Jira issues?',
        a: 'Yes, with an API token scoped to your Jira account. Prefer a dedicated service account so the agent’s actions are easy to audit.',
      },
      {
        q: 'Does it work with Jira Cloud and Server?',
        a: 'Many servers support both, using your instance URL and an API token. Check the listing for Data Center/Server compatibility.',
      },
    ],
  },
  {
    slug: 'google-workspace',
    match: ['google'],
    title: 'Google Workspace',
    lead: 'The best MCP servers for Google Workspace — give AI agents access to Google Drive, Sheets, Docs, Calendar, and Gmail to read, search, and manage your Google data.',
    faq: [
      {
        q: 'What is the best Google MCP server?',
        a: 'It depends which service you need — Drive, Sheets, Calendar, and Gmail all have dedicated servers. This page ranks Google-related MCP servers by real usage across the AllMCPs directory.',
      },
      {
        q: 'How does a Google MCP server authenticate?',
        a: 'Most use OAuth: you authorize the app once and it stores a token. Grant the narrowest scopes that cover what the agent needs (read-only where possible).',
      },
      {
        q: 'Can an agent edit my Google Sheets or send email?',
        a: 'Yes, with write or send scopes — but those are powerful, so keep a human approval step for anything that changes documents or reaches real recipients.',
      },
    ],
  },
  {
    slug: 'slack',
    match: ['slack'],
    title: 'Slack',
    lead: 'The best MCP servers for Slack — let AI agents read channels, search history, and post messages in your Slack workspace.',
    faq: [
      {
        q: 'What is the best Slack MCP server?',
        a: 'This page ranks Slack MCP servers by real usage across the AllMCPs directory so you can pick a proven one.',
      },
      {
        q: 'Can an agent post messages to Slack?',
        a: 'Yes, with a Slack bot token scoped to the channels and actions you allow. Limit the token to specific channels rather than the whole workspace.',
      },
      {
        q: 'How do I set up a Slack MCP server?',
        a: 'Create a Slack app, add the scopes you need, install it to your workspace, and give the MCP server the bot token via an environment variable.',
      },
    ],
  },
  {
    slug: 'discord',
    match: ['discord'],
    title: 'Discord',
    lead: 'The best MCP servers for Discord — let AI agents read channels, post messages, and manage your Discord server through a bot.',
    faq: [
      {
        q: 'What is the best Discord MCP server?',
        a: 'This page ranks Discord MCP servers by real usage across the AllMCPs directory so you can start with a maintained bot.',
      },
      {
        q: 'Can an agent send messages to Discord?',
        a: 'Yes, using a Discord bot token with the right permissions in the servers and channels you add it to. Grant only the permissions the agent needs.',
      },
      {
        q: 'Do I need to run a Discord bot?',
        a: 'Yes — you create a bot application, invite it to your server, and give the MCP server its token. The listing links to setup details.',
      },
    ],
  },
  {
    slug: 'youtube',
    match: ['youtube'],
    title: 'YouTube',
    lead: 'The best MCP servers for YouTube — let AI agents fetch video transcripts, pull metadata, and search YouTube so they can summarize and analyze video content.',
    faq: [
      {
        q: 'What is the best YouTube MCP server?',
        a: 'Many focus on transcript extraction and metadata. This page ranks YouTube MCP servers by real usage across the AllMCPs directory so you can pick a reliable one.',
      },
      {
        q: 'Can an MCP server get a YouTube video transcript?',
        a: 'Yes — that is the most common use. A YouTube transcript MCP server fetches the captions for a video so an agent can summarize or search the spoken content.',
      },
      {
        q: 'Do YouTube MCP servers need an API key?',
        a: 'Transcript-only servers often work without one; those that search or pull rich metadata usually need a YouTube Data API key you provide.',
      },
    ],
  },
  {
    slug: 'pdf',
    match: ['pdf'],
    title: 'PDF',
    lead: 'The best MCP servers for PDFs — let AI agents extract text and tables, read, and process PDF documents so they can answer questions over your files.',
    faq: [
      {
        q: 'What is the best PDF MCP server?',
        a: 'This page ranks PDF MCP servers by real usage across the AllMCPs directory. Options range from simple text extraction to full layout and table parsing.',
      },
      {
        q: 'Can an agent read a scanned PDF?',
        a: 'Some servers include OCR for scanned documents; others handle only text-based PDFs. Check each listing for OCR support if your files are scans.',
      },
      {
        q: 'Can it extract tables, not just text?',
        a: 'Several PDF servers preserve tables and structure so an agent gets clean, queryable data rather than a flat text dump.',
      },
    ],
  },
  {
    slug: 'stripe',
    match: ['stripe'],
    title: 'Stripe',
    lead: 'The best MCP servers for Stripe — let AI agents query payments, customers, and subscriptions and help manage your Stripe account through the Model Context Protocol.',
    faq: [
      {
        q: 'What is the best Stripe MCP server?',
        a: 'This page ranks Stripe MCP servers by real usage across the AllMCPs directory, including Stripe’s own official integration.',
      },
      {
        q: 'Is it safe to connect an agent to Stripe?',
        a: 'Use a restricted API key (Stripe supports these) and start in test mode. Never give an agent an unrestricted live key, and keep a human step for refunds or charges.',
      },
      {
        q: 'Can an agent issue refunds or create charges?',
        a: 'Some servers support write actions with a suitably scoped key, but treat these carefully — prefer read-only reporting unless you explicitly need writes.',
      },
    ],
  },
  {
    slug: 'playwright',
    match: ['playwright'],
    title: 'Playwright',
    lead: 'The best Playwright MCP servers — drive a real browser from an AI agent to navigate pages, click, fill forms, and extract content using Microsoft’s Playwright.',
    faq: [
      {
        q: 'What is the best Playwright MCP server?',
        a: 'Microsoft’s official Playwright MCP is the most widely installed, alongside several community builds. This page ranks Playwright MCP servers by real usage across the AllMCPs directory.',
      },
      {
        q: 'Does a Playwright MCP server run headless?',
        a: 'Yes — most support both headless and headed modes. Headless is typical for servers and CI; headed helps when debugging or when a site needs a visible session.',
      },
      {
        q: 'How is this different from a Puppeteer MCP server?',
        a: 'Both automate a browser; Playwright supports Chromium, Firefox, and WebKit and is often preferred for cross-browser work, while Puppeteer targets Chromium. Pick by the browsers you need.',
      },
    ],
  },
  {
    slug: 'seo',
    match: ['seo', 'serp', 'backlink', 'search console'],
    title: 'SEO',
    lead: 'The best MCP servers for SEO — connect AI agents to Google Search Console, SERP trackers, technical site audits, backlink data, and keyword research so they can investigate rankings and ship fixes, not just report on them.',
    faq: [
      {
        q: 'What is the best MCP server for SEO?',
        a: 'It depends on the job: Google Search Console servers are the most widely installed for performance and indexing data, alongside dedicated technical-audit and backlink-intelligence servers. This page ranks SEO MCP servers by real usage across the AllMCPs directory so you can start with a proven one.',
      },
      {
        q: 'Can an AI agent run a technical SEO audit automatically?',
        a: 'Yes — several servers here crawl a URL or site and return a health score, issues by category (robots.txt, sitemaps, schema markup, meta tags), and prioritized fixes, so an agent can diagnose problems without a human running the crawl by hand.',
      },
      {
        q: 'Do SEO MCP servers need API keys or OAuth?',
        a: 'Google Search Console and most SERP-tracking servers use OAuth or a provider API key you supply. Pure crawl/audit tools that only fetch public pages typically need no credentials at all — check each listing for its exact requirements.',
      },
      {
        q: 'Can these servers help with AI search visibility (AEO/GEO), not just Google?',
        a: 'Yes — a growing set of listings specifically score and improve visibility in AI answer engines (ChatGPT, Perplexity, Google AI Overviews): checking llms.txt, structured data, and AI-citation likelihood alongside traditional SEO signals.',
      },
      {
        q: 'Is it safe to give an agent write access to Search Console or my CMS?',
        a: 'Prefer read-only scopes for reporting and audits, and reserve write access (publishing posts, updating meta tags) for servers you trust with a scoped, revocable token — the same least-privilege approach as any other MCP integration.',
      },
    ],
    relatedTopicSlugs: ['marketing'],
  },
  {
    slug: 'figma',
    match: ['figma'],
    title: 'Figma',
    lead: 'The best MCP servers for Figma — give AI coding agents access to frames, components, and design tokens so they can turn designs into code that matches the file.',
    guidance: [
      "Figma MCP servers fall into two groups: read-only servers that pull a frame's layout, styles, and variables for design-to-code work, and servers that can also create or edit nodes in a file. For most teams the read-only kind covers the real need — generating components that match the design.",
      'Output quality depends heavily on how the Figma file is built. Auto layout, named layers, and shared components and variables give the agent structure to map onto your codebase; a flat file of absolutely positioned rectangles produces brittle markup no matter which server you use.',
      'Use a personal access token scoped to the files the agent needs, and prefer read scopes unless you have a specific reason to let an agent modify designs.',
    ],
    faq: [
      {
        q: 'What is the best Figma MCP server?',
        a: 'It depends on whether you need read-only design context or write access. This page ranks Figma MCP servers by real usage across the AllMCPs directory, so start with the most installed option that matches your use case.',
      },
      {
        q: 'Can an AI agent turn a Figma design into code with MCP?',
        a: "Yes. A Figma MCP server passes the selected frame's layout, styles, and variables to the agent, which then writes components in your framework. Results are best when the file uses auto layout and shared components.",
      },
      {
        q: 'Do Figma MCP servers need an API token?',
        a: 'Most do. You create a Figma personal access token and pass it to the server through an environment variable. Scope it to read access unless the server needs to edit files.',
      },
    ],
    relatedTopicSlugs: ['developer-tools'],
  },
  {
    slug: 'obsidian',
    match: ['obsidian'],
    title: 'Obsidian',
    lead: 'The best MCP servers for Obsidian — let AI agents search, read, link, and write notes in your local Obsidian vault.',
    guidance: [
      "Obsidian MCP servers connect in one of two ways: directly to the vault folder on disk, or through the Obsidian Local REST API community plugin while the app is running. Direct file access works without the app open; the plugin route respects Obsidian's own indexing and link handling.",
      'Because a vault is plain markdown on your disk, a write-capable server can rename, move, or overwrite notes. Keep the vault under version control or a backup before you let an agent reorganize it, and start with read and search tools.',
    ],
    faq: [
      {
        q: 'What is the best Obsidian MCP server?',
        a: 'This page ranks Obsidian MCP servers by real usage across the AllMCPs directory. Choose between servers that read the vault folder directly and servers that use the Local REST API plugin.',
      },
      {
        q: 'Can Claude read my Obsidian notes?',
        a: 'Yes. Install an Obsidian MCP server in Claude Desktop or Claude Code and point it at your vault path or the Local REST API plugin. Claude can then search and read notes during a conversation.',
      },
      {
        q: 'Does an Obsidian MCP server send my notes to the cloud?',
        a: 'The server itself runs locally, but any note content the agent reads is sent to the model provider as part of the conversation. Keep sensitive notes in a folder the server cannot access.',
      },
    ],
    relatedTopicSlugs: ['memory-knowledge'],
  },
  {
    slug: 'shopify',
    match: ['shopify'],
    title: 'Shopify',
    lead: 'The best MCP servers for Shopify — connect AI agents to products, orders, customers, and the Admin and Storefront APIs of a Shopify store.',
    guidance: [
      'Separate the servers that help you build on Shopify (documentation search, GraphQL schema introspection, theme and app development) from the ones that operate a live store through the Admin API. Development servers are low risk; store-operating servers can change prices, inventory, and orders.',
      'For anything that touches a live store, create a custom app with the narrowest Admin API scopes the job needs, and test against a development store first.',
    ],
    faq: [
      {
        q: 'What is the best Shopify MCP server?',
        a: 'This page ranks Shopify MCP servers by real usage across the AllMCPs directory. Pick a development-focused server for building apps and themes, or an Admin API server for managing store data.',
      },
      {
        q: 'Can an AI agent manage my Shopify store?',
        a: "Yes, through a server that uses the Shopify Admin API with an access token from a custom app. Limit the app's scopes and keep a human review step for price, inventory, and order changes.",
      },
      {
        q: 'Do I need a Shopify API token for MCP?',
        a: 'Store-operating servers need an Admin or Storefront API access token. Documentation and schema servers used for development usually need no store credentials.',
      },
    ],
    relatedTopicSlugs: ['e-commerce', 'stripe'],
  },
  {
    slug: 'gmail',
    match: ['gmail'],
    title: 'Gmail',
    lead: 'The best MCP servers for Gmail — let AI agents search, read, label, draft, and send email from a Gmail account.',
    guidance: [
      'Gmail servers authenticate with Google OAuth, and the scopes you grant decide the risk: read-only scopes let an agent search and summarize, while send and modify scopes let it act as you. Start read-only and add drafting before full send access.',
      'Email is a common channel for prompt injection — a message can contain instructions aimed at the agent. Prefer servers and clients that require confirmation before sending, and avoid auto-approving send tools.',
    ],
    faq: [
      {
        q: 'What is the best Gmail MCP server?',
        a: 'This page ranks Gmail MCP servers by real usage across the AllMCPs directory. For broader Google access (Calendar, Drive, Docs) see the Google Workspace page.',
      },
      {
        q: 'Can an AI agent send email from my Gmail?',
        a: 'Yes, if the server has the Gmail send scope. Keep manual approval on for send tools, since an agent that reads untrusted email can be steered by instructions hidden in a message.',
      },
      {
        q: 'How does a Gmail MCP server authenticate?',
        a: 'Through Google OAuth. You create OAuth credentials in a Google Cloud project, authorize the server once in the browser, and it stores a refresh token locally.',
      },
    ],
    relatedTopicSlugs: ['google-workspace', 'communication'],
  },
  {
    slug: 'redis',
    match: ['redis', 'valkey'],
    title: 'Redis',
    lead: 'The best MCP servers for Redis — let AI agents inspect keys, query data structures, and use Redis as fast memory or a vector store.',
    guidance: [
      'Redis MCP servers are used two ways: as an admin and inspection tool for an existing Redis deployment, or as a memory and vector-search backend for the agent itself. Check which one a server is built for before installing it.',
      'Commands such as FLUSHALL or KEYS on a large production instance can cause outages. Point agents at a replica or a dedicated database number, and use a Redis ACL user limited to the commands and key patterns they need.',
    ],
    faq: [
      {
        q: 'What is the best Redis MCP server?',
        a: "This page ranks Redis MCP servers by real usage across the AllMCPs directory. Decide first whether you want to inspect an existing Redis instance or use Redis as the agent's memory store.",
      },
      {
        q: 'Is it safe to connect an AI agent to production Redis?',
        a: 'Only with a restricted ACL user. Limit the commands (block FLUSHALL, FLUSHDB, and KEYS) and key patterns the user can touch, or connect to a read replica instead.',
      },
      {
        q: 'Can Redis be used as memory for an AI agent via MCP?',
        a: 'Yes. Several servers store conversation facts or embeddings in Redis and expose tools to save and recall them, using Redis vector search for semantic lookup.',
      },
    ],
    relatedTopicSlugs: ['databases', 'memory-knowledge'],
  },
  {
    slug: 'cloudflare',
    match: ['cloudflare'],
    title: 'Cloudflare',
    lead: 'The best MCP servers for Cloudflare — manage Workers, KV, R2, D1, DNS, and analytics from an AI agent, or deploy your own remote MCP server on Cloudflare.',
    guidance: [
      'This category mixes two things: servers that manage your Cloudflare account (Workers, DNS, storage, logs) and MCP servers that are simply hosted on Cloudflare Workers. If you want to operate Cloudflare from an agent, filter for servers that use the Cloudflare API.',
      'Create a scoped API token for the specific zones and products the agent needs rather than using the global API key, which grants full account access.',
    ],
    faq: [
      {
        q: 'What is the best Cloudflare MCP server?',
        a: 'This page ranks Cloudflare-related MCP servers by real usage across the AllMCPs directory, including account-management servers and servers deployed on Cloudflare Workers.',
      },
      {
        q: 'Can I host my own MCP server on Cloudflare Workers?',
        a: 'Yes. Workers support remote MCP servers over streamable HTTP with OAuth. See the deploy guide on AllMCPs for a step-by-step walkthrough.',
      },
      {
        q: 'What API token does a Cloudflare MCP server need?',
        a: 'A scoped API token with only the permissions for the zones and products the agent will manage. Avoid the global API key, which grants access to the whole account.',
      },
    ],
    relatedTopicSlugs: ['cloud'],
  },
  {
    slug: 'supabase',
    match: ['supabase'],
    title: 'Supabase',
    lead: 'The best MCP servers for Supabase — let AI agents query Postgres, manage tables and migrations, and work with Supabase projects from your editor.',
    guidance: [
      'Supabase servers range from project-management tools (create projects, run migrations, fetch logs) to plain SQL access against the project database. Connect development projects first: an agent that can run migrations can also drop tables.',
      'Most servers support a read-only mode and project scoping — turn both on unless the task needs writes, and never hand an agent the service_role key for a production project.',
    ],
    faq: [
      {
        q: 'What is the best Supabase MCP server?',
        a: 'This page ranks Supabase MCP servers by real usage across the AllMCPs directory. For generic Postgres access without Supabase-specific tools, see the PostgreSQL page.',
      },
      {
        q: 'Can an AI agent run Supabase migrations?',
        a: 'Yes, with a server that uses the Supabase Management API and a personal access token. Use it against a development branch or project and review migrations before applying them to production.',
      },
      {
        q: 'Should I give an MCP server my Supabase service_role key?',
        a: 'Not for production. The service_role key bypasses row-level security. Prefer read-only mode, a scoped access token, or a restricted database role.',
      },
    ],
    relatedTopicSlugs: ['postgres', 'databases'],
  },
  {
    slug: 'confluence',
    match: ['confluence'],
    title: 'Confluence',
    lead: 'The best MCP servers for Confluence — let AI agents search, read, and update Confluence spaces and pages alongside Jira.',
    faq: [
      {
        q: 'What is the best Confluence MCP server?',
        a: 'This page ranks Confluence MCP servers by real usage across the AllMCPs directory. Many also cover Jira, which is useful if your team documents work next to tickets.',
      },
      {
        q: 'How do I connect an AI agent to Confluence?',
        a: 'Create an Atlassian API token (or use OAuth where the server supports it) and pass it with your site URL and email to the server via environment variables.',
      },
      {
        q: 'Can the agent edit Confluence pages?',
        a: 'Servers with write tools can create and update pages using your account permissions. Use an account limited to the spaces the agent should change.',
      },
    ],
    relatedTopicSlugs: ['jira', 'workplace-productivity'],
  },
  {
    slug: 'bigquery',
    match: ['bigquery'],
    title: 'BigQuery',
    lead: 'The best MCP servers for Google BigQuery — let AI agents explore datasets, inspect schemas, and run SQL against your data warehouse.',
    guidance: [
      'BigQuery bills by bytes scanned, so an agent writing exploratory queries can get expensive. Prefer servers that dry-run queries or cap maximum bytes billed, and point them at partitioned tables.',
      'Use a service account with BigQuery Data Viewer and Job User roles on specific datasets instead of project-wide editor access.',
    ],
    faq: [
      {
        q: 'What is the best BigQuery MCP server?',
        a: 'This page ranks BigQuery MCP servers by real usage across the AllMCPs directory. Prefer servers that support dry runs or byte limits to keep query costs predictable.',
      },
      {
        q: 'How do I limit BigQuery costs when an agent runs queries?',
        a: 'Set a maximum bytes billed limit, give the service account access only to needed datasets, and use a server that dry-runs queries to estimate cost before executing.',
      },
      {
        q: 'What credentials does a BigQuery MCP server need?',
        a: 'Usually a Google Cloud service account key or application default credentials, with read and job-run roles on the datasets the agent should query.',
      },
    ],
    relatedTopicSlugs: ['data-platforms', 'databases'],
  },
  {
    slug: 'n8n',
    match: ['n8n'],
    title: 'n8n',
    lead: 'The best MCP servers for n8n — trigger and manage n8n workflows from AI agents, or expose your automations as MCP tools.',
    faq: [
      {
        q: 'What is the best n8n MCP server?',
        a: 'This page ranks n8n MCP servers by real usage across the AllMCPs directory, including servers that manage workflows and servers that turn workflows into agent tools.',
      },
      {
        q: 'Can n8n act as an MCP server?',
        a: 'Yes. n8n has an MCP Server Trigger node that exposes a workflow as tools MCP clients can call, and community servers add workflow management through the n8n API.',
      },
      {
        q: 'Do I need an n8n API key?',
        a: "Servers that list, create, or run workflows through the n8n API need an API key from your n8n instance settings. Workflows exposed through the MCP trigger node use that node's own authentication.",
      },
    ],
    relatedTopicSlugs: ['workplace-productivity'],
  },
  {
    slug: 'salesforce',
    match: ['salesforce'],
    title: 'Salesforce',
    lead: 'The best MCP servers for Salesforce — let AI agents query records with SOQL, update opportunities and contacts, and inspect org metadata.',
    faq: [
      {
        q: 'What is the best Salesforce MCP server?',
        a: 'This page ranks Salesforce MCP servers by real usage across the AllMCPs directory. Compare them on whether they support SOQL queries, record writes, and metadata or Apex tools.',
      },
      {
        q: 'How do I connect an AI agent to Salesforce?',
        a: "Most servers authenticate with a connected app (OAuth) or the Salesforce CLI's stored org credentials. Use an integration user with a permission set limited to the objects the agent needs.",
      },
      {
        q: 'Can an agent update Salesforce records?',
        a: 'Yes, if the server has write tools and the user has edit permission. Test in a sandbox org first and keep human review for bulk updates.',
      },
    ],
    relatedTopicSlugs: ['customer-data-platforms'],
  },
  {
    slug: 'terraform',
    match: ['terraform', 'opentofu'],
    title: 'Terraform',
    lead: 'The best MCP servers for Terraform — give AI agents provider documentation, module search, and plan/state context for infrastructure as code.',
    guidance: [
      'The safest Terraform servers give the agent documentation and registry lookups so it writes correct HCL, while you keep running plan and apply yourself. Servers that run apply let an agent change real infrastructure, so gate them behind manual approval.',
    ],
    faq: [
      {
        q: 'What is the best Terraform MCP server?',
        a: 'This page ranks Terraform MCP servers by real usage across the AllMCPs directory. Registry and documentation servers are the most common and lowest-risk starting point.',
      },
      {
        q: 'Should an AI agent run terraform apply?',
        a: 'Only with manual approval. Let the agent write HCL and read plan output, and keep the apply step with a human or a CI pipeline that requires review.',
      },
      {
        q: 'Does a Terraform MCP server need cloud credentials?',
        a: 'Documentation and registry servers need none. Servers that run plan or read state need the same provider credentials Terraform itself uses.',
      },
    ],
    relatedTopicSlugs: ['cloud', 'aws'],
  },
];

export const BEST_TOPICS: BestTopic[] = [...CATEGORY_TOPICS, ...KEYWORD_TOPICS];

export function bestTopicBySlug(slug: string): BestTopic | undefined {
  return BEST_TOPICS.find((t) => t.slug === slug);
}

/** Match a listing's stored category label to a /best/{slug} topic, if any. */
export function bestTopicForCategory(category: string): BestTopic | undefined {
  const slug = slugFromCategory(category);
  const byExact = CATEGORY_TOPICS.find((t) => t.categorySlug === slug);
  if (byExact) return byExact;
  return CATEGORY_TOPICS.find((t) => t.slug === slug);
}

/**
 * Whole-word, case-insensitive test that a listing mentions one of `terms`. Whole-word
 * (not substring) so "aws" doesn't match "flaws" and "mongo" doesn't match unrelated text.
 */
function mentionsAny(text: string, terms: string[]): boolean {
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'i').test(text);
}

/**
 * The candidate listings for a topic's ranking: a whole category (category hubs) or every
 * listing mentioning a keyword (integration hubs). Ranking/sorting is left to the caller.
 */
export function selectServersForTopic<
  T extends { name: string; description?: string | null; category: string },
>(topic: BestTopic, servers: T[]): T[] {
  if (topic.match && topic.match.length > 0) {
    return servers.filter((s) =>
      mentionsAny(`${s.name} ${s.description || ''}`, topic.match!),
    );
  }
  const category = topic.categorySlug
    ? categoryFromSlug(topic.categorySlug)
    : undefined;
  return category ? servers.filter((s) => s.category === category) : [];
}

/**
 * Integration hubs (/best/<keyword>) a listing belongs in — the reverse of
 * selectServersForTopic's keyword mode, so every listing that appears in a hub's
 * ranking links back to it. Without this, keyword hubs were only reachable from
 * /best and the sitemap, while their member listings (the pages with the
 * relevant link equity) never pointed at them.
 */
export function keywordTopicsForServer(
  server: { name: string; description?: string | null },
  limit = 3,
): BestTopic[] {
  const text = `${server.name} ${server.description || ''}`;
  return KEYWORD_TOPICS.filter(
    (t) => t.match && t.match.length > 0 && mentionsAny(text, t.match),
  ).slice(0, limit);
}
