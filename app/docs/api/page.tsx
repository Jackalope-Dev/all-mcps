import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyBlock } from '../../../components/ui/CopyBlock';

export const metadata: Metadata = {
  title: 'Directory API Documentation for MCP Servers',
  description:
    'Public AllMCPs REST API for searching MCP servers, fetching listing markdown, health checks, and badges. Built for AI agents and developer integrations.',
  alternates: { canonical: 'https://allmcps.com/docs/api' },
  openGraph: {
    images: [{ url: 'https://allmcps.com/opengraph-image', width: 1200, height: 630, alt: 'AllMCPs' }],
    title: 'Directory API Documentation for MCP Servers | AllMCPs',
    description:
      'Search MCP servers, fetch markdown docs, and integrate the AllMCPs directory into agents and tools.',
    url: 'https://allmcps.com/docs/api',
  },
};

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/search',
    title: 'Search servers',
    desc: 'Keyword and category search over active listings. Returns install hints with confidence scores.',
    example: 'https://allmcps.com/api/v1/search?q=github&limit=5',
  },
  {
    method: 'GET',
    path: '/api/v1/servers/{id}',
    title: 'Get server by ID',
    desc: 'Single listing with quality score, popularity signals, and public metadata.',
    example: 'https://allmcps.com/api/v1/servers/github-github-mcp-server',
  },
  {
    method: 'GET',
    path: '/api/v1/mcp/{id}/markdown',
    title: 'Markdown detail',
    desc: 'LLM-friendly Markdown for a listing. Also available via Accept: text/markdown on /mcp/{id}.',
    example: 'https://allmcps.com/mcp/github-github-mcp-server.md',
  },
  {
    method: 'GET',
    path: '/api/v1/health',
    title: 'Service health',
    desc: 'Lightweight health probe for monitors and agents.',
    example: 'https://allmcps.com/api/v1/health',
  },
  {
    method: 'GET',
    path: '/api/badge/{id}',
    title: 'SVG badge',
    desc: 'Dynamic badge for READMEs and docs. Use dofollow links when embedding for reciprocal SEO.',
    example: 'https://allmcps.com/api/badge/github-github-mcp-server?style=shield',
  },
  {
    method: 'POST',
    path: '/api/v1/submit',
    title: 'Agent submission',
    desc: 'Submit a new MCP listing programmatically (requires email). Accepts the same optional enrichment fields as the /api/mcp submit_mcp_server tool (tags, license, authType, pricingModel, maintenanceStatus, compatibleClients, supportUrl, suggested install command/args). Human form is /submit.',
    example: 'POST https://allmcps.com/api/v1/submit',
  },
  {
    method: 'GET',
    path: '/api/v1/categories',
    title: 'List categories',
    desc: 'Every category AllMCPs accepts, with label, emoji, slug, and group — use to pick a valid "category" value before submitting.',
    example: 'https://allmcps.com/api/v1/categories',
  },
  {
    method: 'POST',
    path: '/api/v1/agent/register',
    title: 'Agent registration',
    desc: 'Register an AI agent with email to receive a 6-digit verification code.',
    example: 'POST https://allmcps.com/api/v1/agent/register',
  },
  {
    method: 'POST',
    path: '/api/v1/agent/register/confirm',
    title: 'Confirm registration & mint Bearer token',
    desc: 'Exchange 6-digit confirmation code for an amcp_... agent Bearer token.',
    example: 'POST https://allmcps.com/api/v1/agent/register/confirm',
  },
  {
    method: 'POST',
    path: '/api/v1/agent/claim',
    title: 'Claim listing via agent',
    desc: 'Claim an MCP server listing programmatically using DNS TXT record, site badge, or GitHub README proof.',
    example: 'POST https://allmcps.com/api/v1/agent/claim',
  },
  {
    method: 'POST',
    path: '/api/v1/agent/revoke',
    title: 'Revoke agent token',
    desc: 'Revoke an active agent Bearer token.',
    example: 'POST https://allmcps.com/api/v1/agent/revoke',
  },
  {
    method: 'POST',
    path: '/api/v1/inspect',
    title: 'Live MCP inspector',
    desc: 'Proxy tools/list (and related methods) against a remote MCP endpoint for debugging.',
    example: 'POST https://allmcps.com/api/v1/inspect',
  },
  {
    method: 'GET',
    path: '/api/mcp',
    title: 'Remote MCP server',
    desc: 'AllMCPs itself as a remote MCP server: search, install configs, categories, boosting, and a fully schema\'d submit_mcp_server tool (call tools/list for the exact category/pricing/auth/maintenance enum values). Also available as the allmcps-server npm package (stdio bridge to this same endpoint).',
    example: 'https://allmcps.com/api/mcp',
  },
] as const;

export default function ApiDocsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: 'AllMCPs Directory API Documentation',
        description: metadata.description,
        url: 'https://allmcps.com/docs/api',
        author: { '@type': 'Organization', name: 'AllMCPs', url: 'https://allmcps.com' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Documentation', item: 'https://allmcps.com/docs/api' },
          { '@type': 'ListItem', position: 3, name: 'API Reference', item: 'https://allmcps.com/docs/api' },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="page-shell page-shell--tool">
        <div className="page-shell-inner" style={{ maxWidth: 880 }}>
          <div className="surface page-panel">
            <p className="directory-category-kicker" style={{ marginBottom: '0.5rem' }}>
              Developers &amp; agents
            </p>
            <h1 className="text-page-title" style={{ marginBottom: '0.75rem' }}>
              Directory API
            </h1>
            <p className="text-lead" style={{ marginBottom: '1.5rem' }}>
              Public, CORS-friendly endpoints for searching MCP servers, embedding badges, and
              plugging AllMCPs into AI agents. No API key required for read endpoints.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '2rem',
              }}
            >
              <Link href="/api/v1/openapi.json" className="btn btn-primary" target="_blank">
                OpenAPI JSON ↗
              </Link>
              <Link href="/llms.txt" className="btn btn-secondary" target="_blank">
                llms.txt ↗
              </Link>
              <Link href="/.well-known/api-catalog" className="btn btn-secondary" target="_blank">
                API catalog ↗
              </Link>
            </div>

            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Quick start</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.6 }}>
              Search the directory from any HTTP client or agent:
            </p>
            <CopyBlock code={`curl "https://allmcps.com/api/v1/search?q=postgres&limit=5"`} />

            <h2 style={{ fontSize: '1.25rem', margin: '2rem 0 1rem' }}>Endpoints</h2>
            <ul
              style={{
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                margin: 0,
                padding: 0,
              }}
            >
              {ENDPOINTS.map((ep) => (
                <li key={ep.path + ep.method}>
                  <article
                    style={{
                      padding: '1.1rem 1.25rem',
                      borderRadius: 12,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-muted)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '0.6rem',
                        marginBottom: '0.45rem',
                      }}
                    >
                      <span
                        className={ep.method === 'GET' ? 'api-method-badge api-method-badge--get' : 'api-method-badge api-method-badge--post'}
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 6,
                        }}
                      >
                        {ep.method}
                      </span>
                      <code style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{ep.path}</code>
                    </div>
                    <h3 style={{ fontSize: '1rem', margin: '0 0 0.35rem' }}>{ep.title}</h3>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        margin: '0 0 0.65rem',
                        lineHeight: 1.55,
                      }}
                    >
                      {ep.desc}
                    </p>
                    <a
                      href={ep.example.startsWith('http') ? ep.example : undefined}
                      style={{ fontSize: '0.8rem', color: 'var(--accent-color)', wordBreak: 'break-all' }}
                      target={ep.example.startsWith('http') ? '_blank' : undefined}
                      rel="noopener noreferrer"
                    >
                      {ep.example}
                    </a>
                  </article>
                </li>
              ))}
            </ul>

            <h2 style={{ fontSize: '1.25rem', margin: '2rem 0 0.75rem' }}>Agent discovery</h2>
            <ul
              style={{
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                paddingLeft: '1.2rem',
                marginBottom: '1.5rem',
              }}
            >
              <li>
                <code>Link</code> response headers on every page point at this docs URL, the API
                catalog, and OAuth metadata.
              </li>
              <li>
                Markdown negotiation: send <code>Accept: text/markdown</code> or append{' '}
                <code>?format=md</code> / <code>.md</code> to listing, blog, or category URLs.
              </li>
              <li>
                Machine catalog: <Link href="/data.json">/data.json</Link> and{' '}
                <Link href="/llms-full.txt">/llms-full.txt</Link>.
              </li>
            </ul>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Questions or partnership ideas?{' '}
              <Link href="/contact" style={{ color: 'var(--accent-color)' }}>
                Contact us
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
