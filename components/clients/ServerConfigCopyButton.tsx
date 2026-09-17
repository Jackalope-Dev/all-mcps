'use client';

import { Check, Copy } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { formatServerClientConfig } from '@/lib/clients';

interface ServerConfigCopyButtonProps {
  clientSlug: string;
  serverName: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  label?: string;
}

export function ServerConfigCopyButton({
  clientSlug,
  serverName,
  command = 'npx',
  args,
  env,
  label = 'Copy Config',
}: ServerConfigCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const formattedConfig = formatServerClientConfig(
      clientSlug,
      serverName,
      command,
      args,
      env,
    );
    navigator.clipboard.writeText(formattedConfig);

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="btn btn-secondary"
      style={{
        padding: '0.35rem 0.65rem',
        fontSize: '0.75rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        background: copied
          ? 'rgba(16, 185, 129, 0.15)'
          : 'rgba(255, 255, 255, 0.05)',
        color: copied ? '#10b981' : 'var(--text-primary)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
      title={`Copy JSON config for ${serverName}`}
    >
      {copied ? (
        <>
          <Check size={13} style={{ color: '#10b981' }} />
          <span>Copied JSON!</span>
        </>
      ) : (
        <>
          <Copy size={13} style={{ color: 'var(--accent-color)' }} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
