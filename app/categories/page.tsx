import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Browse Model Context Protocol servers by category.',
};

export default function CategoriesPage() {
  const categories = [
    'Developer Tools', 'Database', 'File System', 'Web Search', 'Productivity', 'Finance', 'Security', 'Miscellaneous'
  ];

  return (
    <main className="container" style={{ padding: '6rem 0' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '3rem' }}>Browse Categories</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
        {categories.map((cat) => (
          <Link href="/" key={cat} className="glass-panel card-hoverable" style={{ padding: '2rem', textAlign: 'center', display: 'block' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{cat}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>View tools &rarr;</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
