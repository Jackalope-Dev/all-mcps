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
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.7 }}>
          Have you built an incredible MCP server? Submit it below to get it listed in our directory.
          You can add a website (nofollow on free listings; dofollow for premium) and claim ownership after approval
          via GitHub badge, site badge, or DNS.
        </p>
        
        <SubmitForm />
      </div>
    </main>
  );
}
