'use client';

import { Check, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface DirectoryBadgeCardProps {
  serverId: string;
  serverName: string;
}

export function DirectoryBadgeCard({
  serverId,
  serverName,
}: DirectoryBadgeCardProps) {
  const [style, setStyle] = useState<'directory' | 'featured' | 'shield'>(
    'directory',
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://allmcps.com';
  const badgeSrc = `${origin}/api/badge/${serverId}?style=${style}`;
  const targetUrl = `${origin}/mcp/${serverId}`;

  const markdownSnippet = `[![AllMCPs](${badgeSrc})](${targetUrl})`;
  const htmlSnippet = `<a href="${targetUrl}"><img src="${badgeSrc}" alt="${serverName} on AllMCPs" /></a>`;

  const copySnippet = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore copy fallback
    }
  };

  return (
    <section
      id="directory-badge"
      className="surface directory-badge-card"
      style={{
        marginBottom: '2rem',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        padding: '1.5rem',
        background: 'var(--bg-elevated)',
        scrollMarginTop: '5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <ShieldCheck
            size={20}
            style={{ color: 'var(--accent-color)', flexShrink: 0 }}
          />
          <h2
            style={{
              fontSize: '1.25rem',
              margin: 0,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            AllMCPs Directory Badge
          </h2>
        </div>
        <Link
          href="/badge-generator"
          className="btn btn-secondary"
          style={{
            fontSize: '0.78rem',
            padding: '0.35rem 0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <span>Full Badge Customizer</span>
          <ExternalLink size={13} />
        </Link>
      </div>

      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
          margin: '0 0 1.25rem',
          lineHeight: 1.5,
        }}
      >
        Showcase your server listing on GitHub or your project documentation.
        Embed this dynamic SVG badge to highlight official listing status and
        live engagement.
      </p>

      {/* Style Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            fontWeight: 600,
          }}
        >
          Badge Style:
        </span>
        {(
          [
            { id: 'directory', label: 'Directory Card (40px)' },
            { id: 'featured', label: 'Featured Banner (32px)' },
            { id: 'shield', label: 'Standard Shield (20px)' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setStyle(opt.id)}
            style={{
              fontSize: '0.78rem',
              padding: '0.35rem 0.7rem',
              borderRadius: '6px',
              border:
                style === opt.id
                  ? '1px solid var(--accent-color)'
                  : '1px solid var(--border-color)',
              background:
                style === opt.id
                  ? 'rgba(0, 229, 255, 0.12)'
                  : 'var(--bg-muted)',
              color:
                style === opt.id
                  ? 'var(--accent-color)'
                  : 'var(--text-secondary)',
              fontWeight: style === opt.id ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Live Badge Preview Box */}
      <div
        style={{
          padding: '1.25rem',
          borderRadius: '10px',
          background: 'var(--bg-muted)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          minHeight: '80px',
        }}
      >
        <span
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Live Dynamic SVG Preview
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/badge/${serverId}?style=${style}`}
          alt={`${serverName} AllMCPs Directory Badge`}
          style={{
            maxHeight:
              style === 'directory'
                ? '40px'
                : style === 'featured'
                  ? '32px'
                  : '20px',
          }}
        />
      </div>

      {/* Code Snippets */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem' }}
      >
        {/* Markdown Snippet */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.35rem',
            }}
          >
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Markdown (GitHub README)
            </span>
            <button
              type="button"
              onClick={() => copySnippet(markdownSnippet, 'markdown')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-color)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              {copiedKey === 'markdown' ? (
                <Check size={12} />
              ) : (
                <Copy size={12} />
              )}
              {copiedKey === 'markdown' ? 'Copied' : 'Copy Markdown'}
            </button>
          </div>
          <code
            style={{
              display: 'block',
              fontSize: '0.78rem',
              padding: '0.6rem 0.8rem',
              borderRadius: '6px',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
            }}
          >
            {markdownSnippet}
          </code>
        </div>

        {/* HTML Snippet */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.35rem',
            }}
          >
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              HTML Embed
            </span>
            <button
              type="button"
              onClick={() => copySnippet(htmlSnippet, 'html')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-color)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              {copiedKey === 'html' ? <Check size={12} /> : <Copy size={12} />}
              {copiedKey === 'html' ? 'Copied' : 'Copy HTML'}
            </button>
          </div>
          <code
            style={{
              display: 'block',
              fontSize: '0.78rem',
              padding: '0.6rem 0.8rem',
              borderRadius: '6px',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
            }}
          >
            {htmlSnippet}
          </code>
        </div>
      </div>
    </section>
  );
}
