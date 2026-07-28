'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Share2, X, Copy, Check } from 'lucide-react';
import { toast } from './ui/Toast';
import { trackShare } from '../lib/gtag';

function getDisplayName(name: string) {
  const base = name.split('/').pop() || name;
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function ShareModal({ serverId, serverName }: { serverId: string, serverName: string }) {
  const displayName = getDisplayName(serverName);
  const [isOpen, setIsOpen] = useState(false);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [mounted, setMounted] = useState(false);
  const [badgeStyle, setBadgeStyle] = useState<'featured' | 'directory'>('featured');
  const [badgeTheme, setBadgeTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://allmcps.com';
  const badgeSrc = `${baseUrl}/api/badge/${serverId}?style=${badgeStyle}&theme=${badgeTheme}`;

  const snippets = {
    badge: `[![Listed on AllMCPs](${badgeSrc})](${baseUrl}/mcp/${serverId})`,
    badgeHtml: `<a href="${baseUrl}/mcp/${serverId}"><img src="${badgeSrc}" alt="Listed on AllMCPs" height="${badgeStyle === 'directory' ? 40 : 32}" /></a>`,
    widget: `<iframe src="${baseUrl}/mcp/${serverId}/embed" width="350" height="260" frameBorder="0" style="border-radius: 12px; overflow: hidden; background: transparent;"></iframe>`,
    install: `<a href="${baseUrl}/mcp/${serverId}" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: linear-gradient(135deg, #00E5FF, #007BFF); color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 14px rgba(0,123,255,0.25); transition: transform 0.2s, box-shadow 0.2s;">Install ${displayName} via AllMCPs</a>`
  };

  const handleCopy = async (key: keyof typeof snippets) => {
    try {
      await navigator.clipboard.writeText(snippets[key]);
      setCopiedStates({ ...copiedStates, [key]: true });
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 2000);
      trackShare({ method: `copy_${key}`, serverId });
      toast.success('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast.error('Could not copy', {
        description: 'Your browser blocked clipboard access.',
      });
    }
  };

  const CopyButton = ({ snippetKey }: { snippetKey: keyof typeof snippets }) => (
    <button 
      onClick={() => handleCopy(snippetKey)}
      style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', transition: 'background 0.2s' }}
      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
    >
      {copiedStates[snippetKey] ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
    </button>
  );

  const CodeBlock = ({ snippetKey }: { snippetKey: keyof typeof snippets }) => (
    <div style={{ position: 'relative' }}>
      <div className="share-modal-label">Code</div>
      <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', overflowX: 'auto', color: '#a1a1aa', margin: 0 }}>
        {snippets[snippetKey]}
      </pre>
      <CopyButton snippetKey={snippetKey} />
    </div>
  );

  const modalContent = (
    <div 
      className="share-modal-overlay"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="share-modal-content"
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
            borderRadius: '50%',
            transition: 'background 0.2s'
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
        <div className="share-modal-section">
          <h3 style={{ fontSize: '1rem', color: 'white', marginBottom: '0.25rem' }}>Dynamic SVG Badge</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '1rem' }}>
            Directory-style or classic featured badge — dark and light themes for README or marketing sites.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {(['featured', 'directory'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setBadgeStyle(s)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: badgeStyle === s ? 'rgba(59,130,246,0.2)' : 'transparent',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                {s === 'featured' ? 'Featured' : 'Directory'}
              </button>
            ))}
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setBadgeTheme(t)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: badgeTheme === t ? 'rgba(59,130,246,0.2)' : 'transparent',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                {t === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
          
          <div className="share-modal-label">Preview</div>
          <div className="share-modal-preview" style={{ flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ background: badgeTheme === 'light' ? '#f1f5f9' : '#0d1117', borderRadius: '8px', padding: '1rem 1.5rem', width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3fb950', flexShrink: 0 }}></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/badge/${serverId}?style=${badgeStyle}&theme=${badgeTheme}`}
                alt="AllMCPs badge"
                style={{ height: badgeStyle === 'directory' ? '40px' : '32px' }}
              />
            </div>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
              {badgeTheme === 'light' ? 'Light site / docs context' : 'Dark / GitHub README context'}
            </span>
          </div>

          <CodeBlock snippetKey="badge" />
          <div style={{ marginTop: '0.75rem' }}>
            <CodeBlock snippetKey="badgeHtml" />
          </div>
        </div>

        {/* Widget Section */}
        <div className="share-modal-section">
          <h3 style={{ fontSize: '1rem', color: 'white', marginBottom: '0.25rem' }}>Embeddable Widget</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '1rem' }}>Perfect for your blog or landing page. Paste the HTML snippet below.</p>
          
          <div className="share-modal-label">Preview</div>
          <div className="share-modal-preview" style={{ minHeight: '260px' }}>
            <iframe
              src={`/mcp/${serverId}/embed`}
              width="350"
              height="260"
              frameBorder="0"
              style={{ borderRadius: '12px', overflow: 'hidden', background: 'transparent', border: 'none' }}
              title={`${serverName} embed widget preview`}
            />
          </div>

          <CodeBlock snippetKey="widget" />
        </div>

        {/* Install Link Section */}
        <div className="share-modal-section">
          <h3 style={{ fontSize: '1rem', color: 'white', marginBottom: '0.25rem' }}>Install Button</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '1rem' }}>Standard link to route users to the installation instructions.</p>
          
          <div className="share-modal-label">Preview</div>
          <div className="share-modal-preview">
            <a 
              href={`/mcp/${serverId}`}
              target="_blank" 
              rel="noopener"
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #00E5FF, #007BFF)',
                color: '#020617',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '8px',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(0,123,255,0.25)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onClick={(e) => e.preventDefault()}
            >
              Install {displayName} via AllMCPs
            </a>
          </div>

          <CodeBlock snippetKey="install" />
        </div>
      </div>
    </div>
  );

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
          color: 'var(--bg-color)',
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

      {isOpen && mounted && createPortal(modalContent, document.body)}
    </>
  );
}
