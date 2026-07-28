import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'News and updates from the AllMCPs team.',
};

export default function BlogPage() {
  return (
    <main className="container" style={{ padding: '6rem 0' }}>
      <div className="glass-panel" style={{ padding: '4rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Blog</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Coming soon! We're preparing exciting articles about the future of AI agents and the Model Context Protocol.
        </p>
      </div>
    </main>
  );
}
