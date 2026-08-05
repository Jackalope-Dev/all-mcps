import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ConfigAuditor } from '@/components/tools/ConfigAuditor';

export const metadata: Metadata = {
  title: 'MCP Config Auditor & Merger — Combine Configs',
  description:
    'Audit claude_desktop_config.json, Cursor, Windsurf, and Cline MCP configs for syntax errors, missing API key placeholders, and duplicate server keys.',
  alternates: { canonical: 'https://allmcps.com/tools/config-auditor' },
  openGraph: {
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
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://allmcps.com/tools' },
          { '@type': 'ListItem', position: 3, name: 'Config Auditor', item: 'https://allmcps.com/tools/config-auditor' },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container page-shell" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: '2rem' }}>
          <ol className="breadcrumb">
            <li><Link href="/">Home</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li><Link href="/tools">Tools</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">Config Auditor</li>
          </ol>
        </nav>

        <section style={{ maxWidth: '800px', marginBottom: '2.5rem' }}>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            MCP Config <span className="text-brand-gradient">Auditor &amp; Merger</span>
          </h1>
          <p className="text-lead" style={{ margin: 0 }}>
            Audit your MCP client JSON configs for syntax errors, missing API key placeholders, and argument errors. Merge new servers from the AllMCPs directory directly into your config with 1 click.
          </p>
        </section>

        <ConfigAuditor />
      </main>
    </>
  );
}
