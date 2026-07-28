import Link from 'next/link';
import { Button } from '../components/ui/Button';

export default function NotFound() {
  return (
    <main className="container" style={{ padding: '8rem 1rem', textAlign: 'center' }}>
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '4rem 2rem', borderRadius: '24px' }}>
        <div style={{ fontSize: '4rem', fontWeight: 800, background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1rem' }}>
          404
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 700 }}>Page Not Found</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: '1.6' }}>
          We couldn't find the page or MCP server tool you were looking for. It may have been moved or removed.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button href="/browse" variant="primary">
            Browse Directory
          </Button>
          <Button href="/categories" variant="secondary">
            Browse Categories
          </Button>
        </div>
      </div>
    </main>
  );
}
