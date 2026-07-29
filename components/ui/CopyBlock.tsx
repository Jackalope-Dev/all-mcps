'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from './Toast';
import { trackCopyConfig } from '../../lib/gtag';

export function CopyBlock({ code, serverId }: { code: string; serverId?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');

      trackCopyConfig({ serverId, snippetType: 'install_command' });

      if (serverId) {
        fetch(`/api/mcp/${serverId}/metric`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric: 'copy' }),
        }).catch(() => {});
      }
    } catch {
      toast.error('Could not copy', {
        description: 'Your browser blocked clipboard access. Try selecting the text manually.',
      });
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <pre
        style={{
          background: 'rgba(0,0,0,0.4)',
          padding: '1.25rem 3.5rem 1.25rem 1.25rem',
          borderRadius: '8px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          maxWidth: '100%',
          border: '1px solid var(--border-color)',
          fontSize: '0.875rem',
          margin: 0,
        }}
      >
        {code}
      </pre>
      <button
        onClick={handleCopy}
        aria-label="Copy to clipboard"
        style={{
          position: 'absolute',
          top: '0.75rem',
          right: '0.75rem',
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: '4px',
          padding: '0.5rem',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
      </button>
    </div>
  );
}
