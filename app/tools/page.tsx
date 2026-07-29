import { Metadata } from 'next';
import { Card } from '../../components/ui/Card';
import { FileJson, CheckCircle2, Calculator, Code2, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Free MCP Tools — OpenAPI Generator, Protocol Inspector, Config Validator & Calculator',
  description:
    'Free browser-based tools for Model Context Protocol (MCP): convert OpenAPI specs to MCP code, inspect JSON-RPC payloads, generate & validate client configs, and calculate token overhead.',
  alternates: { canonical: 'https://allmcps.com/tools' },
  openGraph: {
    title: 'Free MCP Tools Suite | AllMCPs',
    description:
      'Free browser-based tools for Model Context Protocol: OpenAPI code generator, JSON-RPC protocol inspector, config validator, and token cost calculator.',
    url: 'https://allmcps.com/tools',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free MCP Tools Suite | AllMCPs',
    description:
      'Free browser-based tools for Model Context Protocol: OpenAPI code generator, JSON-RPC protocol inspector, config validator, and token cost calculator.',
  },
};

const TOOLS = [
  {
    href: '/tools/openapi-to-mcp',
    icon: Code2,
    title: 'OpenAPI to MCP Generator',
    description:
      'Convert OpenAPI 3.0/3.1 or Swagger specs into runnable TypeScript SDK or Python FastMCP server code automatically.',
  },
  {
    href: '/tools/protocol-inspector',
    icon: ShieldCheck,
    title: 'Protocol Inspector & Debugger',
    description:
      'Inspect raw JSON-RPC 2.0 payloads, validate schema compliance, catch protocol errors, and preview live AI client rendering.',
  },
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
      'Paste your MCP config JSON and catch syntax errors, missing fields, and path issues before restarting your client.',
  },
  {
    href: '/tools/token-calculator',
    icon: Calculator,
    title: 'Token Cost Calculator',
    description:
      "Estimate how much of your model's context window your installed MCP servers' tool schemas consume on every turn.",
  },
];

export default function ToolsHubPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>Free MCP Developer Tools</h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Browser-based utilities for building, inspecting, validating, and optimizing Model Context Protocol (MCP) servers and client configurations. 100% private &mdash; nothing leaves your browser.
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
