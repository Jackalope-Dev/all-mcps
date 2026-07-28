import { Metadata } from 'next';
import { Card } from '../../components/ui/Card';
import { FileJson, CheckCircle2, Calculator } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Free MCP Tools — Config Generator, Validator & Token Calculator',
  description:
    'Free browser-based tools for Model Context Protocol: generate a claude_desktop_config.json, validate your MCP config, and estimate tool schema token cost.',
  alternates: { canonical: 'https://allmcps.com/tools' },
  openGraph: {
    title: 'Free MCP Tools | AllMCPs',
    description:
      'Free browser-based tools for Model Context Protocol: config generator, config validator, and token cost calculator.',
    url: 'https://allmcps.com/tools',
  },
};

const TOOLS = [
  {
    href: '/tools/config-generator',
    icon: FileJson,
    title: 'Config Generator',
    description:
      'Build a ready-to-paste claude_desktop_config.json (or Cursor/VS Code/Windsurf equivalent) from servers in the directory or your own custom setup.',
  },
  {
    href: '/tools/config-validator',
    icon: CheckCircle2,
    title: 'Config Validator',
    description:
      'Paste your MCP config JSON and catch syntax errors and missing fields before you restart your client.',
  },
  {
    href: '/tools/token-calculator',
    icon: Calculator,
    title: 'Token Cost Calculator',
    description:
      "Estimate how much of your model's context window your installed MCP servers' tool schemas are using.",
  },
];

export default function ToolsHubPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>Free MCP Tools</h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Browser-based utilities for working with Model Context Protocol configs. Nothing you paste in ever
            leaves your device.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {TOOLS.map(({ href, icon: Icon, title, description }) => (
              <Card key={href} href={href} hoverable style={{ padding: '1.5rem' }}>
                <Icon size={28} style={{ color: 'var(--accent-color)', marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>{title}</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{description}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
