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
  {
    slug: 'version-control',
    categorySlug: 'version-control',
    title: 'Git & Version Control',
    lead: 'The best MCP servers for Git and version control — let AI agents read repositories, inspect diffs, manage branches, and open pull requests on GitHub, GitLab, and more.',
    faq: [
      { q: 'What is the best MCP server for GitHub?', a: 'The official GitHub MCP server is the most widely installed — it covers issues, pull requests, code search, and Actions. This page ranks version-control servers by real usage across the AllMCPs directory.' },
      { q: 'Can an MCP server open pull requests for me?', a: 'Yes. GitHub and GitLab MCP servers can create branches, commit files, and open PRs when you grant a token with write scope. Use a fine-grained token limited to the specific repositories the agent should touch.' },
      { q: 'Do I need a personal access token to use a Git MCP server?', a: 'For hosted platforms like GitHub or GitLab, yes — you supply a token via an environment variable. Local Git servers that operate on a checked-out repo on disk usually need no token at all.' },
    ],
  },
  {
    slug: 'workplace-productivity',
    categorySlug: 'workplace-and-productivity',
    title: 'Workplace & Productivity',
    lead: 'The best MCP servers for workplace productivity — connect AI agents to Notion, Google Workspace, calendars, task managers, and the tools your team runs on every day.',
    faq: [
      { q: 'What are the best MCP servers for productivity tools?', a: 'Servers for Notion, Google Workspace, Linear, and calendar apps are the most installed. This page ranks productivity MCP servers by real usage so you can start with proven options.' },
      { q: 'Can an AI agent manage my calendar or tasks over MCP?', a: 'Yes — calendar and task-manager MCP servers let agents read events, create tasks, and update statuses using OAuth or an API key you provide. Prefer read-only scopes until you trust the workflow.' },
      { q: 'Do these work with Claude Desktop and Cursor?', a: 'Yes. MCP is a shared protocol, so every server listed here works with any MCP-compatible client, including Claude Desktop, Claude Code, Cursor, and Windsurf.' },
    ],
  },
  {
    slug: 'marketing',
    categorySlug: 'marketing',
    title: 'Marketing & SEO',
    lead: 'The best MCP servers for marketing and SEO — give AI agents access to analytics, ad platforms, SEO data, email tools, and CRMs to research, report, and automate campaigns.',
    faq: [
      { q: 'What is the best MCP server for marketing?', a: 'The most popular marketing MCP servers connect analytics, SEO data, and ad or email platforms. This page ranks them by real usage across the AllMCPs directory.' },
      { q: 'Can MCP servers pull SEO or analytics data?', a: 'Yes — several wrap analytics and search APIs so an agent can fetch traffic, keyword, and ranking data and turn it into reports. You supply the account credentials or API key.' },
      { q: 'Can an agent send marketing emails through MCP?', a: 'Some email-platform MCP servers support sending, but treat that access carefully — scope the API key narrowly and keep a human in the loop for anything that reaches real recipients.' },
    ],
  },
  {
    slug: 'social-media',
    categorySlug: 'social-media',
    title: 'Social Media',
    lead: 'The best MCP servers for social media — let AI agents read, post, schedule, and analyze content across X, Reddit, LinkedIn, Discord, and other platforms.',
    faq: [
      { q: 'What is the best MCP server for social media?', a: 'It depends on the platform — servers for X, Reddit, and Discord are the most installed. This page ranks social media MCP servers by real usage.' },
      { q: 'Can an AI agent post to social media through MCP?', a: 'Yes, when you provide platform credentials with posting scope. Because posts are public and hard to undo, keep a human approval step for anything an agent publishes.' },
      { q: 'Do social media MCP servers need API keys?', a: 'Almost always — each platform requires its own app credentials or OAuth token, which you set via environment variables. Read-heavy servers may work with lighter, read-only scopes.' },
    ],
  },
  {
    slug: 'research',
    categorySlug: 'research',
    title: 'Research',
    lead: 'The best MCP servers for research workflows — literature search, paper analysis, citation tools, and knowledge synthesis for AI agents.',
    faq: [
      { q: 'What are the best MCP servers for research?', a: 'Research MCP servers cover academic search, paper PDFs, and knowledge graphs. This page ranks them by real usage across AllMCPs.' },
      { q: 'Can an agent cite sources through MCP?', a: 'Yes — several research servers return structured metadata and links so agents can attribute claims. Always verify critical citations yourself.' },
      { q: 'Do research MCP servers need API keys?', a: 'Some wrap paid academic APIs; others work against open indexes. Check each listing for required credentials.' },
    ],
  },
  {
    slug: 'data-platforms',
    categorySlug: 'data-platforms',
    title: 'Data Platforms',
    lead: 'The best MCP servers for data platforms — warehouses, lakes, pipelines, and analytics backends that agents can query and orchestrate safely.',
    faq: [
      { q: 'What MCP servers work with data warehouses?', a: 'Servers for BigQuery, Snowflake, Databricks, and similar platforms are among the most installed. Rankings here reflect directory usage.' },
      { q: 'Is write access common?', a: 'Many default to read-only analytics queries. Prefer least-privilege service accounts and review write modes carefully.' },
      { q: 'How do I choose between warehouse MCP servers?', a: 'Match your platform first, then prefer verified, actively maintained listings with clear install docs on this ranking.' },
    ],
  },
  {
    slug: 'customer-data-platforms',
    categorySlug: 'customer-data-platforms',
    title: 'Customer Data Platforms',
    lead: 'The best MCP servers for CDPs and customer data — profiles, segments, and event streams that marketing and product agents can use responsibly.',
    faq: [
      { q: 'What is the best MCP server for a CDP?', a: 'It depends on your stack (Segment, mParticle, etc.). This page ranks CDP-related MCP servers by usage on AllMCPs.' },
      { q: 'Can agents update customer profiles?', a: 'Some servers allow writes — scope API keys tightly and keep PII policies in mind before enabling write tools.' },
      { q: 'Do these integrate with marketing tools?', a: 'Often yes, via the CDP itself. MCP gives agents a single interface into profiles and events you already store.' },
    ],
  },
  {
    slug: 'legal',
    categorySlug: 'legal',
    title: 'Legal',
    lead: 'The best MCP servers for legal workflows — document review, contract search, and research tools for AI agents with careful access controls.',
    faq: [
      { q: 'What are the best legal MCP servers?', a: 'Legal MCP servers focus on document retrieval, clause search, and matter context. Rankings reflect real directory engagement.' },
      { q: 'Is it safe to put legal documents in an MCP server?', a: 'Use private, access-controlled deployments and never expose privileged materials to untrusted tools or models.' },
      { q: 'Can agents draft contracts through MCP?', a: 'They can retrieve templates and context; final legal work still needs human review. Treat agent output as drafts only.' },
    ],
  },
  {
    slug: 'gaming',
    categorySlug: 'gaming',
    title: 'Gaming',
    lead: 'The best MCP servers for gaming — game APIs, stats, mods, and tooling that agents use to build and automate game-related workflows.',
    faq: [
      { q: 'What MCP servers exist for gaming?', a: 'Servers range from game-stats APIs to engine tooling. This page ranks gaming MCP servers by usage on AllMCPs.' },
      { q: 'Can an agent control a game client via MCP?', a: 'Some automation-oriented servers can, but platform ToS and anti-cheat rules apply — use only where allowed.' },
      { q: 'Do gaming MCP servers need API keys?', a: 'Public stats APIs often need keys; local tooling may not. Check each listing.' },
    ],
  },

  {
    slug: 'data-platforms',
    categorySlug: 'data-platforms',
    title: 'Data Platforms',
    lead: 'The best MCP servers for data platforms — connect AI agents to warehouses, lakes, and analytics engines like Snowflake, BigQuery, and ClickHouse to query and explore data.',
    faq: [
      { q: 'What is the best MCP server for a data warehouse?', a: 'Servers for Snowflake, BigQuery, and ClickHouse are the most widely installed. This page ranks data-platform MCP servers by real usage across the AllMCPs directory.' },
      { q: 'Can an agent run analytics queries safely?', a: 'Yes — connect the server with a read-only role scoped to the datasets the agent should see. Most data-platform servers support parameterized, read-only querying by default.' },
      { q: 'How is this different from a plain database MCP server?', a: 'Database servers target transactional systems like Postgres and MySQL; data-platform servers target analytical warehouses and lakes built for large-scale queries and reporting.' },
    ],
  },
  {
    slug: 'research',
    categorySlug: 'research',
    title: 'Research',
    lead: 'The best MCP servers for research — let AI agents search academic papers, pull references, query knowledge bases, and gather primary sources with citations.',
    faq: [
      { q: 'What is the best MCP server for academic research?', a: 'Servers wrapping arXiv, PubMed, and scholarly search APIs are the most installed. This page ranks research MCP servers by real usage so you can pick a proven one.' },
      { q: 'Can MCP servers return citations, not just summaries?', a: 'Yes — most research servers return structured metadata (title, authors, DOI, and links) alongside content, so an agent can cite primary sources rather than paraphrase them.' },
      { q: 'Do research MCP servers need paid API access?', a: 'Many use free public APIs like arXiv or PubMed; some premium databases require your own subscription key, supplied via an environment variable.' },
    ],
  },
  {
    slug: 'data-science',
    categorySlug: 'data-science-tools',
    title: 'Data Science',
    lead: 'The best MCP servers for data science — give AI agents tools to run notebooks, execute Python, analyze datasets, and generate charts as part of an analysis workflow.',
    faq: [
      { q: 'What are the best MCP servers for data science?', a: 'Servers that run Python, Jupyter, or dataframe operations are the most installed. This page ranks data-science MCP servers by real usage across the AllMCPs directory.' },
      { q: 'Can an MCP server run Python code for analysis?', a: 'Yes — code-execution and notebook MCP servers let an agent run Python in a sandboxed kernel and return results, tables, and plots. Run them in an isolated environment, not against production systems.' },
      { q: 'Can these generate charts and visualizations?', a: 'Several return rendered charts or the data behind them, so an agent can visualize a dataset and hand you back an image or a reproducible script.' },
    ],
  },
  {
    slug: 'code-execution',
    categorySlug: 'code-execution',
    title: 'Code Execution',
    lead: 'The best MCP servers for code execution — let AI agents run code, shell commands, and scripts in sandboxed environments and get results back.',
    faq: [
      { q: 'What is the best MCP server for running code?', a: 'Sandboxed code-execution servers that support Python and JavaScript are the most installed. This page ranks code-execution MCP servers by real usage.' },
      { q: 'Is it safe to let an AI agent execute code?', a: 'Only inside a sandbox. Prefer servers that run code in an isolated container or ephemeral environment, never with direct access to your host, credentials, or production data.' },
      { q: 'Which languages do code-execution MCP servers support?', a: 'Python and JavaScript are the most common; several also handle shell commands or arbitrary languages via a container. Check each listing for the exact runtime.' },
    ],
  },
  {
    slug: 'command-line',
    categorySlug: 'command-line',
    title: 'Command Line & Terminal',
    lead: 'The best MCP servers for the command line — let AI agents run terminal commands, manage processes, and drive CLI tools with scoped, auditable access.',
    faq: [
      { q: 'What is the best MCP server for terminal access?', a: 'Shell and terminal MCP servers that support allow-lists and working-directory limits are the most trusted. This page ranks command-line MCP servers by real usage.' },
      { q: 'How do I stop an agent from running dangerous commands?', a: 'Use a server that supports command allow-lists or confirmation prompts, run it as a low-privilege user, and scope it to a specific working directory. Never grant unrestricted root shell access.' },
      { q: 'Can these run long-running processes?', a: 'Some manage background processes and stream output; others are built for one-shot commands. Check each listing for process-management support.' },
    ],
  },
  {
    slug: 'e-commerce',
    categorySlug: 'e-commerce',
    title: 'E-Commerce',
    lead: 'The best MCP servers for e-commerce — connect AI agents to Shopify, payment processors, and storefront APIs to manage products, orders, and customers.',
    faq: [
      { q: 'What is the best MCP server for e-commerce?', a: 'Servers for Shopify and major payment processors are the most installed. This page ranks e-commerce MCP servers by real usage across the AllMCPs directory.' },
      { q: 'Can an agent manage orders and products over MCP?', a: 'Yes — storefront MCP servers let agents read and update products, inventory, and orders with an API key you provide. Start with read-only scope before allowing writes to live stores.' },
      { q: 'Are payment MCP servers safe to use?', a: 'Use them with restricted, test-mode, or narrowly scoped keys. Never give an agent unrestricted access to a live payments account, and keep a human step for refunds or charges.' },
    ],
  },
  {
    slug: 'legal',
    categorySlug: 'legal',
    title: 'Legal',
    lead: 'The best MCP servers for legal work — give AI agents access to case law, contract analysis, and legal research tools with careful, scoped permissions.',
    faq: [
      { q: 'What are the best MCP servers for legal research?', a: 'Servers wrapping case-law and legal-database APIs are the most installed. This page ranks legal MCP servers by real usage across the AllMCPs directory.' },
      { q: 'Can an MCP server review contracts?', a: 'Some servers extract clauses and structure from contract text so an agent can analyze them, but treat output as a draft aid, not legal advice — keep a qualified reviewer in the loop.' },
      { q: 'Is it safe to send confidential documents to a legal MCP server?', a: 'Only to servers you control or trust with clear data-handling terms. For sensitive matters, prefer self-hosted servers and avoid sending privileged material to third-party APIs.' },
    ],
  },
  {
    slug: 'multimedia',
    categorySlug: 'multimedia-process',
    title: 'Multimedia & Media Processing',
    lead: 'The best MCP servers for multimedia — let AI agents generate, edit, transcribe, and process images, audio, and video through a single protocol.',
    faq: [
      { q: 'What is the best MCP server for image or video processing?', a: 'Servers for image generation, transcription, and media conversion are the most installed. This page ranks multimedia MCP servers by real usage.' },
      { q: 'Can an AI agent transcribe audio through MCP?', a: 'Yes — several servers wrap speech-to-text APIs so an agent can transcribe audio and video, returning timestamps and text you can act on.' },
      { q: 'Do multimedia MCP servers need paid API keys?', a: 'Those backed by commercial generation or transcription APIs need your own key; self-contained tools that use local libraries (for format conversion, for example) usually do not.' },
    ],
  },
  {
    slug: 'gaming',
    categorySlug: 'gaming',
    title: 'Gaming',
    lead: 'The best MCP servers for gaming — connect AI agents to game engines, servers, and platform APIs to build, automate, and interact with games.',
    faq: [
      { q: 'What are the best MCP servers for gaming?', a: 'Servers for game engines and popular platform APIs are the most installed. This page ranks gaming MCP servers by real usage across the AllMCPs directory.' },
      { q: 'Can an AI agent control a game through MCP?', a: 'Some servers expose game state and actions so an agent can read and interact with a running game or engine. Capabilities vary widely — check each listing for what it exposes.' },
      { q: 'Do these work with any MCP client?', a: 'Yes. Because MCP is a shared protocol, gaming servers listed here work with Claude Desktop, Cursor, Windsurf, and any other MCP-compatible client.' },
    ],
  },
  {
    slug: 'location-services',
    categorySlug: 'location-services',
    title: 'Maps & Location',
    lead: 'The best MCP servers for maps and location — let AI agents geocode addresses, get directions, search places, and work with geographic data.',
    faq: [
      { q: 'What is the best MCP server for maps?', a: 'Servers wrapping major mapping and geocoding APIs are the most installed. This page ranks location MCP servers by real usage across the AllMCPs directory.' },
      { q: 'Can an agent get directions or geocode addresses over MCP?', a: 'Yes — location MCP servers expose geocoding, place search, and routing so an agent can turn an address into coordinates or plan a route, using an API key you provide.' },
      { q: 'Do maps MCP servers cost money to use?', a: 'The servers are free, but the mapping APIs they wrap often bill per request beyond a free tier. Supply your own key and watch usage on high-volume workflows.' },
    ],
  },
  {
    slug: 'travel',
    categorySlug: 'travel-and-transportation',
    title: 'Travel & Transportation',
    lead: 'The best MCP servers for travel and transportation — give AI agents access to flight, transit, and booking data to plan trips and answer logistics questions.',
    faq: [
      { q: 'What are the best MCP servers for travel?', a: 'Servers for flight search, transit data, and booking platforms are the most installed. This page ranks travel MCP servers by real usage across the AllMCPs directory.' },
      { q: 'Can an AI agent book travel through MCP?', a: 'Some servers support booking flows, but most focus on search and information. For anything that spends money or reserves seats, keep a human confirmation step.' },
      { q: 'Do travel MCP servers need API keys?', a: 'Usually — flight and booking APIs require provider credentials you set via environment variables. Some public transit servers use open data and need no key.' },
    ],
  },
];

export function bestTopicBySlug(slug: string): BestTopic | undefined {
  return BEST_TOPICS.find((t) => t.slug === slug);
}
