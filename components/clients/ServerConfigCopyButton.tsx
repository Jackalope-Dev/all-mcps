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
  label = 'Copy config',
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
    // Optimistic feedback; revert if the clipboard write is refused.
    setCopied(true);
    navigator.clipboard
      ?.writeText(formattedConfig)
      .catch(() => setCopied(false));
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={`btn btn-secondary btn-sm cl-server-copy ${copied ? 'is-copied' : ''}`}
      title={`Copy JSON config for ${serverName}`}
    >
      {copied ? (
        <Check size={13} aria-hidden="true" />
      ) : (
        <Copy size={13} aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}
