import { Metadata } from 'next';
import { TokenCalculatorTool } from '../../../components/tools/TokenCalculatorTool';

export const metadata: Metadata = {
  title: 'MCP Token Cost Calculator — Estimate Context Window Usage',
  description:
    'Estimate how many tokens your MCP servers’ tool schemas cost against your context window. Paste real tool JSON for an exact count, or quick-estimate from the AllMCPs directory.',
  alternates: { canonical: 'https://allmcps.com/tools/token-calculator' },
  openGraph: {
    title: 'MCP Token Cost Calculator | AllMCPs',
    description: 'Estimate the context-window cost of your installed MCP servers’ tool schemas.',
    url: 'https://allmcps.com/tools/token-calculator',
  },
};

export default function TokenCalculatorPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>MCP Token Cost Calculator</h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Every MCP server you connect sends its tool definitions to the model on every turn. Estimate how much
            of your context window that's actually costing you.
          </p>

          <TokenCalculatorTool />

          <div style={{ marginTop: '3rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Why MCP servers have a token cost
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              When an MCP client connects to a server, it asks for that server's list of tools &mdash; each with a
              name, a description, and a JSON Schema describing its parameters &mdash; and includes all of that in
              every request sent to the model, whether or not the model ends up calling any of those tools that
              turn. Connect enough servers, especially ones with many tools or verbose parameter schemas, and you
              can burn a meaningful slice of your context window before you've typed a single message.
            </p>
            <p>
              The "Paste your tools JSON" tab gives an exact count from your server's real <code>tools/list</code>{' '}
              response. The "Quick estimate from directory" tab is a rough, clearly-labeled approximation for
              browsing AllMCPs listings before you've installed anything &mdash; use the paste tab whenever you
              need a real number.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
