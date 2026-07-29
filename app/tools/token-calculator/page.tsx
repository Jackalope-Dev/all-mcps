import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { TokenCalculatorTool } from '../../../components/tools/TokenCalculatorTool';

export const metadata: Metadata = {
  title: 'MCP Token Cost Calculator — Estimate Context Window Usage',
  description:
    'Estimate how many tokens your MCP servers’ tool schemas cost against your context window. Paste real tool JSON for an exact count, or quick-estimate from the AllMCPs directory.',
  alternates: { canonical: 'https://allmcps.com/tools/token-calculator' },
  openGraph: {
    title: 'MCP Token Cost Calculator | AllMCPs',
    description: 'Estimate the context-window cost of your installed MCP servers’ tool schemas.',
    url: 'https://allmcps.com/tools/token-calculator',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCP Token Cost Calculator | AllMCPs',
    description: 'Estimate the context-window cost of your installed MCP servers’ tool schemas.',
  },
};

const webAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MCP Token Cost Calculator',
  url: 'https://allmcps.com/tools/token-calculator',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'All',
  isAccessibleForFree: true,
  provider: { '@type': 'Organization', name: 'AllMCPs', url: 'https://allmcps.com' },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Free browser-based calculator to estimate prompt context window consumption and token costs of installed Model Context Protocol (MCP) tool schemas.',
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
    { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://allmcps.com/tools' },
    { '@type': 'ListItem', position: 3, name: 'Token Calculator', item: 'https://allmcps.com/tools/token-calculator' },
  ],
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How many tokens does an MCP server tool schema use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A typical MCP tool schema consumes between 150 and 500 tokens per tool. A server exposing 10 tools with detailed parameter descriptions can use 2,000 to 5,000 tokens on every prompt turn.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why do MCP servers reduce context window space?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'When an MCP client connects to a server, it prepends all registered tool definitions (names, descriptions, Zod/JSON schemas) into the system context on every conversation message so the AI model knows available tools.',
      },
    },
    {
      '@type': 'Question',
      name: 'How can I reduce MCP tool schema token cost?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'To reduce token cost: disable unused MCP servers when not in active use, shorten overly verbose tool descriptions, and consolidate similar parameter objects.',
      },
    },
  ],
};

export default function TokenCalculatorPage() {
  return (
    <main className="page-shell page-shell--tool">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="page-shell-inner">
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb" style={{ marginBottom: '1.5rem' }}>
            <li><Link href="/">Home</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li><Link href="/tools">Tools</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">Token Calculator</li>
          </ol>
        </nav>
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>MCP Token Cost Calculator</h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Every MCP server you connect sends its tool definitions to the model on every turn. Estimate how much
            of your context window that&apos;s actually costing you.
          </p>

          <TokenCalculatorTool />

          {/* Question-Forward FAQ & SEO Content */}
          <div style={{ marginTop: '3.5rem', fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 700 }}>
              Why MCP Servers Have a Token Cost
            </h2>
            <p style={{ marginBottom: '1.25rem' }}>
              When an MCP client connects to a server, it asks for that server&apos;s list of tools &mdash; each with a
              name, a description, and a JSON Schema describing its parameters &mdash; and includes all of that in
              every request sent to the model, whether or not the model ends up calling any of those tools that
              turn. Connect enough servers, especially ones with many tools or verbose parameter schemas, and you
              can burn a meaningful slice of your context window before you&apos;ve typed a single message.
            </p>

            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 700 }}>
              Frequently Asked Questions (FAQ)
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ padding: '1.25rem', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                  How many tokens does an MCP server tool schema use?
                </h3>
                <p style={{ margin: 0 }}>
                  A typical MCP tool schema consumes between 150 and 500 tokens per tool. A server exposing 10 tools with detailed parameter descriptions can use 2,000 to 5,000 tokens on every prompt turn.
                </p>
              </div>

              <div style={{ padding: '1.25rem', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                  Why do MCP servers reduce context window space?
                </h3>
                <p style={{ margin: 0 }}>
                  When an MCP client connects to a server, it prepends all registered tool definitions into the system context on every conversation message so the AI model knows available tools.
                </p>
              </div>

              <div style={{ padding: '1.25rem', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                  How can I reduce MCP tool schema token cost?
                </h3>
                <p style={{ margin: 0 }}>
                  To reduce token cost: disable unused MCP servers when not in active use, shorten overly verbose tool descriptions, and consolidate similar parameter objects.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
