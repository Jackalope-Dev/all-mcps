'use client';

import React, { useState } from 'react';
import { Share2, X, Copy, Check } from 'lucide-react';

export default function ShareModal({ serverId, serverName }: { serverId: string, serverName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://allmcps.com';

  const snippets = {
    badge: `[![Featured on AllMCPs](${baseUrl}/api/badge/${serverId})](${baseUrl}/mcp/${serverId})`,
    widget: `<iframe src="${baseUrl}/mcp/${serverId}/embed" width="350" height="180" frameBorder="0" style="border-radius: 12px; overflow: hidden; background: transparent;"></iframe>`,
    install: `<a href="${baseUrl}/mcp/${serverId}" target="_blank" rel="noopener noreferrer">Install ${serverName} via AllMCPs</a>`
  };

  const handleCopy = async (key: keyof typeof snippets) => {
    try {
      await navigator.clipboard.writeText(snippets[key]);
      setCopiedStates({ ...copiedStates, [key]: true });
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '0.5rem', 
          padding: '0.75rem 1rem', 
          backgroundColor: 'var(--accent-color)', 
          color: 'white',
          borderRadius: '8px', 
          fontWeight: 600, 
          cursor: 'pointer',
          border: 'none',
          width: '100%',
          transition: 'opacity 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
      >
        <Share2 size={18} /> Share / Embed
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}
        onClick={() => setIsOpen(false)}>
          <div 
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '2rem',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'white' }}>Share & Embed</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.875rem' }}>
              Add these to your website or GitHub README to get a high-quality backlink and drive traffic to your tool.
            </p>

            {/* Badge Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'white', marginBottom: '0.5rem' }}>Dynamic SVG Badge (Markdown)</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '1rem' }}>Perfect for your GitHub README.</p>
              
              <div style={{ marginBottom: '1rem' }}>
                 <img src={\`/api/badge/\${serverId}\`} alt="Featured on AllMCPs" />
              </div>

              <div style={{ position: 'relative' }}>
                <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', overflowX: 'auto', color: '#a1a1aa' }}>
                  {snippets.badge}
                </pre>
                <button 
                  onClick={() => handleCopy('badge')}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                >
                  {copiedStates.badge ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Widget Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'white', marginBottom: '0.5rem' }}>Embeddable Widget (HTML)</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '1rem' }}>Perfect for your blog or landing page.</p>
              
              <div style={{ position: 'relative' }}>
                <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', overflowX: 'auto', color: '#a1a1aa' }}>
                  {snippets.widget}
                </pre>
                <button 
                  onClick={() => handleCopy('widget')}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                >
                  {copiedStates.widget ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Install Link Section */}
            <div>
              <h3 style={{ fontSize: '1rem', color: 'white', marginBottom: '0.5rem' }}>Install Button (HTML)</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '1rem' }}>Standard link to route users to the installation instructions.</p>
              
              <div style={{ position: 'relative' }}>
                <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', overflowX: 'auto', color: '#a1a1aa' }}>
                  {snippets.install}
                </pre>
                <button 
                  onClick={() => handleCopy('install')}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}
                >
                  {copiedStates.install ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
