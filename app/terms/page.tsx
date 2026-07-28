import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Privacy',
  description: 'Terms of Service and Privacy Policy for AllMCPs.',
};

export default function TermsPage() {
  return (
    <main className="container" style={{ padding: '6rem 0' }}>
      <div className="glass-panel" style={{ padding: '4rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Terms & Privacy</h1>
        <div className="markdown-body">
          <h2>Terms of Service</h2>
          <p>By using AllMCPs, you agree to our terms. This directory is provided for informational purposes only. We do not guarantee the security or functionality of third-party MCP servers listed here.</p>
          
          <h2>Privacy Policy</h2>
          <p>We respect your privacy. We collect minimal analytics data to improve the directory and do not sell your personal information to third parties.</p>
        </div>
      </div>
    </main>
  );
}
