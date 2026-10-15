'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

/** One-line copyable shell command (API reference curl examples). */
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    setCopied(true);
    navigator.clipboard?.writeText(command).catch(() => setCopied(false));
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="copy-cmd">
      <span className="copy-cmd-prompt" aria-hidden="true">
        $
      </span>
      <code className="copy-cmd-code">{command}</code>
      <button
        type="button"
        className={`copy-cmd-btn ${copied ? 'is-copied' : ''}`}
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy command'}
      >
        {copied ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Copy size={14} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
