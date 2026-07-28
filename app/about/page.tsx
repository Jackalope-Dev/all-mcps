import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Jackalope Digital',
  description: 'Learn about the team behind AllMCPs.',
};

export default function AboutPage() {
  return (
    <main className="container" style={{ padding: '6rem 0' }}>
      <div className="glass-panel" style={{ padding: '4rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>About Jackalope Digital</h1>
        <div className="markdown-body">
          <p>We are the creators of <strong>AllMCPs</strong>, the definitive directory for Model Context Protocol servers.</p>
          <p>Our goal is to make it incredibly simple for developers and users to discover, evaluate, and install the best MCP tools available to give their AI agents superpowers.</p>
        </div>
      </div>
    </main>
  );
}
