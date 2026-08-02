'use client';

import React, { useState } from 'react';
import { Copy, Check, Terminal, Laptop, ShieldCheck, Sparkles, Layers } from 'lucide-react';
import { parseArgsJson } from '../lib/installConfig';

interface ServerConfigProps {
  server: {
    id: string;
    name: string;
    installCommand?: string | null;
    installPackage?: string | null;
    installArgs?: string[] | string | null;
    installKind?: string | null;
  };
}

export function ClientConfigTabs({ server }: ServerConfigProps) {
  const [activeTab, setActiveTab] = useState<'claude' | 'cursor' | 'windsurf' | 'cline' | 'zed' | 'cli'>('claude');
  const [copied, setCopied] = useState(false);

  const command = server.installCommand || 'npx';
  const pkg = server.installPackage || server.id;
  const parsedArgs = parseArgsJson(server.installArgs);
  const args = parsedArgs && parsedArgs.length > 0 ? parsedArgs : ['-y', pkg];
  const serverKey = server.id.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

  // Generate configurations per client
  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        [serverKey]: {
          command: command,
          args: args,
        },
      },
    },
    null,
    2
  );

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        [serverKey]: {
          command: command,
          args: args,
        },
      },
    },
    null,
    2
  );

  const windsurfConfig = JSON.stringify(
    {
      mcpServers: {
        [serverKey]: {
          command: command,
          args: args,
        },
      },
    },
    null,
    2
  );

  const clineConfig = JSON.stringify(
    {
      mcpServers: {
        [serverKey]: {
          command: command,
          args: args,
          disabled: false,
          autoApprove: [],
        },
      },
    },
    null,
    2
  );

  const zedConfig = JSON.stringify(
    {
      experimental: {
        context_servers: [
          {
            id: serverKey,
            command: command,
            args: args,
          },
        ],
      },
    },
    null,
    2
  );

  const cliCommand = `${command} ${args.join(' ')}`;

  const getConfigText = () => {
    switch (activeTab) {
      case 'claude':
        return claudeConfig;
      case 'cursor':
        return cursorConfig;
      case 'windsurf':
        return windsurfConfig;
      case 'cline':
        return clineConfig;
      case 'zed':
        return zedConfig;
      case 'cli':
        return cliCommand;
      default:
        return claudeConfig;
    }
  };

  const getPathHint = () => {
    switch (activeTab) {
      case 'claude':
        return 'Paste into ~/Library/Application Support/Claude/claude_desktop_config.json (macOS) or %APPDATA%\\Claude\\claude_desktop_config.json (Windows)';
      case 'cursor':
        return 'Paste into .cursor/mcp.json in your workspace root or global Cursor settings';
      case 'windsurf':
        return 'Paste into ~/.codeium/windsurf/mcp_config.json';
      case 'cline':
        return 'Paste into your VS Code extension settings (cline_mcp_settings.json)';
      case 'zed':
        return 'Paste into ~/.config/zed/settings.json';
      case 'cli':
        return 'Run directly in your terminal to test tool execution';
    }
  };

  const handleCopy = () => {
    const text = getConfigText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TABS = [
    { id: 'claude', label: 'Claude Desktop' },
    { id: 'cursor', label: 'Cursor IDE' },
    { id: 'windsurf', label: 'Windsurf' },
    { id: 'cline', label: 'Cline / VS Code' },
    { id: 'zed', label: 'Zed' },
    { id: 'cli', label: 'Terminal / CLI' },
  ] as const;

  return (
    <div className="surface" style={{ borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(0, 229, 255, 0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={18} style={{ color: 'var(--accent-color)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Install Config Generator</h3>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="btn btn-sm btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy Config'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              border: activeTab === t.id ? '1px solid var(--accent-color)' : '1px solid transparent',
              background: activeTab === t.id ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === t.id ? '#00E5FF' : 'var(--text-secondary)',
              fontWeight: activeTab === t.id ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Code Snippet Box */}
      <div style={{ position: 'relative' }}>
        <pre
          style={{
            background: 'rgba(2, 6, 23, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            color: '#38bdf8',
            overflowX: 'auto',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          <code>{getConfigText()}</code>
        </pre>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.75rem', marginBottom: 0 }}>
        💡 {getPathHint()}
      </p>
    </div>
  );
}
