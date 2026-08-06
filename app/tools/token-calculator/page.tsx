import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { TokenCalculatorTool } from '../../../components/tools/TokenCalculatorTool';
import { FaqSection } from '../../../components/ui/FaqSection';

export const metadata: Metadata = {
  title: 'MCP Token Cost Calculator — Estimate Context Usage',
  description:
    'Estimate how many tokens your MCP servers tool schemas cost against your context window. Paste real tool JSON, or quick-estimate from the directory.',
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

            <FaqSection
              title="Frequently Asked Questions (FAQ)"
              items={[
                {
                  question: 'How many tokens does an MCP server tool schema use?',
                  answer:
                    'A typical MCP tool schema consumes between 150 and 500 tokens per tool. A server exposing 10 tools with detailed parameter descriptions can use 2,000 to 5,000 tokens on every prompt turn.',
                },
                {
                  question: 'Why do MCP servers reduce context window space?',
                  answer:
                    'When an MCP client connects to a server, it prepends all registered tool definitions into the system context on every conversation message so the AI model knows available tools.',
                },
                {
                  question: 'How can I reduce MCP tool schema token cost?',
                  answer:
                    'To reduce token cost: disable unused MCP servers when not in active use, shorten overly verbose tool descriptions, and consolidate similar parameter objects.',
                },
              ]}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
