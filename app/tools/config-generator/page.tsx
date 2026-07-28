import { Metadata } from 'next';
import { ConfigGeneratorTool } from '../../../components/tools/ConfigGeneratorTool';

export const metadata: Metadata = {
  title: 'Free MCP Config Generator for Claude Desktop, Cursor & VS Code',
  description:
    'Generate a ready-to-paste claude_desktop_config.json, .cursor/mcp.json, or VS Code MCP config from any server in the AllMCPs directory or your own custom setup.',
  alternates: { canonical: 'https://allmcps.com/tools/config-generator' },
  openGraph: {
    title: 'Free MCP Config Generator | AllMCPs',
    description:
      'Generate a ready-to-paste MCP client config for Claude Desktop, Cursor, VS Code, or Windsurf.',
    url: 'https://allmcps.com/tools/config-generator',
  },
};

export default function ConfigGeneratorPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>MCP Config Generator</h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Pick servers from the AllMCPs directory or add your own, then generate a ready-to-paste config
            for Claude Desktop, Claude Code, Cursor, VS Code, or Windsurf.
          </p>

          <ConfigGeneratorTool />

          <div style={{ marginTop: '3rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              How MCP client configs work
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              Every MCP-compatible AI client &mdash; Claude Desktop, Claude Code, Cursor, VS Code, and Windsurf &mdash;
              reads a JSON file listing the MCP servers it should launch on startup. Each entry names a server and
              tells the client how to run it: a local command (like <code>npx -y some-package</code>) plus any
              arguments and environment variables it needs, or a URL if the server runs remotely over HTTP instead
              of as a local subprocess. The exact file name and top-level JSON key differ slightly by client, which
              is why copy-pasting a snippet from one client's docs into another's config file often silently fails.
            </p>
            <p>
              This generator lets you search the AllMCPs directory for a server, auto-fills a best-effort install
              command parsed from its listing (always double-check package names before saving &mdash; server
              descriptions aren't perfectly standardized), or lets you add a custom entry by hand. Pick your target
              client above and copy the result straight into the config file at the path shown.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
