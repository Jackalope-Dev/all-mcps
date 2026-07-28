'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ClaimClient({ serverId, serverName, repoUrl }: { serverId: string, serverName: string, repoUrl: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const badgeCode = `[![AllMCPs Verified](https://img.shields.io/badge/AllMCPs-Verified-blue)](https://allmcps.com/mcp/${serverId})`;

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: serverId })
      });
      
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
        <h2 style={{ marginBottom: '1rem', color: '#10b981' }}>Verification Successful!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Thank you for verifying your MCP server. Your profile is now marked as official.
        </p>
        <Link href={`/mcp/${serverId}`} style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-color)', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>
          View Profile
        </Link>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>Claim {serverName}</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
        To claim this profile and get the <strong>Verified Official</strong> checkmark, simply add our verification badge anywhere in your GitHub README.md file.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem', color: 'var(--text-primary)' }}>1. Copy this Markdown:</h3>
        <div style={{ position: 'relative' }}>
          <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px', overflowX: 'auto', border: '1px solid var(--border-color)', color: '#10b981' }}>
            <code>{badgeCode}</code>
          </pre>
          <button 
            onClick={() => navigator.clipboard.writeText(badgeCode)}
            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'var(--accent-color)', border: 'none', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Copy
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem', color: 'var(--text-primary)' }}>2. Add it to your repo:</h3>
        <a href={repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>
          {repoUrl}
        </a>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-primary)' }}>3. Verify</h3>
        <button 
          onClick={handleVerify}
          disabled={loading}
          style={{ width: '100%', padding: '1rem', background: loading ? '#374151' : 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
        >
          {loading ? 'Verifying...' : 'Verify Now'}
        </button>
        {error && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444' }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}
