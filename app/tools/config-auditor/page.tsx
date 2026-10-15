import type { Metadata } from 'next';
import Link from 'next/link';
import { ConfigAuditor } from '@/components/tools/ConfigAuditor';
import { ToolPage } from '@/components/tools/ToolPage';

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
    <ToolPage
      href="/tools/config-auditor"
      crumb="Config Auditor"
      title="MCP Config Auditor & Merger"
      description={
        <p>
          Audit your MCP client JSON configs for syntax errors, missing API key
          placeholders, and argument errors. Merge new servers from the AllMCPs
          directory directly into your config with 1 click.
        </p>
      }
      jsonLd={[jsonLd]}
      aboutTitle="What the Config Auditor checks"
      about={
        <>
          <p>
            Paste a Claude Desktop, Cursor, Windsurf, Cline, VS Code or Zed MCP
            config and the auditor parses it, detects which client format it is,
            and checks every server entry: that it has a <code>command</code> or{' '}
            <code>url</code>, that <code>args</code> is an array, and that no
            argument or environment variable still contains template text such
            as <code>&lt;YOUR_API_KEY&gt;</code> copied from a README.
          </p>
          <p>
            The merge panel adds a server from the directory to your existing
            config without retyping it, so you can build up a working config
            file in one place and paste it back into your client. For
            step-by-step setup in each client, see the{' '}
            <Link href="/clients">MCP client setup guides</Link>.
          </p>
        </>
      }
      faq={[
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
    >
      <ConfigAuditor />
    </ToolPage>
  );
}
