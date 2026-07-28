import { Metadata } from 'next';
import { ConfigValidatorTool } from '../../../components/tools/ConfigValidatorTool';

export const metadata: Metadata = {
  title: 'Free MCP Config Validator — Check Your mcpServers JSON',
  description:
    'Paste your Claude Desktop, Cursor, VS Code, or Windsurf MCP config and catch JSON syntax errors and missing fields before you restart your client.',
  alternates: { canonical: 'https://allmcps.com/tools/config-validator' },
  openGraph: {
    title: 'Free MCP Config Validator | AllMCPs',
    description:
      'Paste your MCP config JSON and catch errors before you restart your client.',
    url: 'https://allmcps.com/tools/config-validator',
  },
};

export default function ConfigValidatorPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>MCP Config Validator</h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Paste your <code>mcpServers</code> (or VS Code <code>servers</code>) JSON below to catch mistakes
            before your AI client silently fails to load a server.
          </p>

          <ConfigValidatorTool />

          <div style={{ marginTop: '3rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Why validate before restarting your client
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              A single misplaced comma or a missing <code>command</code> field is enough to make an MCP client
              quietly skip a server on startup, usually with no error message pointing at the actual cause.
              Tracking that down by trial and error &mdash; edit, save, fully restart the client, check if it
              worked &mdash; is slow.
            </p>
            <p>
              This tool checks your pasted JSON against the shape each supported client expects: valid JSON syntax,
              a non-empty <code>command</code> or <code>url</code> on every entry, and correctly typed{' '}
              <code>args</code> and <code>env</code> fields. Everything runs in your browser &mdash; nothing you
              paste here is sent anywhere, which matters since configs often contain API keys and other secrets in
              their <code>env</code> blocks.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
