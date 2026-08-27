'use client';

import { Bot, Check } from 'lucide-react';
import { useState } from 'react';
import { trackFeatureUse } from '../../lib/gtag';
import { toast } from './Toast';

export function AgentPromptButton({
  serverId,
  serverName,
}: {
  serverId: string;
  serverName: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://allmcps.com';
    const prompt = `Fetch ${baseUrl}/mcp/${serverId}.md and follow its instructions to install and configure the "${serverName}" MCP server in this environment. Verify the exact install command against the README before running it.`;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      trackFeatureUse('copy_agent_prompt', { server_id: serverId });
      setTimeout(() => setCopied(false), 2000);
      toast.success('Install prompt copied', {
        description: 'Paste it into your AI agent to install this MCP.',
      });

      fetch(`/api/mcp/${serverId}/metric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric: 'copy' }),
      }).catch(() => {});
    } catch {
      toast.error('Could not copy prompt', {
        description: 'Your browser blocked clipboard access.',
      });
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.6rem',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        padding: '0.9rem 1rem',
        background: 'var(--brand-gradient)',
        color: 'var(--bg-color)',
        fontWeight: 700,
        fontSize: '0.9rem',
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        boxShadow: '0 4px 20px var(--accent-glow)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        textAlign: 'center',
        whiteSpace: 'normal',
        lineHeight: 1.35,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow =
          '0 8px 28px rgba(var(--accent-rgb), 0.35)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 20px var(--accent-glow)';
      }}
    >
      {copied ? (
        <Check size={18} style={{ flexShrink: 0 }} />
      ) : (
        <Bot size={18} style={{ flexShrink: 0 }} />
      )}
      <span>
        {copied ? 'Prompt Copied!' : 'Copy Install Prompt for AI Agents'}
      </span>
    </button>
  );
}
