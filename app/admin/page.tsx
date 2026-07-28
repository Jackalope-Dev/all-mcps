import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <main className="container animate-fade-in" style={{ padding: '4rem 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Admin Dashboard</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
        Review and approve pending submissions to the directory.
      </p>

      <AdminClient />
    </main>
  );
}
