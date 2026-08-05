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
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([
    { key: 'API_KEY', value: '' },
  ]);

  const command = server.installCommand || 'npx';
  const pkg = server.installPackage || server.id;
  const parsedArgs = parseArgsJson(server.installArgs);
  const args = parsedArgs && parsedArgs.length > 0 ? parsedArgs : ['-y', pkg];
  const serverKey = server.id.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

  // Active env vars map (only non-empty keys)
  const envObj = envVars.reduce<Record<string, string>>((acc, item) => {
    const k = item.key.trim();
    if (k) {
      acc[k] = item.value || 'YOUR_VALUE_HERE';
    }
    return acc;
  }, {});

  const hasEnv = Object.keys(envObj).length > 0 && showEnvVars;

  // Generate configurations per client
  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        [serverKey]: {
          command: command,
          args: args,
          ...(hasEnv ? { env: envObj } : {}),
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
          ...(hasEnv ? { env: envObj } : {}),
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
          ...(hasEnv ? { env: envObj } : {}),
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
          ...(hasEnv ? { env: envObj } : {}),
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
            ...(hasEnv ? { env: envObj } : {}),
          },
        ],
      },
    },
    null,
    2
  );

  const envCliStr = hasEnv
    ? Object.entries(envObj)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ') + ' '
    : '';
  const cliCommand = `${envCliStr}${command} ${args.join(' ')}`;

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

  const handleAddEnvVar = () => {
    setEnvVars((prev) => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEnvChange = (index: number, field: 'key' | 'value', val: string) => {
    setEnvVars((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowEnvVars(!showEnvVars)}
            className="btn btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: showEnvVars ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: showEnvVars ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid var(--border-color)',
              color: showEnvVars ? '#00E5FF' : 'var(--text-secondary)',
              fontSize: '0.8rem',
            }}
          >
            {showEnvVars ? 'Hide Env Variables' : '+ Custom Env Variables'}
          </button>
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
      </div>

      {showEnvVars && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '10px', border: '1px dashed rgba(0, 229, 255, 0.3)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Configure Environment Variables (API Keys, Tokens, Options):
          </div>
          {envVars.map((env, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="KEY (e.g. API_KEY)"
                value={env.key}
                onChange={(e) => handleEnvChange(idx, 'key', e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card, #0f172a)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                }}
              />
              <input
                type="text"
                placeholder="VALUE (e.g. sk-1234...)"
                value={env.value}
                onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                style={{
                  flex: 1.5,
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card, #0f172a)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                }}
              />
              {envVars.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveEnvVar(idx)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0 0.4rem',
                  }}
                  title="Remove variable"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddEnvVar}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-color)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              marginTop: '0.25rem',
            }}
          >
            + Add Another Variable
          </button>
        </div>
      )}

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
