import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfigGeneratorTool } from '../../../components/tools/ConfigGeneratorTool';
import { FaqSection } from '../../../components/ui/FaqSection';

export const metadata: Metadata = {
  title: 'MCP Config Generator for Claude, Cursor & VS Code',
  description:
    'Generate a ready-to-paste claude_desktop_config.json, .cursor/mcp.json, or VS Code MCP config from any server in the AllMCPs directory or your own custom setup.',
  alternates: { canonical: 'https://allmcps.com/tools/config-generator' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Free MCP Config Generator | AllMCPs',
    description:
      'Generate a ready-to-paste MCP client config for Claude Desktop, Cursor, VS Code, or Windsurf.',
    url: 'https://allmcps.com/tools/config-generator',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free MCP Config Generator | AllMCPs',
    description:
      'Generate a ready-to-paste MCP client config for Claude Desktop, Cursor, VS Code, or Windsurf.',
  },
};

const webAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MCP Config Generator',
  url: 'https://allmcps.com/tools/config-generator',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'All',
  isAccessibleForFree: true,
  provider: {
    '@type': 'Organization',
    name: 'AllMCPs',
    url: 'https://allmcps.com',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Free browser-based generator for building claude_desktop_config.json, Cursor, Windsurf, and VS Code MCP client configuration files.',
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://allmcps.com',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Tools',
      item: 'https://allmcps.com/tools',
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Config Generator',
      item: 'https://allmcps.com/tools/config-generator',
    },
  ],
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Where is the claude_desktop_config.json file located?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'On macOS: ~/Library/Application Support/Claude/claude_desktop_config.json. On Windows: %APPDATA%\\Claude\\claude_desktop_config.json.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I add an MCP server to Cursor or Windsurf?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Cursor reads .cursor/mcp.json in your project directory or global settings under Features > MCP Servers. Windsurf reads ~/.codeium/windsurf/mcp_config.json. Use this generator to format entries specifically for each client.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the difference between stdio commands and remote SSE URLs?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A stdio server runs locally on your machine as a child process launched by your AI client (e.g. npx -y @modelcontextprotocol/server-filesystem). A remote server runs as a web service over HTTP/SSE and requires a URL endpoint.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why does my MCP client fail to load a server after editing the config?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Common causes include JSON syntax errors (missing quotes, trailing commas), incorrect file paths, or failing to fully restart (quit and reopen) your AI client. Use our Config Validator tool to test your JSON syntax before restarting.',
      },
    },
  ],
};

export default function ConfigGeneratorPage() {
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
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li>
              <Link href="/tools">Tools</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li className="breadcrumb-current">Config Generator</li>
          </ol>
        </nav>
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
            MCP Config Generator
          </h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Pick servers from the AllMCPs directory or add your own, then
            generate a ready-to-paste config for Claude Desktop, Claude Code,
            Cursor, VS Code, or Windsurf.
          </p>

          <ConfigGeneratorTool />

          {/* Question-Forward FAQ & SEO Content */}
          <div
            style={{
              marginTop: '3.5rem',
              fontSize: '0.925rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                color: 'var(--text-primary)',
                marginBottom: '1rem',
                fontWeight: 700,
              }}
            >
              How MCP Client Configurations Work
            </h2>
            <p style={{ marginBottom: '1.25rem' }}>
              Every MCP-compatible AI client &mdash; Claude Desktop, Claude
              Code, Cursor, VS Code, and Windsurf &mdash; reads a JSON file
              listing the MCP servers it should launch on startup. Each entry
              names a server and tells the client how to run it: a local command
              (like <code>npx -y some-package</code>) plus any arguments and
              environment variables it needs, or a URL if the server runs
              remotely over HTTP instead of as a local subprocess.
            </p>

            <FaqSection
              title="Frequently Asked Questions (FAQ)"
              items={[
                {
                  question:
                    'Where is the claude_desktop_config.json file located?',
                  answer: (
                    <>
                      On <strong>macOS</strong>:{' '}
                      <code>
                        ~/Library/Application
                        Support/Claude/claude_desktop_config.json
                      </code>
                      .<br />
                      On <strong>Windows</strong>:{' '}
                      <code>%APPDATA%\Claude\claude_desktop_config.json</code>.
                    </>
                  ),
                },
                {
                  question: 'How do I add an MCP server to Cursor or Windsurf?',
                  answer: (
                    <>
                      Cursor reads <code>.cursor/mcp.json</code> in your project
                      directory or global settings under Features &gt; MCP
                      Servers. Windsurf reads{' '}
                      <code>~/.codeium/windsurf/mcp_config.json</code>. Use this
                      generator to format entries specifically for each client.
                    </>
                  ),
                },
                {
                  question:
                    'What is the difference between stdio commands and remote SSE URLs?',
                  answer:
                    'A stdio server runs locally on your machine as a child process launched by your AI client. A remote server runs as a web service over HTTP/SSE and requires a URL endpoint.',
                },
                {
                  question:
                    'Why does my MCP client fail to load a server after editing the config?',
                  answer: (
                    <>
                      Common causes include JSON syntax errors (missing quotes,
                      trailing commas), incorrect file paths, or failing to
                      fully restart (quit and reopen) your AI client. Use our{' '}
                      <Link
                        href="/tools/config-validator"
                        style={{
                          color: 'var(--accent-color)',
                          textDecoration: 'none',
                        }}
                      >
                        Config Validator
                      </Link>{' '}
                      tool to test your JSON syntax before restarting.
                    </>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
