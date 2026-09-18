import { ArrowRight, Search, Sparkles, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { CopyBlock } from '@/components/ui/CopyBlock';
import { FaqSection } from '@/components/ui/FaqSection';
import { TableOfContents, type TocItem } from '@/components/ui/TableOfContents';
import { serializeJsonLd } from '@/lib/jsonLd';

export const metadata: Metadata = {
  title: 'Using MCP for SEO & AEO Automation: The Complete Guide',
  description:
    'Master MCP for SEO, AEO, and GEO automation: connect AI agents to Google Search Console, Bing Webmaster, IndexNow, SERP trackers, and technical site auditors.',
  alternates: {
    canonical: 'https://allmcps.com/mcp-for-seo',
  },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Using MCP for SEO & AEO Automation: The Complete Guide | AllMCPs',
    description:
      'Master MCP for SEO, AEO, and GEO automation: connect AI agents to Google Search Console, Bing Webmaster, IndexNow, SERP trackers, and technical site auditors.',
    url: 'https://allmcps.com/mcp-for-seo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Using MCP for SEO & AEO Automation: The Complete Guide | AllMCPs',
    description:
      'Master MCP for SEO, AEO, and GEO automation: connect AI agents to Google Search Console, Bing Webmaster, IndexNow, SERP trackers, and technical site auditors.',
  },
};

const faqs = [
  {
    q: 'What is MCP for SEO and how does it work?',
    a: 'Model Context Protocol (MCP) connects AI clients (Claude Desktop, Cursor, Windsurf, Claude Code, Goose) directly to SEO data sources and tools via standardized JSON-RPC protocols. Instead of manually exporting CSVs from Google Search Console, running desktop crawlers, or switching browser tabs, an AI agent with SEO MCP servers can programmatically inspect URL indexation, query search impressions, run ephemeral DOM audits, validate llms.txt, and submit URLs via IndexNow inside a single reasoning loop.',
  },
  {
    q: 'Can MCP servers automate Google Search Console (GSC) indexing and inspection?',
    a: 'Yes. MCP servers like gsc-indexer-mcp, seo-stack-mcp, and climbpast use the official Google Search Console API. Agents can query live index status, identify unindexed URLs in sitemaps, pull ranking query performance by landing page, and trigger indexing requests directly from your chat prompt or IDE terminal.',
  },
  {
    q: 'What is AEO / GEO and how do MCP servers help optimize for AI search engines?',
    a: 'AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization) focus on getting your content cited and synthesized by AI models like Perplexity, ChatGPT Search, Claude, Gemini, and Google AI Overviews. MCP servers like aeo-mcp, llmscout, and aiseo-audit analyze robot permissions for AI crawlers (GPTBot, ClaudeBot, PerplexityBot), test your site’s llms.txt and llms-full.txt files, validate Schema.org JSON-LD entity graphs, and score content information density for LLM ingestion.',
  },
  {
    q: 'How does IndexNow integration work with MCP servers?',
    a: 'IndexNow is an open protocol supported by Bing, Yandex, Seznam, and Naver that instantly notifies search engines whenever content is published, updated, or deleted. MCP servers such as index-now-ru, seo-monster, and seo-stack-mcp enable your agent or CI/CD workflow to post URL payloads immediately after publishing a new markdown guide or blog post, bypassing days of waiting for organic crawler discovery.',
  },
  {
    q: 'What credentials and permissions do I need to connect GSC and Bing Webmaster via MCP?',
    a: 'For Google Search Console, you need either an OAuth 2.0 Client ID or a Google Cloud Service Account with delegated Search Console access. For read-only analysis, scope your permissions to https://www.googleapis.com/auth/webmasters.readonly. For IndexNow and Bing Webmaster, you generate an API key and host a simple verification text file in your root domain directory.',
  },
  {
    q: 'Are SEO MCP servers safe to use in agentic coding environments like Cursor or Windsurf?',
    a: 'Yes, provided you follow least-privilege credential practices. Run local stdio servers, store OAuth credentials in environment variables rather than plaintext config files, and scope write actions (such as publishing sitemaps or altering DNS/robots.txt) with human-in-the-loop confirmation before execution.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.a,
    },
  })),
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'Using MCP for SEO & AEO Automation: The Complete Guide',
  description:
    'Master MCP for SEO, AEO, and GEO automation: connect AI agents to Google Search Console, Bing Webmaster, IndexNow, SERP trackers, and technical site auditors.',
  author: { '@type': 'Organization', name: 'Jackalope Digital LLC' },
  publisher: { '@type': 'Organization', name: 'AllMCPs' },
  isPartOf: {
    '@type': 'CollectionPage',
    name: 'MCP Guides',
    '@id': 'https://allmcps.com/guides',
  },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Guides',
      item: 'https://allmcps.com/guides',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'MCP for SEO & AEO',
      item: 'https://allmcps.com/mcp-for-seo',
    },
  ],
};

const tocItems: TocItem[] = [
  { id: 'why-mcp-for-seo', text: 'Why MCP changes SEO & AEO' },
  { id: 'gsc-automation', text: 'Google Search Console (GSC) automation' },
  { id: 'bing-indexnow', text: 'Bing Webmaster & IndexNow instant push' },
  { id: 'technical-audits', text: 'Technical SEO audits & ephemeral crawling' },
  {
    id: 'aeo-geo-readiness',
    text: 'AEO & GEO (AI answer engine optimization)',
  },
  {
    id: 'serp-intelligence',
    text: 'Live SERP intelligence & competitive research',
  },
  { id: 'directory-spotlight', text: 'Top SEO & AEO servers in the directory' },
  { id: 'config-blueprint', text: 'Config blueprint (Claude & Cursor)' },
  { id: 'agent-workflows', text: '5 ready-to-use agent SEO prompts' },
  { id: 'security-best-practices', text: 'Security, scopes & rate limits' },
  { id: 'faq', text: 'FAQ' },
];

const featuredSeoServers = [
  {
    id: 'seo-stack-mcp',
    name: 'SEO Stack MCP',
    badge: 'All-in-One Suite',
    description:
      'Unified MCP server integrating Google Search Console, GA4, Bing Webmaster Tools, and Microsoft Clarity with built-in analytical routines.',
    category: 'Marketing & SEO',
    tags: ['GSC', 'Bing', 'GA4', 'Clarity'],
  },
  {
    id: 'gsc-indexer-mcp',
    name: 'GSC Indexer MCP',
    badge: 'Indexing Specialist',
    description:
      'Search Console automation for agents: inspect URL index status, uncover unindexed sitemap URLs, pull striking distance keywords, and request indexing.',
    category: 'Search & Data Extraction',
    tags: ['Google Search Console', 'Indexing', 'Sitemaps'],
  },
  {
    id: 'aeo-mcp',
    name: 'AEO MCP',
    badge: 'AI Engine Visibility',
    description:
      'Specialized agent tools for Answer Engine Optimization: verify crawler permissions (GPTBot, ClaudeBot), test llms.txt, and audit Schema.org JSON-LD.',
    category: 'Security & Optimization',
    tags: ['AEO', 'GEO', 'llms.txt', 'Schema.org'],
  },
  {
    id: 'librecrawl-technical-seo-audit-mcp-server',
    name: 'Librecrawl Technical SEO',
    badge: 'Self-Hosted Auditor',
    description:
      'Fast, ephemeral technical site auditing with 50+ automated checks: status codes, redirect loops, canonical links, robots.txt, and WAF detection.',
    category: 'Security & Audits',
    tags: ['Technical SEO', 'Site Audit', 'Crawler'],
  },
  {
    id: 'seo-monster',
    name: 'SEO Monster',
    badge: 'Multi-Channel Engine',
    description:
      'Comprehensive SEO tool suite spanning Search Console, GA4, PageSpeed Insights, Cloudflare, CrUX Core Web Vitals, and IndexNow.',
    category: 'Cloud Platforms',
    tags: ['PageSpeed', 'CrUX', 'Cloudflare', 'IndexNow'],
  },
  {
    id: 'llmscout',
    name: 'LLMScout',
    badge: 'Zero-Config GEO',
    description:
      'Zero-configuration SEO and GEO engine checker with 21 technical and generative engine checks for live websites.',
    category: 'Marketing',
    tags: ['GEO', 'Perplexity', 'ChatGPT', 'Audits'],
  },
  {
    id: 'climbpast',
    name: 'Climbpast',
    badge: 'Analytics & GTM',
    description:
      'Read and edit Google Analytics 4, Search Console, and Google Tag Manager across 29 specialized MCP tools.',
    category: 'Developer Tools',
    tags: ['GA4', 'GSC', 'GTM', '29 Tools'],
  },
  {
    id: 'sistrix-seo-toolbox',
    name: 'SISTRIX SEO Toolbox',
    badge: 'Market Intelligence',
    description:
      'Curated SISTRIX tools: domain visibility indexes, keyword rankings, backlink analysis, and AI visibility metrics.',
    category: 'Marketing',
    tags: ['SISTRIX', 'Backlinks', 'Keywords', 'SERP'],
  },
];

export default function McpForSeoPage() {
  return (
    <main className="page-shell page-shell--default">
      <div className="page-shell-inner">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(breadcrumbJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
        />
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
          <div className="surface page-panel min-w-0">
            <nav
              aria-label="Breadcrumb"
              style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}
            >
              <Link href="/guides" style={{ color: 'var(--text-secondary)' }}>
                Guides
              </Link>
              <span
                style={{ color: 'var(--text-secondary)', margin: '0 0.4rem' }}
              >
                /
              </span>
              <span style={{ color: 'var(--text-primary)' }}>
                MCP for SEO &amp; AEO
              </span>
            </nav>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
              }}
            >
              <Badge variant="verified">Pillar Guide</Badge>
              <Badge variant="official">Search &amp; AI Visibility</Badge>
            </div>

            <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
              Using MCP for SEO, AEO &amp; Webmaster Automation
            </h1>

            <p className="text-lead" style={{ marginBottom: '2rem' }}>
              Connect AI agents in Claude, Cursor, Windsurf, and Claude Code
              directly to Google Search Console, Bing Webmaster Tools, IndexNow,
              technical site crawlers, and AI-readiness auditors. Turn tedious
              manual SEO workflows into autonomous agent loops.
            </p>

            {/* Mobile Table of Contents */}
            <div className="lg:hidden">
              <TableOfContents items={tocItems} />
            </div>

            <div className="markdown-body">
              <h2 id="why-mcp-for-seo">
                Why MCP changes SEO, AEO, and Webmaster operations
              </h2>
              <p>
                Traditional SEO workflows have long been fragmented.
                Practitioners jump between Google Search Console tabs,
                third-party rank trackers, desktop crawlers (like Screaming
                Frog), spreadsheets, and CMS backends. When traffic drops or a
                new pillar guide launches, diagnosing the issue requires
                manually pulling query logs, checking server response headers,
                inspecting DOM canonical tags, and checking whether AI search
                crawlers can digest the content.
              </p>
              <p>
                The <strong>Model Context Protocol (MCP)</strong> turns this
                multi-step manual chore into a unified, agentic execution
                pipeline. By connecting an MCP client (such as Claude Desktop,
                Claude Code, Cursor IDE, Windsurf, or custom agent runtimes) to
                specialized SEO servers, your agent can:
              </p>
              <ul>
                <li>
                  <strong>Read real-time search performance data</strong>{' '}
                  directly from Google Search Console, Bing Webmaster, and GA4
                  APIs without exporting CSV files.
                </li>
                <li>
                  <strong>Run live, ephemeral technical audits</strong> checking
                  status codes, redirect chains, canonical tags, hreflang
                  annotations, and schema markup before and after code deploys.
                </li>
                <li>
                  <strong>Automate instant indexing signals</strong> by
                  dispatching IndexNow payloads and GSC inspection requests as
                  part of your CI/CD or content publishing build scripts.
                </li>
                <li>
                  <strong>
                    Optimize for Answer Engine Optimization (AEO) and Generative
                    Engine Optimization (GEO)
                  </strong>{' '}
                  &mdash; ensuring your <code>llms.txt</code>, structured
                  schema, and entity relationships are primed for Perplexity,
                  ChatGPT Search, Claude, and Google AI Overviews.
                </li>
              </ul>

              <h2 id="gsc-automation">
                Google Search Console (GSC) automation via MCP
              </h2>
              <p>
                Google Search Console is the authoritative ground truth for
                organic search performance on Google. With MCP servers like{' '}
                <Link href="/mcp/gsc-indexer-mcp">
                  <strong>gsc-indexer-mcp</strong>
                </Link>
                ,{' '}
                <Link href="/mcp/seo-stack-mcp">
                  <strong>seo-stack-mcp</strong>
                </Link>
                , and{' '}
                <Link href="/mcp/climbpast">
                  <strong>climbpast</strong>
                </Link>
                , agents can query Search Console data programmatically.
              </p>

              <h3>1. Programmatic URL Inspection &amp; Index Status</h3>
              <p>
                Instead of pasting URLs one by one into the Search Console web
                interface, an MCP-connected agent can iterate through your
                entire XML sitemap, execute the <code>inspect_url</code> tool,
                and report:
              </p>
              <ul>
                <li>
                  Index coverage state (<code>INDEXED</code>,{' '}
                  <code>DISCOVERED_NOT_INDEXED</code>,{' '}
                  <code>CRAWLED_NOT_INDEXED</code>).
                </li>
                <li>
                  Last crawl timestamp and crawler agent (Googlebot Desktop vs.
                  Smartphone).
                </li>
                <li>
                  Canonical declaration mismatches (User-declared canonical vs.
                  Google-selected canonical).
                </li>
                <li>Mobile usability and rich result qualification.</li>
              </ul>

              <h3>
                2. Identifying &ldquo;Striking Distance&rdquo; Ranking
                Opportunities
              </h3>
              <p>
                A high-ROI SEO workflow for agents is discovering queries
                ranking in positions <strong>4 through 15</strong> with high
                impressions but low click-through rates (CTR). An agent with GSC
                MCP tools can pull query performance grouped by URL, calculate
                the CTR curve gap, read the target page&rsquo;s markdown or
                source code, and directly generate title tag improvements,
                section expansions, and FAQ additions to push rankings onto the
                podium.
              </p>

              <h2 id="bing-indexnow">
                Bing Webmaster Tools &amp; IndexNow instant push
              </h2>
              <p>
                While Google remains dominant for traditional organic queries,
                Microsoft Bing powers Bing Search, Windows Copilot, and
                significant portions of AI-assistant citations. The{' '}
                <strong>IndexNow</strong> protocol enables webmasters to
                instantly notify Bing, Yandex, Seznam, and Naver whenever URLs
                are created, modified, or deleted.
              </p>

              <div
                className="surface"
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  borderLeft: '4px solid var(--accent-color)',
                  marginBottom: '1.5rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 700,
                    marginBottom: '0.35rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Zap size={18} style={{ color: 'var(--accent-color)' }} /> Why
                  IndexNow matters for AI discovery
                </div>
                <p
                  style={{
                    fontSize: '0.925rem',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  Modern AI answer engines need real-time data. Rather than
                  waiting days for search bots to discover your updated sitemap,
                  an MCP server using IndexNow (such as{' '}
                  <Link href="/mcp/index-now-ru">
                    <strong>index-now-ru</strong>
                  </Link>{' '}
                  or{' '}
                  <Link href="/mcp/seo-monster">
                    <strong>seo-monster</strong>
                  </Link>
                  ) notifies search engine APIs within seconds of publishing.
                </p>
              </div>

              <h3>IndexNow Setup with MCP</h3>
              <ol>
                <li>
                  Generate an IndexNow API Key (a 32-character hexadecimal
                  string).
                </li>
                <li>
                  Host the key verification file at your domain root (e.g.{' '}
                  <code>https://example.com/&lt;apiKey&gt;.txt</code>).
                </li>
                <li>Pass the API key to your IndexNow MCP server.</li>
                <li>
                  Instruct your agent to submit updated URLs immediately
                  whenever content changes.
                </li>
              </ol>

              <h2 id="technical-audits">
                Technical SEO audits &amp; ephemeral crawling
              </h2>
              <p>
                Catching technical SEO regressions before they ship to
                production is one of the highest leverage uses of MCP inside
                development environments like Cursor and Windsurf. Tools like{' '}
                <Link href="/mcp/librecrawl-technical-seo-audit-mcp-server">
                  <strong>librecrawl-technical-seo-audit-mcp-server</strong>
                </Link>
                ,{' '}
                <Link href="/mcp/websiteiq">
                  <strong>websiteiq</strong>
                </Link>
                , and{' '}
                <Link href="/mcp/pagelens-ai">
                  <strong>pagelens-ai</strong>
                </Link>{' '}
                expose headless, zero-install auditing tools directly to the
                model.
              </p>

              <h3>What Technical MCP Servers Check Automatically</h3>
              <ul>
                <li>
                  <strong>Status Codes &amp; Redirect Chains:</strong>{' '}
                  Identifies 301/302 hops, 404 broken internal links, and 500
                  server errors across your site.
                </li>
                <li>
                  <strong>Robots.txt &amp; Meta Directives:</strong> Verifies
                  that <code>noindex</code>, <code>nofollow</code>, or disallow
                  rules do not accidentally block search engines or AI agents
                  from indexing key content.
                </li>
                <li>
                  <strong>Canonical Hygiene:</strong> Flags relative vs.
                  absolute canonical URLs, self-referencing canonicals, and
                  duplicate title/H1 tags.
                </li>
                <li>
                  <strong>Schema.org JSON-LD Validation:</strong> Extracts and
                  parses embedded JSON-LD scripts to ensure syntax compliance
                  with Schema.org standards (such as <code>TechArticle</code>,{' '}
                  <code>FAQPage</code>, <code>BreadcrumbList</code>, and{' '}
                  <code>Product</code>).
                </li>
                <li>
                  <strong>Core Web Vitals &amp; CrUX Metrics:</strong>{' '}
                  Integrates with Chrome User Experience (CrUX) and PageSpeed
                  data via servers like{' '}
                  <Link href="/mcp/seo-monster">
                    <strong>seo-monster</strong>
                  </Link>{' '}
                  to report real-world LCP, INP, and CLS scores.
                </li>
              </ul>

              <h2 id="aeo-geo-readiness">
                AEO &amp; GEO: Optimizing for AI answer engines
              </h2>
              <p>
                Search behavior has evolved. Users increasingly seek answers
                through{' '}
                <strong>
                  Perplexity, ChatGPT Search, Claude Artifacts, Gemini, and
                  Google AI Overviews
                </strong>
                . This discipline is known as{' '}
                <strong>Answer Engine Optimization (AEO)</strong> and{' '}
                <strong>Generative Engine Optimization (GEO)</strong>.
              </p>

              <h3>
                1. The <code>llms.txt</code> Standard
              </h3>
              <p>
                Just as <code>robots.txt</code> directs search engine crawlers,
                the{' '}
                <a
                  href="https://llmstxt.org"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <code>/llms.txt</code>
                </a>{' '}
                specification provides clean, token-efficient markdown summaries
                of your website designed specifically for Large Language Models.
                MCP servers like{' '}
                <Link href="/mcp/aeo-mcp">
                  <strong>aeo-mcp</strong>
                </Link>{' '}
                and{' '}
                <Link href="/mcp/llmscout">
                  <strong>llmscout</strong>
                </Link>{' '}
                inspect whether your domain serves a valid{' '}
                <code>/llms.txt</code> and <code>/llms-full.txt</code> manifest.
              </p>

              <h3>2. AI Crawler Permissions</h3>
              <p>
                AEO MCP servers test your site against known user-agent strings
                for AI discovery:
              </p>
              <ul>
                <li>
                  <code>GPTBot</code> &amp; <code>OAI-SearchBot</code> (OpenAI /
                  ChatGPT Search)
                </li>
                <li>
                  <code>ClaudeBot</code> (Anthropic)
                </li>
                <li>
                  <code>PerplexityBot</code> (Perplexity AI)
                </li>
                <li>
                  <code>Google-Extended</code> &amp; <code>GoogleOther</code>{' '}
                  (Google Gemini &amp; AI training)
                </li>
                <li>
                  <code>Bytespider</code> &amp; <code>Applebot-Extended</code>
                </li>
              </ul>

              <h3>3. Entity Density &amp; Structured Information Gain</h3>
              <p>
                LLMs prefer authoritative sources with high factual density,
                explicit entity naming (organizations, specifications, RFCs),
                and clean table/bullet hierarchies. Using an AEO MCP server, you
                can audit your content for semantic richness and prompt an agent
                to refine phrasing for maximum synthesis likelihood.
              </p>

              <h2 id="serp-intelligence">
                Live SERP intelligence &amp; competitive research
              </h2>
              <p>
                Beyond first-party site data, agents often need real-time
                competitive intelligence. Servers such as{' '}
                <Link href="/mcp/sistrix-seo-toolbox">
                  <strong>sistrix-seo-toolbox</strong>
                </Link>
                ,{' '}
                <Link href="/mcp/dispatchseo">
                  <strong>dispatchseo</strong>
                </Link>
                , and{' '}
                <Link href="/mcp/xmlriver-mcp">
                  <strong>xmlriver-mcp</strong>
                </Link>{' '}
                allow agents to query search engine result pages (SERPs) without
                manual scraping.
              </p>
              <ul>
                <li>
                  <strong>Featured Snippet &amp; PAA Extraction:</strong> Pulls
                  &ldquo;People Also Ask&rdquo; questions and direct answers for
                  target keywords to generate relevant FAQ sections.
                </li>
                <li>
                  <strong>Competitor Domain Visibility:</strong> Compares domain
                  visibility indexes, keyword overlap, and backlink authority
                  metrics across competing domains.
                </li>
                <li>
                  <strong>Content Gap Analysis:</strong> Identifies high-ranking
                  topics your competitors cover that your site currently lacks.
                </li>
              </ul>

              <h2 id="directory-spotlight">
                Top SEO &amp; AEO MCP servers in the AllMCPs directory
              </h2>
              <p>
                Here are the most popular and verified SEO MCP servers available
                in the <Link href="/best/seo">AllMCPs SEO Directory</Link>:
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem',
                  marginTop: '1.25rem',
                  marginBottom: '2rem',
                }}
              >
                {featuredSeoServers.map((server) => (
                  <div
                    key={server.id}
                    className="surface"
                    style={{
                      padding: '1.25rem',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--accent-color)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {server.badge}
                        </span>
                        <Badge variant="official">{server.category}</Badge>
                      </div>
                      <h3
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          margin: '0 0 0.5rem 0',
                        }}
                      >
                        <Link
                          href={`/mcp/${server.id}`}
                          style={{
                            color: 'var(--text-primary)',
                            textDecoration: 'none',
                          }}
                        >
                          {server.name}
                        </Link>
                      </h3>
                      <p
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.55,
                          margin: '0 0 1rem 0',
                        }}
                      >
                        {server.description}
                      </p>
                    </div>
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                          marginBottom: '0.75rem',
                        }}
                      >
                        {server.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'var(--surface-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <Link
                        href={`/mcp/${server.id}`}
                        className="btn btn-secondary"
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          padding: '0.45rem 0.75rem',
                        }}
                      >
                        <span>View Server &amp; Install</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <Link
                  href="/best/seo"
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Search size={16} />
                  <span>Browse All Ranked SEO &amp; Marketing MCP Servers</span>
                </Link>
              </div>

              <h2 id="config-blueprint">
                Complete client configuration blueprint
              </h2>
              <p>
                Below is a production-ready example configuration connecting an
                all-in-one SEO suite, a dedicated GSC Indexer, an AEO auditor,
                and a technical site crawler.
              </p>

              <h3>
                Claude Desktop Configuration (
                <code>claude_desktop_config.json</code>)
              </h3>
              <p>
                On macOS:{' '}
                <code>
                  ~/Library/Application
                  Support/Claude/claude_desktop_config.json
                </code>
                <br />
                On Windows:{' '}
                <code>%APPDATA%\Claude\claude_desktop_config.json</code>
              </p>

              <CopyBlock
                language="json"
                code={`{
  "mcpServers": {
    "gsc-indexer": {
      "command": "npx",
      "args": ["-y", "gsc-indexer-mcp"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/gsc-service-account.json",
        "SITE_URL": "https://example.com"
      }
    },
    "seo-stack": {
      "command": "npx",
      "args": ["-y", "seo-stack-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-google-oauth-client-id.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "your-google-oauth-client-secret",
        "BING_API_KEY": "your-bing-webmaster-api-key"
      }
    },
    "aeo-audit": {
      "command": "npx",
      "args": ["-y", "aeo-mcp"],
      "env": {
        "TARGET_DOMAIN": "https://example.com"
      }
    },
    "technical-crawler": {
      "command": "npx",
      "args": ["-y", "librecrawl-mcp"]
    }
  }
}`}
              />

              <h3>
                Cursor Configuration (<code>.cursor/mcp.json</code>)
              </h3>
              <CopyBlock
                language="json"
                code={`{
  "mcpServers": {
    "seo-tools": {
      "command": "npx",
      "args": ["-y", "seo-stack-mcp"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "\${env:GOOGLE_GSC_KEY_PATH}",
        "INDEXNOW_KEY": "\${env:INDEXNOW_API_KEY}"
      }
    }
  }
}`}
              />

              <h2 id="agent-workflows">
                5 ready-to-use agent SEO prompts &amp; workflows
              </h2>
              <p>
                Copy and paste these verified prompts into your MCP client to
                trigger autonomous SEO workflows:
              </p>

              <h3>1. Striking-Distance Keyword Booster</h3>
              <CopyBlock
                language="text"
                code={`You are an expert SEO analyst. Use the GSC MCP tools to inspect our site's search query performance over the last 28 days.
1. Identify all queries where our average ranking position is between 4.0 and 15.0 with more than 200 impressions.
2. Group the results by landing page URL.
3. For the top 3 highest-potential URLs, examine their on-page H1, H2s, meta title, and body copy.
4. Provide concrete edits to incorporate the high-impression query entities naturally into the content and suggest an optimized title tag.`}
              />

              <h3>2. Pre-Deploy Technical SEO &amp; Schema Audit</h3>
              <CopyBlock
                language="text"
                code={`Use the technical crawler and audit MCP tools to run a full check against our staging site (http://localhost:3000):
1. Check that all internal links return HTTP 200 with no redirect chains.
2. Verify that canonical links are self-referencing and use absolute HTTPS URLs.
3. Inspect all JSON-LD <script> tags for Schema.org validation errors (TechArticle, FAQPage, BreadcrumbList).
4. Verify that meta robots is set to index,follow and that no critical pages are blocked by robots.txt.`}
              />

              <h3>
                3. AEO &amp; <code>llms.txt</code> Readiness Audit
              </h3>
              <CopyBlock
                language="text"
                code={`Using the AEO MCP tools, audit our domain (https://example.com) for AI search visibility:
1. Verify whether /llms.txt and /llms-full.txt are accessible and formatted to specification.
2. Check our robots.txt rules for GPTBot, ClaudeBot, PerplexityBot, and Google-Extended.
3. Assess the entity density and factual structure of our top 5 landing pages.
4. Output a prioritized list of recommendations to maximize our citation frequency in Perplexity and ChatGPT Search.`}
              />

              <h3>4. Automated Post-Publish IndexNow Push</h3>
              <CopyBlock
                language="text"
                code={`I just published a new article at 'https://example.com/blog/my-new-post'.
1. Validate that the URL returns HTTP 200 and renders proper OpenGraph, Twitter, and canonical tags.
2. Use the IndexNow MCP tool to submit this URL to the IndexNow endpoint for instant Bing, Yandex, and Seznam indexing.
3. Call the GSC inspection tool to check its current status in Google Search Console.`}
              />

              <h3>5. Competitor SERP &amp; Content Gap Analysis</h3>
              <CopyBlock
                language="text"
                code={`Using the SERP intelligence MCP tools, query the top 10 search results for the keyword '[Target Keyword]':
1. Extract all 'People Also Ask' questions and featured snippet content.
2. Analyze the common subheadings (H2/H3) across the top 3 ranking competitor pages.
3. Compare them against our current page draft and identify missing topics, entities, and comparison tables we must add to surpass them.`}
              />

              <h2 id="security-best-practices">
                Security, scopes &amp; API credential hygiene
              </h2>
              <p>
                Because SEO tools interact with sensitive business metrics and
                webmaster settings, keep these security rules in mind:
              </p>
              <ul>
                <li>
                  <strong>Use Read-Only Scopes Where Feasible:</strong> When
                  connecting Google Search Console for analysis, configure the
                  OAuth scope to{' '}
                  <code>
                    https://www.googleapis.com/auth/webmasters.readonly
                  </code>
                  . Reserve full write scope only for instances that manage
                  sitemaps or submit URLs.
                </li>
                <li>
                  <strong>Never Commit Service Account Keys:</strong> Keep{' '}
                  <code>credentials.json</code> and API keys in your local{' '}
                  <code>.env</code> or system environment variables, listed in{' '}
                  <code>.gitignore</code>.
                </li>
                <li>
                  <strong>
                    Enforce Human Confirmation for Destructive Actions:
                  </strong>{' '}
                  If an MCP server exposes tools to delete sitemaps, modify DNS,
                  or update robots.txt rules, configure your client to require
                  explicit user approval before executing the tool call.
                </li>
                <li>
                  <strong>Respect Crawl Rate Limits:</strong> When running local
                  site audits, set reasonable concurrency and delay limits to
                  prevent triggering web application firewalls (WAF) or
                  overwhelming origin servers.
                </li>
              </ul>

              <h2 id="faq">Frequently asked questions</h2>
              <FaqSection items={faqs} renderJsonLd={false} />

              {/* Bottom CTA Card */}
              <div
                className="surface"
                style={{
                  marginTop: '3rem',
                  padding: '2rem',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  background:
                    'linear-gradient(135deg, rgba(53, 37, 230, 0.05), rgba(34, 184, 240, 0.05))',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--accent-color)',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <Sparkles size={18} /> Explore More MCP Guides &amp; Tools
                </div>
                <h3
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Ready to supercharge your SEO agent stack?
                </h3>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    marginBottom: '1.25rem',
                  }}
                >
                  Explore verified MCP servers, configure your IDE with our free
                  tools, or check out related development and deployment guides.
                </p>
                <div
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}
                >
                  <Link href="/best/seo" className="btn btn-primary">
                    <span>Ranked SEO MCP Servers</span>
                    <ArrowRight size={16} />
                  </Link>
                  <Link href="/guides" className="btn btn-secondary">
                    <span>All MCP Guides</span>
                  </Link>
                  <Link
                    href="/tools/config-generator"
                    className="btn btn-secondary"
                  >
                    <span>Config Generator</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Desktop Table of Contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <TableOfContents items={tocItems} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
