import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfigAuditor } from '@/components/tools/ConfigAuditor';
import { FaqSection } from '@/components/ui/FaqSection';
import { serializeJsonLd } from '@/lib/jsonLd';

export const metadata: Metadata = {
  title: 'MCP Config Auditor & Merger — Combine Configs',
  description:
    'Audit claude_desktop_config.json, Cursor, Windsurf, and Cline MCP configs for syntax errors, missing API key placeholders, and duplicate server keys.',
  alternates: { canonical: 'https://allmcps.com/tools/config-auditor' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'MCP Config Auditor & Merger Tool | AllMCPs',
    description:
      'Audit your Model Context Protocol client configuration JSON for missing keys, unreplaced env vars, and merge new directory servers in 1 click.',
    url: 'https://allmcps.com/tools/config-auditor',
  },
};

export default function ConfigAuditorPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'MCP Config Auditor & Merger',
        description:
          'Audit and merge Model Context Protocol client configuration JSON files for Claude Desktop, Cursor, Windsurf, and VS Code.',
        url: 'https://allmcps.com/tools/config-auditor',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        isAccessibleForFree: true,
      },
      {
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
            name: 'Config Auditor',
            item: 'https://allmcps.com/tools/config-auditor',
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <main
        className="container page-shell"
        style={{
          paddingTop: 'var(--space-8)',
          paddingBottom: 'var(--space-16)',
        }}
      >
        <nav aria-label="Breadcrumb" style={{ marginBottom: '2rem' }}>
          <ol className="breadcrumb">
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
            <li className="breadcrumb-current">Config Auditor</li>
          </ol>
        </nav>

        <section style={{ maxWidth: '800px', marginBottom: '2.5rem' }}>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            MCP Config{' '}
            <span className="text-brand-gradient">Auditor &amp; Merger</span>
          </h1>
          <p className="text-lead" style={{ margin: 0 }}>
            Audit your MCP client JSON configs for syntax errors, missing API
            key placeholders, and argument errors. Merge new servers from the
            AllMCPs directory directly into your config with 1 click.
          </p>
        </section>

        <ConfigAuditor />

        <div
          style={{
            marginTop: '3.5rem',
            maxWidth: '800px',
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
            What the Config Auditor Checks
          </h2>
          <p style={{ marginBottom: '1.25rem' }}>
            Paste a Claude Desktop, Cursor, Windsurf, Cline, VS Code or Zed MCP
            config and the auditor parses it, detects which client format it is,
            and checks every server entry: that it has a <code>command</code> or{' '}
            <code>url</code>, that <code>args</code> is an array, and that no
            argument or environment variable still contains template text such
            as <code>&lt;YOUR_API_KEY&gt;</code> copied from a README.
          </p>
          <p style={{ marginBottom: '1.25rem' }}>
            The merge panel adds a server from the directory to your existing
            config without retyping it, so you can build up a working config
            file in one place and paste it back into your client. For
            step-by-step setup in each client, see the{' '}
            <Link href="/clients">MCP client setup guides</Link>.
          </p>
          <FaqSection
            title="Frequently Asked Questions (FAQ)"
            items={[
              {
                question:
                  'Why does my MCP server not show up after editing the config?',
                answer:
                  'The most common causes are a JSON syntax error, a server entry missing its command, args written as a string instead of an array, or a placeholder API key that was never replaced. The auditor flags each of these. Most clients also only reload MCP servers after a full restart.',
              },
              {
                question: 'Which config formats does the auditor support?',
                answer:
                  'It reads the mcpServers format used by Claude Desktop, Cursor, Windsurf, Cline and most other clients, the servers key used by VS Code, and the context_servers key used by Zed.',
              },
              {
                question: 'How do I combine two MCP config files?',
                answer:
                  'Paste your existing config, then use the merge panel to add servers from the directory. Each server is added under its own key, so existing entries are kept. Review the result for duplicate server names before saving.',
              },
              {
                question: 'Is my configuration sent to a server?',
                answer:
                  'No. Auditing and merging run entirely in your browser, so API keys and file paths in the config never leave your device.',
              },
            ]}
          />
        </div>
      </main>
    </>
  );
}
