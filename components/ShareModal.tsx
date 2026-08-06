'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Share2, X, Copy, Check, Link2 } from 'lucide-react';
import { toast } from './ui/Toast';
import { trackShare } from '../lib/gtag';
import { BadgeEmbedBuilder } from './ui/BadgeEmbedBuilder';
import { parseServerName } from '../lib/displayName';

export default function ShareModal({
  serverId,
  serverName,
  variant = 'full',
}: {
  serverId: string;
  serverName: string;
  variant?: 'full' | 'mini' | 'action';
}) {
  const { displayName } = parseServerName(serverName);
  const [isOpen, setIsOpen] = useState(false);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const [mounted, setMounted] = useState(false);
  const [badgeStyle, setBadgeStyle] = useState<'featured' | 'directory'>('featured');
  const [badgeTheme, setBadgeTheme] = useState<'dark' | 'light'>('dark');
  const [linkCopied, setLinkCopied] = useState(false);

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
  const listingUrl = `${baseUrl}/mcp/${serverId}`;
  const badgeSrc = `${baseUrl}/api/badge/${serverId}?style=${badgeStyle}&theme=${badgeTheme}`;
  const shareText = `${displayName} MCP server — install in Claude, Cursor & more`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(listingUrl)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(listingUrl)}`;

  const snippets = {
    badge: `[![Listed on AllMCPs](${badgeSrc})](${baseUrl}/mcp/${serverId})`,
    badgeHtml: `<a href="${baseUrl}/mcp/${serverId}"><img src="${badgeSrc}" alt="Listed on AllMCPs" height="${badgeStyle === 'directory' ? 40 : 32}" /></a>`,
    widget: `<iframe src="${baseUrl}/mcp/${serverId}/embed" width="100%" height="260" style="max-width: 350px; border-radius: 12px; overflow: hidden; background: transparent; border: none;"></iframe>`,
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

  const copyListingLink = async () => {
    try {
      await navigator.clipboard.writeText(listingUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      trackShare({ method: 'copy_url', serverId });
      toast.success('Listing link copied');
    } catch {
      toast.error('Could not copy', { description: 'Your browser blocked clipboard access.' });
    }
  };

  const shareNative = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) return;
    try {
      await navigator.share({ title: `${displayName} MCP Server`, text: shareText, url: listingUrl });
      trackShare({ method: 'native', serverId });
    } catch {
      // user cancelled
    }
  };

  const CopyButton = ({ snippetKey }: { snippetKey: keyof typeof snippets }) => (
    <button 
      onClick={() => handleCopy(snippetKey)}
      style={{
        position: 'absolute',
        top: '0.5rem',
        right: '0.5rem',
        background: 'var(--bg-muted)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-primary)',
        padding: '0.4rem',
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'flex',
        transition: 'background 0.2s',
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--border-strong)')}
      onMouseOut={(e) => (e.currentTarget.style.background = 'var(--bg-muted)')}
    >
      {copiedStates[snippetKey] ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
    </button>
  );

  const CodeBlock = ({ snippetKey }: { snippetKey: keyof typeof snippets }) => (
    <div style={{ position: 'relative' }}>
      <div className="share-modal-label">Code</div>
      <pre style={{ background: 'var(--bg-muted)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem', overflowX: 'auto', color: 'var(--text-primary)', margin: 0 }}>
        {snippets[snippetKey]}
      </pre>
      <CopyButton snippetKey={snippetKey} />
    </div>
  );

  const shareBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.55rem 0.85rem',
    borderRadius: 8,
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const canNativeShare = mounted && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

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
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-muted)')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={20} />
        </button>

        <div className="share-modal-scroll">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)', paddingRight: '3rem' }}>Share &amp; Embed</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
            Share the listing, or add a badge/widget to your site for a reciprocal dofollow path.
          </p>

          {/* Social / link share */}
          <div className="share-modal-section" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Share this listing</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={copyListingLink}
                style={shareBtnStyle}
              >
                {linkCopied ? <Check size={16} color="#10b981" /> : <Link2 size={16} />}
                {linkCopied ? 'Copied' : 'Copy link'}
              </button>
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackShare({ method: 'twitter', serverId })}
                style={{ ...shareBtnStyle, textDecoration: 'none' }}
              >
                <X size={16} /> Post on X
              </a>
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackShare({ method: 'linkedin', serverId })}
                style={{ ...shareBtnStyle, textDecoration: 'none' }}
              >
                LinkedIn
              </a>
              {canNativeShare && (
                <button type="button" onClick={shareNative} style={shareBtnStyle}>
                  <Share2 size={16} /> More…
                </button>
              )}
            </div>
          </div>

          {/* Badge Section */}
          <div className="share-modal-section">
            <BadgeEmbedBuilder serverId={serverId} serverName={serverName} />
          </div>

          {/* Widget Section */}
          <div className="share-modal-section">
            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Embeddable Widget</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '1rem' }}>Perfect for your blog or landing page. Paste the HTML snippet below.</p>

            <div className="share-modal-label">Preview</div>
            <div className="share-modal-preview" style={{ minHeight: '260px' }}>
              <iframe
                src={`/mcp/${serverId}/embed`}
                height="260"
                frameBorder="0"
                style={{ width: '100%', maxWidth: '350px', borderRadius: '12px', overflow: 'hidden', background: 'transparent', border: 'none' }}
                title={`${serverName} embed widget preview`}
              />
            </div>

            <CodeBlock snippetKey="widget" />
          </div>

          {/* Install Link Section */}
          <div className="share-modal-section">
            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Install Button</h3>
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
                  background: 'var(--brand-gradient)',
                  color: '#ffffff',
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
    </div>
  );

  return (
    <>
      {variant === 'mini' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="listing-metric-pill listing-metric-pill--button listing-metric-pill--share"
          title="Share & Embed Badge or Widget"
          aria-label="Share & Embed Badge or Widget"
        >
          <Share2 size={16} />
          <span>Share &amp; Embed</span>
        </button>
      ) : variant === 'action' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mcp-action-btn"
          title="Share & Embed Badge or Widget"
          aria-label="Share & Embed Badge or Widget"
        >
          <Share2 size={18} style={{ color: 'var(--accent-color)' }} />
          <span>Share &amp; Embed</span>
        </button>
      ) : (
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
      )}

      {isOpen && mounted && createPortal(modalContent, document.body)}
    </>
  );
}
