import { Metadata } from 'next';
import { SubmitForm } from '../../components/forms/SubmitForm';

export const metadata: Metadata = {
  title: 'Submit an MCP Server',
  description: 'Submit your Model Context Protocol server to the AllMCPs directory.',
};

export default function SubmitPage() {
  return (
    <main className="container" style={{ padding: '6rem 0' }}>
      <div className="glass-panel" style={{ padding: '4rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Submit an MCP Server</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Have you built an incredible MCP server? Submit it below to get it listed in our directory and used by thousands of AI agents.
        </p>
        
        <SubmitForm />
      </div>
    </main>
  );
}
