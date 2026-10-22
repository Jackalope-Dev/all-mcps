/**
 * The fixed tag vocabulary. Listings are tagged only from this list
 * (lib/tagClassifier.ts), and tag pages exist only for these slugs.
 *
 * Why a closed list: tags used to come from free-form model output, AI use
 * cases turned into slugs, the listing category, and a loose keyword regex.
 * That produced ~24k distinct tags (Oct 2026), nearly all with one or two
 * listings, so no tag page had enough listings to be worth indexing and the
 * /tags page was a crawl sink. Every entry here was checked against the live
 * catalog to have enough listings to be a real page.
 *
 * `hint` is a deliberately generous prefilter on the listing's name,
 * description, summary and tool names: it only decides which tags Jev is
 * asked to confirm, never which tags a listing gets. `definition` is what Jev
 * judges against, so it says what qualifies, not just what the word means.
 */

type TagGroup = 'service' | 'capability' | 'domain' | 'runtime';

export type TagDefinition = {
  slug: string;
  label: string;
  group: TagGroup;
  definition: string;
  /** Candidate prefilter. Runtime tags have none: they come from install data. */
  hint?: RegExp;
};

const service = (
  slug: string,
  label: string,
  hint: RegExp,
  what?: string,
): TagDefinition => ({
  slug,
  label,
  group: 'service',
  hint,
  // Jev reads a list of products as "all of these", so a Google Drive server
  // scored 0.21 against "Drive, Docs, Sheets, Calendar" — say any one counts.
  definition: `Its tools work with ${what ?? label} (its API, an account in it, or its data).${
    what && /,| or /.test(what)
      ? ' Supporting any one of the products named is enough.'
      : ''
  }`,
});

export const TAG_VOCABULARY: TagDefinition[] = [
  // ── Services the server connects to ─────────────────────────────────────
  service(
    'github',
    'GitHub',
    /\bgithub\b/i,
    'the GitHub API (repositories, issues, pull requests or Actions) — not merely code hosted on GitHub',
  ),
  service('gitlab', 'GitLab', /\bgitlab\b/i),
  service('jira', 'Jira', /\bjira\b|\batlassian\b/i),
  service('confluence', 'Confluence', /\bconfluence\b/i),
  service('linear', 'Linear', /\blinear\b/i, 'the Linear issue tracker'),
  service('notion', 'Notion', /\bnotion\b/i),
  service('obsidian', 'Obsidian', /\bobsidian\b/i, 'Obsidian vaults'),
  service('slack', 'Slack', /\bslack\b/i),
  service('discord', 'Discord', /\bdiscord\b/i),
  service('telegram', 'Telegram', /\btelegram\b/i),
  service('whatsapp', 'WhatsApp', /\bwhatsapp\b/i),
  service('gmail', 'Gmail', /\bgmail\b/i),
  service(
    'microsoft-365',
    'Microsoft 365',
    /\bmicrosoft 365\b|\boffice 365\b|\boutlook\b|\bsharepoint\b|\bonedrive\b|\bmicrosoft teams\b|\bms graph\b|\bmicrosoft graph\b/i,
    'Microsoft 365 (Outlook, Teams, SharePoint, OneDrive or the Graph API)',
  ),
  service(
    'google-workspace',
    'Google Workspace',
    /\bgoogle (drive|docs|sheets|slides|workspace|calendar|forms)\b|\bgdrive\b|\bgsuite\b/i,
    'Google Workspace apps (Drive, Docs, Sheets, Calendar)',
  ),
  service('figma', 'Figma', /\bfigma\b/i),
  service('youtube', 'YouTube', /\byoutube\b/i),
  service('x-twitter', 'X (Twitter)', /\btwitter\b|\bx\.com\b|\btweets?\b/i),
  service('reddit', 'Reddit', /\breddit\b|\bsubreddits?\b/i),
  service('linkedin', 'LinkedIn', /\blinkedin\b/i),
  service('instagram', 'Instagram', /\binstagram\b/i),
  service('tiktok', 'TikTok', /\btiktok\b/i),
  service('spotify', 'Spotify', /\bspotify\b/i),
  service('wordpress', 'WordPress', /\bwordpress\b|\bwoocommerce\b/i),
  service('shopify', 'Shopify', /\bshopify\b/i),
  service('stripe', 'Stripe', /\bstripe\b/i),
  service(
    'accounting',
    'QuickBooks & Xero',
    /\bquickbooks\b|\bxero\b|\bfreshbooks\b/i,
    'accounting software such as QuickBooks or Xero',
  ),
  service('postgres', 'PostgreSQL', /\bpostgres(ql)?\b|\bpg\b|\bneon\b/i),
  service('mysql', 'MySQL', /\bmysql\b|\bmariadb\b/i),
  service('sqlite', 'SQLite', /\bsqlite3?\b/i),
  service('mongodb', 'MongoDB', /\bmongo(db)?\b/i),
  service('redis', 'Redis', /\bredis\b|\bvalkey\b/i),
  service('supabase', 'Supabase', /\bsupabase\b/i),
  service(
    'data-warehouse',
    'Data warehouses',
    /\bsnowflake\b|\bbigquery\b|\bdatabricks\b|\bclickhouse\b|\bduckdb\b|\bredshift\b/i,
    'a data warehouse such as Snowflake, BigQuery, Databricks, ClickHouse or DuckDB',
  ),
  service(
    'vector-database',
    'Vector databases',
    /\bvector\b|\bpinecone\b|\bqdrant\b|\bweaviate\b|\bchroma(db)?\b|\bmilvus\b|\bpgvector\b|\blancedb\b/i,
    'a vector database such as Pinecone, Qdrant, Weaviate, Chroma or pgvector',
  ),
  service(
    'aws',
    'AWS',
    /\baws\b|\bamazon web services\b|\bs3\b|\blambda\b|\bbedrock\b/i,
    'Amazon Web Services',
  ),
  service('azure', 'Azure', /\bazure\b/i, 'Microsoft Azure'),
  service(
    'google-cloud',
    'Google Cloud',
    /\bgoogle cloud\b|\bgcp\b|\bfirebase\b|\bfirestore\b|\bvertex\b/i,
    'Google Cloud or Firebase',
  ),
  service('cloudflare', 'Cloudflare', /\bcloudflare\b|\bworkers\b/i),
  service('vercel', 'Vercel', /\bvercel\b/i),
  service(
    'kubernetes',
    'Kubernetes',
    /\bkubernetes\b|\bk8s\b|\bkubectl\b|\bhelm\b/i,
  ),
  service(
    'grafana',
    'Grafana & Prometheus',
    /\bgrafana\b|\bprometheus\b|\bloki\b/i,
    'Grafana, Prometheus or Loki',
  ),
  service(
    'openai',
    'OpenAI',
    /\bopenai\b|\bgpt\b|\bchatgpt\b|\bdall-?e\b/i,
    'the OpenAI API',
  ),
  service('gemini', 'Google Gemini', /\bgemini\b/i, 'the Gemini API'),
  service(
    'local-llm',
    'Local LLMs',
    /\bollama\b|\blocal llms?\b|\blm studio\b|\bllama\.cpp\b|\bvllm\b/i,
    'locally run models (Ollama, LM Studio, llama.cpp)',
  ),

  // ── What the server lets an agent do ────────────────────────────────────
  {
    slug: 'browser-automation',
    label: 'Browser automation',
    group: 'capability',
    hint: /\bbrowser\b|\bplaywright\b|\bpuppeteer\b|\bselenium\b|\bheadless\b|\bchrome\b/i,
    definition:
      'Drives a real or headless web browser: navigating, clicking, filling forms, taking screenshots.',
  },
  {
    slug: 'web-scraping',
    label: 'Web scraping',
    group: 'capability',
    hint: /\bscrap|\bcrawl|\bextract\b|\bfetch\b|\bweb pages?\b|\burls?\b/i,
    definition: 'Fetches web pages and returns or extracts their content.',
  },
  {
    slug: 'web-search',
    label: 'Web search',
    group: 'capability',
    hint: /\bsearch\b|\bbrave\b|\btavily\b|\bserp\b|\bexa\b|\bperplexity\b|\bgoogle\b|\bbing\b/i,
    definition:
      'Searches the public web through a search engine or search API and returns results.',
  },
  {
    slug: 'memory',
    label: 'Agent memory',
    group: 'capability',
    hint: /\bmemor|\bknowledge graph\b|\bremember\b|\bpersistent\b|\bcontext\b/i,
    definition:
      'Its main purpose is storing and recalling information for an agent across sessions (long-term memory or a knowledge graph).',
  },
  {
    slug: 'rag',
    label: 'RAG & semantic search',
    group: 'capability',
    hint: /\brag\b|\bretriev|\bsemantic\b|\bembedding|\bvector\b|\bindex(es|ing)?\b/i,
    definition:
      'Indexes documents and retrieves relevant passages by meaning (embeddings / semantic search) for an agent to ground answers.',
  },
  {
    slug: 'filesystem',
    label: 'File system',
    group: 'capability',
    hint: /\bfile ?system\b|\bfiles?\b|\bdirector(y|ies)\b|\bfolders?\b/i,
    definition:
      'Its tools read, write or manage files and folders the user points it at on their own machine. Saving its own output to disk, or reading a config file, does not count.',
  },
  {
    slug: 'code-execution',
    label: 'Code execution',
    group: 'capability',
    hint: /\bexecut|\brun (code|python|scripts?)\b|\bsandbox|\bjupyter\b|\bnotebook|\brepl\b|\binterpreter\b/i,
    definition:
      'Runs code the agent writes (in a sandbox, notebook, REPL or interpreter) as a main purpose of the server.',
  },
  {
    slug: 'terminal',
    label: 'Terminal & shell',
    group: 'capability',
    hint: /\bterminal\b|\bshell\b|\bcommand(s| line)\b|\bssh\b|\bcli\b|\bbash\b/i,
    definition:
      'Runs shell commands or manages terminal sessions, locally or over SSH.',
  },
  {
    slug: 'git',
    label: 'Git',
    group: 'capability',
    hint: /\bgit\b|\bcommits?\b|\bbranch(es)?\b|\bdiffs?\b/i,
    definition:
      'Works with git repositories directly: commits, branches, diffs, history.',
  },
  {
    slug: 'code-intelligence',
    label: 'Code intelligence',
    group: 'capability',
    hint: /\bcodebase\b|\bcode (search|analysis|intelligence|navigation|review)\b|\blsp\b|\blanguage server\b|\bast\b|\bsymbols?\b|\brefactor/i,
    definition:
      'Understands a codebase: searching code, navigating symbols, analysing or reviewing changes.',
  },
  {
    slug: 'testing',
    label: 'Testing & QA',
    group: 'capability',
    hint: /\btest|\bqa\b|\be2e\b|\bassert/i,
    definition:
      'Writes, runs or reports on software tests (unit, end-to-end, QA).',
  },
  {
    slug: 'docs-lookup',
    label: 'Docs lookup',
    group: 'capability',
    hint: /\bdocs\b|\bdocumentation\b|\breference\b|\bapi docs\b/i,
    definition:
      'Looks up library, framework or API documentation for the agent to read.',
  },
  {
    slug: 'api-integration',
    label: 'API integration',
    group: 'capability',
    hint: /\bopenapi\b|\bswagger\b|\bgraphql\b|\brest\b|\bhttp requests?\b|\bpostman\b/i,
    definition:
      'Turns an arbitrary REST, OpenAPI or GraphQL API into tools, or makes generic HTTP requests.',
  },
  {
    slug: 'image-generation',
    label: 'Image generation',
    group: 'capability',
    hint: /\bimages?\b|\bdall-?e\b|\bstable diffusion\b|\bflux\b|\bmidjourney\b|\billustrat/i,
    definition: 'Generates or edits images with an image model.',
  },
  {
    slug: 'video',
    label: 'Video',
    group: 'capability',
    hint: /\bvideos?\b|\bffmpeg\b|\bclips?\b/i,
    definition:
      'Works with video in any form: generating, editing, downloading, transcribing or analysing it.',
  },
  {
    slug: 'audio',
    label: 'Audio & speech',
    group: 'capability',
    hint: /\baudio\b|\bspeech\b|\btts\b|\bvoice\b|\btranscri|\bwhisper\b|\bmusic\b/i,
    definition:
      'Works with audio in any form: text-to-speech, speech-to-text, voice conversations or music.',
  },
  {
    slug: 'documents',
    label: 'PDFs & Office docs',
    group: 'capability',
    hint: /\bpdf\b|\bdocx\b|\bword\b|\bpowerpoint\b|\bpptx\b|\bexcel\b|\bxlsx\b|\bspreadsheets?\b|\bdocuments?\b/i,
    definition:
      'Reads, creates or converts document files. Any one format counts: PDF, Word, Excel/spreadsheet files or PowerPoint.',
  },
  {
    slug: 'maps',
    label: 'Maps & location',
    group: 'capability',
    hint: /\bmaps?\b|\bgeocod|\bgeospatial\b|\bgis\b|\bopenstreetmap\b|\blocation\b|\broutes?\b|\bplaces\b/i,
    definition:
      'Works with maps, places, geocoding, routing or geospatial data.',
  },
  {
    slug: 'weather',
    label: 'Weather',
    group: 'capability',
    hint: /\bweather\b|\bforecast\b|\bclimate\b/i,
    definition: 'Provides weather forecasts or climate data.',
  },
  {
    slug: 'observability',
    label: 'Observability',
    group: 'capability',
    hint: /\bobservab|\bmonitor|\blogs?\b|\btrac(e|es|ing)\b|\bmetrics\b|\balerts?\b|\bincidents?\b|\bsentry\b|\bdatadog\b/i,
    definition:
      'Queries logs, metrics, traces, alerts or incidents from a monitoring system.',
  },
  {
    slug: 'ci-cd',
    label: 'CI/CD & deployment',
    group: 'capability',
    hint: /\bci\b|\bcd\b|\bdeploy|\bpipelines?\b|\bgithub actions\b|\bjenkins\b|\bbuilds?\b|\brelease/i,
    definition: 'Runs or manages build pipelines, deployments or releases.',
  },
  {
    slug: 'infrastructure',
    label: 'Infrastructure as code',
    group: 'capability',
    hint: /\bterraform\b|\bpulumi\b|\bopentofu\b|\binfrastructure\b|\bansible\b|\bcloudformation\b/i,
    definition:
      'Works with infrastructure-as-code tooling. Any one counts: Terraform, OpenTofu, Pulumi, Ansible or CloudFormation — planning, applying, or looking up providers and modules.',
  },
  {
    slug: 'security',
    label: 'Security scanning',
    group: 'capability',
    hint: /\bsecurity\b|\bvulnerab|\bcve\b|\bpentest|\bscan|\bthreat\b|\bmalware\b|\bsast\b/i,
    definition:
      'Finds vulnerabilities, scans code or systems, or provides threat intelligence.',
  },
  {
    slug: 'agent-orchestration',
    label: 'Agent orchestration',
    group: 'capability',
    hint: /\bagents?\b|\bsubagent|\ba2a\b|\borchestrat|\bworkflows?\b|\bdelegat/i,
    definition:
      'Coordinates multiple AI agents or delegates tasks between agents.',
  },
  {
    slug: 'mcp-gateway',
    label: 'MCP gateways',
    group: 'capability',
    hint: /\bgateway\b|\bproxy\b|\baggregat|\brouter\b|\bhub\b|\bmulti-server\b/i,
    definition:
      'Combines, proxies or manages many MCP servers or APIs behind one connection or interface.',
  },
  {
    slug: 'automation',
    label: 'Workflow automation',
    group: 'capability',
    hint: /\bn8n\b|\bzapier\b|\bmake\.com\b|\bautomat|\bifttt\b|\bworkflows?\b/i,
    definition:
      'Triggers or builds automations in a workflow tool such as n8n, Zapier or Make.',
  },
  {
    slug: 'translation',
    label: 'Translation',
    group: 'capability',
    hint: /\btranslat|\blanguages?\b|\blocali[sz]/i,
    definition: 'Translates text between human languages.',
  },

  // ── Subject area ────────────────────────────────────────────────────────
  {
    slug: 'email',
    label: 'Email',
    group: 'domain',
    hint: /\bemails?\b|\bimap\b|\bsmtp\b|\binbox\b|\bmail\b/i,
    definition: 'Reads, sends or manages email.',
  },
  {
    slug: 'calendar',
    label: 'Calendar & scheduling',
    group: 'domain',
    hint: /\bcalendar\b|\bschedul|\bmeetings?\b|\bevents?\b|\bbooking\b/i,
    definition: 'Reads or manages calendars, events or meeting scheduling.',
  },
  {
    slug: 'project-management',
    label: 'Project management',
    group: 'domain',
    hint: /\bprojects?\b|\bissues?\b|\btickets?\b|\btasks?\b|\bkanban\b|\bsprints?\b|\bto-?dos?\b/i,
    definition:
      'Creates or manages tasks, issues, tickets or projects in a tracker.',
  },
  {
    slug: 'crm',
    label: 'CRM & sales',
    group: 'domain',
    hint: /\bcrm\b|\bsales\b|\bleads?\b|\bdeals?\b|\bsalesforce\b|\bhubspot\b|\bpipedrive\b|\bcustomers?\b/i,
    definition: 'Works with customer, lead or deal data in a CRM.',
  },
  {
    slug: 'e-commerce',
    label: 'E-commerce',
    group: 'domain',
    hint: /\be-?commerce\b|\bstores?\b|\bshop\b|\bproducts?\b|\borders?\b|\bcatalog\b|\bamazon\b/i,
    definition: 'Manages an online store: products, orders, inventory.',
  },
  {
    slug: 'payments',
    label: 'Payments & invoicing',
    group: 'domain',
    hint: /\bpayments?\b|\binvoic|\bbilling\b|\bcheckout\b|\bsubscriptions?\b/i,
    definition:
      'Takes payments, issues invoices or manages billing and subscriptions.',
  },
  {
    slug: 'finance',
    label: 'Stocks & market data',
    group: 'domain',
    hint: /\bstocks?\b|\bmarkets?\b|\btrading\b|\bfinanc|\bforex\b|\bportfolio\b|\bsec filings?\b|\bticker/i,
    definition:
      'Provides stock, market or company financial data, or trading tools.',
  },
  {
    slug: 'crypto',
    label: 'Crypto & web3',
    group: 'domain',
    hint: /\bcrypto|\bblockchain\b|\bethereum\b|\bsolana\b|\bbitcoin\b|\bweb3\b|\bdefi\b|\bwallets?\b|\btokens?\b|\bnft/i,
    definition:
      'Works with blockchains, crypto wallets, tokens or DeFi protocols.',
  },
  {
    slug: 'analytics',
    label: 'Web & product analytics',
    group: 'domain',
    hint: /\banalytics\b|\bga4\b|\bposthog\b|\bmixpanel\b|\bamplitude\b|\bplausible\b|\bmatomo\b/i,
    definition:
      'Queries website or product analytics (Google Analytics, PostHog, Mixpanel).',
  },
  {
    slug: 'seo',
    label: 'SEO',
    group: 'domain',
    hint: /\bseo\b|\bsearch console\b|\bkeywords?\b|\bbacklinks?\b|\bserp\b|\bsitemaps?\b/i,
    definition:
      'Supports search engine optimisation: rankings, keywords, backlinks, site audits.',
  },
  {
    slug: 'advertising',
    label: 'Advertising',
    group: 'domain',
    hint: /\bads\b|\badvertis|\bcampaigns?\b|\bgoogle ads\b|\bmeta ads\b|\bppc\b/i,
    definition: 'Manages or reports on ad campaigns.',
  },
  {
    slug: 'social-media',
    label: 'Social media',
    group: 'domain',
    hint: /\bsocial\b|\bposts?\b|\btweets?\b|\binstagram\b|\btiktok\b|\blinkedin\b|\bbluesky\b|\bmastodon\b/i,
    definition:
      'Reads or publishes posts on social networks, or analyses social data.',
  },
  {
    slug: 'news',
    label: 'News & RSS',
    group: 'domain',
    hint: /\bnews\b|\brss\b|\bfeeds?\b|\bheadlines?\b|\bhacker news\b/i,
    definition: 'Fetches news articles, headlines or RSS/Atom feeds.',
  },
  {
    slug: 'research',
    label: 'Academic research',
    group: 'domain',
    hint: /\barxiv\b|\bpubmed\b|\bpapers?\b|\bscholar\b|\bacademic\b|\bcitations?\b|\bresearch\b/i,
    definition:
      'Searches or reads academic papers and scholarly databases (arXiv, PubMed, Semantic Scholar).',
  },
  {
    slug: 'healthcare',
    label: 'Healthcare',
    group: 'domain',
    hint: /\bhealth|\bmedical\b|\bclinical\b|\bfhir\b|\bpatients?\b|\bdrugs?\b|\bfitness\b/i,
    definition: 'Works with medical, clinical, health or fitness data.',
  },
  {
    slug: 'legal',
    label: 'Legal',
    group: 'domain',
    hint: /\blegal\b|\blaws?\b|\bcourt\b|\bcontracts?\b|\bregulat|\bcompliance\b|\bpatents?\b/i,
    definition:
      'Works with laws, regulations, court records, contracts or compliance.',
  },
  {
    slug: 'education',
    label: 'Education',
    group: 'domain',
    hint: /\beducat|\blearning\b|\bcourses?\b|\bstudents?\b|\blms\b|\bcanvas\b|\bmoodle\b|\bquiz/i,
    definition:
      'Supports teaching or learning: courses, students, quizzes, learning platforms.',
  },
  {
    slug: 'game-dev',
    label: 'Games',
    group: 'domain',
    hint: /\bgames?\b|\bunity\b|\bunreal\b|\bgodot\b|\bminecraft\b|\broblox\b|\bsteam\b/i,
    definition:
      'Builds or plays games, or works with a game engine or game platform.',
  },
  {
    slug: '3d-cad',
    label: '3D & CAD',
    group: 'domain',
    hint: /\bblender\b|\b3d\b|\bcad\b|\bfreecad\b|\bautocad\b|\bbim\b|\bmodels?\b/i,
    definition: 'Creates or edits 3D models, CAD drawings or BIM data.',
  },
  {
    slug: 'design',
    label: 'Design & UI',
    group: 'domain',
    hint: /\bdesign\b|\bui\b|\bux\b|\bcomponents?\b|\btailwind\b|\bcss\b|\bcanva\b/i,
    definition:
      'Works on visual or UI design: design files, components, styles.',
  },
  {
    slug: 'mobile-dev',
    label: 'Mobile development',
    group: 'domain',
    hint: /\bios\b|\bandroid\b|\bxcode\b|\bsimulator\b|\bemulator\b|\breact native\b|\bflutter\b|\bmobile\b/i,
    definition:
      'Builds, runs, automates or tests iOS or Android apps, simulators or devices.',
  },
  {
    slug: 'smart-home',
    label: 'Smart home & IoT',
    group: 'domain',
    hint: /\bhome assistant\b|\bsmart home\b|\biot\b|\bmqtt\b|\bdevices?\b|\bsensors?\b/i,
    definition:
      'Controls or reads smart-home or IoT devices (Home Assistant, MQTT).',
  },

  // ── How it runs (from install data, not Jev) ────────────────────────────
  {
    slug: 'python',
    label: 'Python',
    group: 'runtime',
    definition: 'Installs and runs as a Python package (uvx, pip, pipx).',
  },
  {
    slug: 'nodejs',
    label: 'Node.js',
    group: 'runtime',
    definition: 'Installs and runs as an npm package (npx, bunx).',
  },
  {
    slug: 'docker',
    label: 'Docker',
    group: 'runtime',
    definition: 'Runs from a Docker image.',
  },
  {
    slug: 'remote',
    label: 'Remote (hosted)',
    group: 'runtime',
    definition:
      'Hosted MCP endpoint you connect to over HTTP; nothing to install.',
  },
];

const BY_SLUG = new Map(TAG_VOCABULARY.map((t) => [t.slug, t] as const));

export function tagBySlug(slug: string): TagDefinition | undefined {
  return BY_SLUG.get(slug);
}

/** Stored tags that are in the vocabulary, deduped, in input order. */
export function vocabularyTags(raw: unknown): TagDefinition[] {
  if (!Array.isArray(raw)) return [];
  const out: TagDefinition[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const tag = BY_SLUG.get(value.trim().toLowerCase());
    if (tag && !seen.has(tag.slug)) {
      seen.add(tag.slug);
      out.push(tag);
    }
  }
  return out;
}
