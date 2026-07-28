'use client';

import React, { useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';

export default function SubmitPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMessage({ text: data.message, type: 'success' });
        setUrl('');
      } else {
        setMessage({ text: JSON.stringify(data.error) || 'Something went wrong', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Failed to connect to the server.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container" style={{ paddingBottom: '6rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }} className="nav-link">
          <ArrowLeft size={16} /> Back to Directory
        </Link>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto' }} className="animate-fade-in delay-1">
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', textAlign: 'center' }}>Add a Tool</h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '3rem', fontSize: '1.125rem' }}>
          Submit a new MCP server to the directory. We will automatically fetch the description and README from GitHub.
        </p>

        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label htmlFor="url" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>GitHub Repository URL</label>
              <input 
                id="url"
                type="url" 
                required
                placeholder="https://github.com/owner/repo" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '1rem 1.5rem',
                  fontSize: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, var(--accent-color), #2563eb)',
                border: 'none',
                color: '#fff',
                padding: '1rem',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '1.125rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 15px var(--accent-glow)',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.2s'
              }}>
              {loading ? 'Submitting...' : <><Send size={20} /> Submit for Review</>}
            </button>
            
            {message && (
              <div style={{
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                color: message.type === 'success' ? '#10b981' : '#ef4444',
                textAlign: 'center',
                fontWeight: 500
              }}>
                {message.text}
              </div>
            )}
          </form>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          By submitting a tool, you agree to our directory guidelines. All submissions are manually reviewed before appearing on the homepage to prevent spam.
        </div>
      </div>
    </main>
  );
}
