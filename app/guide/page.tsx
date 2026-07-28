import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LLM Agents Guide',
  description: 'A comprehensive guide to giving your LLM agents superpowers with MCP.',
};

export default function GuidePage() {
  return (
    <main className="container" style={{ padding: '6rem 0' }}>
      <div className="glass-panel" style={{ padding: '4rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>LLM Agents Guide</h1>
        <div className="markdown-body">
          <p>Welcome to the ultimate guide for supercharging your Large Language Model agents using the Model Context Protocol.</p>
          <p><em>Content coming soon!</em> We will cover topics like:</p>
          <ul>
            <li>Connecting Claude Desktop to local SQL databases.</li>
            <li>Giving your agent read/write access to your local filesystem.</li>
            <li>Setting up autonomous research agents using web search MCP servers.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
