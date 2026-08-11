import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ConfigValidatorTool } from '../../../components/tools/ConfigValidatorTool';
import { FaqSection } from '../../../components/ui/FaqSection';

export const metadata: Metadata = {
  title: 'Free MCP Config Validator — Check mcpServers JSON',
  description:
    'Paste your Claude Desktop, Cursor, VS Code, or Windsurf MCP config and catch JSON syntax errors and missing fields before you restart your client.',
  alternates: { canonical: 'https://allmcps.com/tools/config-validator' },
  openGraph: {
    images: [{ url: 'https://allmcps.com/opengraph-image', width: 1200, height: 630, alt: 'AllMCPs' }],
    title: 'Free MCP Config Validator | AllMCPs',
    description:
      'Paste your MCP config JSON and catch errors before you restart your client.',
    url: 'https://allmcps.com/tools/config-validator',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free MCP Config Validator | AllMCPs',
    description:
      'Paste your MCP config JSON and catch errors before you restart your client.',
  },
};

const webAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MCP Config Validator',
  url: 'https://allmcps.com/tools/config-validator',
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
    'Free browser-based JSON validator for checking Model Context Protocol (MCP) server configurations for syntax errors and missing properties.',
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
    { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://allmcps.com/tools' },
    { '@type': 'ListItem', position: 3, name: 'Config Validator', item: 'https://allmcps.com/tools/config-validator' },
  ],
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What causes JSON syntax errors in MCP configs?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The most common syntax errors are trailing commas after the last server entry, unescaped backslashes in Windows file paths, and unquoted property keys or strings.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I format environment variables in mcpServers?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Environment variables are specified under the "env" object as key-value string pairs, for example: "env": { "API_KEY": "secret_123" }.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why is my command path invalid on Windows?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'In JSON, backslashes must be escaped with double backslashes (e.g., "C:\\\\Program Files\\\\node\\\\node.exe") or replaced with forward slashes ("C:/Program Files/node/node.exe").',
      },
    },
    {
      '@type': 'Question',
      name: 'Is my configuration data stored or sent anywhere?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Validation runs 100% locally inside your web browser. API keys, secrets, and path details pasted into this tool never leave your device.',
      },
    },
  ],
};

export default function ConfigValidatorPage() {
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
            <li className="breadcrumb-current">Config Validator</li>
          </ol>
        </nav>
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>MCP Config Validator</h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Paste your <code>mcpServers</code> (or VS Code <code>servers</code>) JSON below to catch mistakes
            before your AI client silently fails to load a server.
          </p>

          <ConfigValidatorTool />

          {/* Question-Forward FAQ & SEO Content */}
          <div style={{ marginTop: '3.5rem', fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 700 }}>
              Why Validate Before Restarting Your Client
            </h2>
            <p style={{ marginBottom: '1.25rem' }}>
              A single misplaced comma or a missing <code>command</code> field is enough to make an MCP client
              quietly skip a server on startup, usually with no error message pointing at the actual cause.
              Tracking that down by trial and error &mdash; edit, save, fully restart the client, check if it
              worked &mdash; is slow.
            </p>

            <FaqSection
              title="Frequently Asked Questions (FAQ)"
              items={[
                {
                  question: 'What causes JSON syntax errors in MCP configs?',
                  answer:
                    'The most common syntax errors are trailing commas after the last server entry, unescaped backslashes in Windows file paths, and unquoted property keys or strings.',
                },
                {
                  question: 'How do I format environment variables in mcpServers?',
                  answer: (
                    <>
                      Environment variables are specified under the <code>env</code> object as key-value string pairs, for example:{' '}
                      <code>&quot;env&quot;: &#123; &quot;API_KEY&quot;: &quot;secret_123&quot; &#125;</code>.
                    </>
                  ),
                },
                {
                  question: 'Why is my command path invalid on Windows?',
                  answer: (
                    <>
                      In JSON, backslashes must be escaped with double backslashes (e.g., <code>&quot;C:\\\\Program Files\\\\node\\\\node.exe&quot;</code>) or replaced with forward slashes (<code>&quot;C:/Program Files/node/node.exe&quot;</code>).
                    </>
                  ),
                },
                {
                  question: 'Is my configuration data stored or sent anywhere?',
                  answer:
                    'No. Validation runs 100% locally inside your web browser. API keys, secrets, and path details pasted into this tool never leave your device.',
                },
              ]}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
