'use client';

import React, { useState } from 'react';
import { Copy, Check, Code, Cpu } from 'lucide-react';
import { toast } from './ui/Toast';
import { trackCopyConfig } from '../lib/gtag';

export type IdeTarget = 'claude-desktop' | 'cursor' | 'claude-code' | 'windsurf' | 'goose' | 'continue';

interface McpConfigGeneratorProps {
  serverId: string;
  serverName: string;
  url?: string;
}

export function McpConfigGenerator({ serverId, serverName, url }: McpConfigGeneratorProps) {
  const [activeIde, setActiveIde] = useState<IdeTarget>('claude-desktop');
  const [copied, setCopied] = useState(false);

  const cleanName = serverId || serverName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const isPython = url?.toLowerCase().includes('python') || cleanName.includes('py');
  const execCmd = isPython ? 'uvx' : 'npx';
  const execArgs = isPython ? [cleanName] : ['-y', cleanName];

  const getSnippet = (ide: IdeTarget): { label: string; file: string; code: string } => {
    switch (ide) {
      case 'claude-desktop':
        return {
          label: 'Claude Desktop',
          file: 'claude_desktop_config.json',
          code: JSON.stringify(
            {
              mcpServers: {
                [cleanName]: {
                  command: execCmd,
                  args: execArgs,
                },
              },
            },
            null,
            2
          ),
        };

      case 'cursor':
        return {
          label: 'Cursor IDE',
          file: '.cursor/mcp.json',
          code: JSON.stringify(
            {
              mcpServers: {
                [cleanName]: {
                  command: execCmd,
                  args: execArgs,
                },
              },
            },
            null,
            2
          ),
        };

      case 'claude-code':
        return {
          label: 'Claude Code CLI',
          file: 'Terminal Command',
          code: `claude mcp add ${cleanName} -- ${execCmd} ${execArgs.join(' ')}`,
        };

      case 'windsurf':
        return {
          label: 'Windsurf IDE',
          file: '~/.codeium/windsurf/mcp_config.json',
          code: JSON.stringify(
            {
              mcpServers: {
                [cleanName]: {
                  command: execCmd,
                  args: execArgs,
                },
              },
            },
            null,
            2
          ),
        };

      case 'goose':
        return {
          label: 'Goose AI Agent',
          file: 'Terminal Command',
          code: `goose mcp add ${cleanName} -- ${execCmd} ${execArgs.join(' ')}`,
        };

      case 'continue':
        return {
          label: 'VS Code (Continue)',
          file: '.continue/config.json',
          code: JSON.stringify(
            {
              mcpServers: [
                {
                  name: cleanName,
                  command: execCmd,
                  args: execArgs,
                },
              ],
            },
            null,
            2
          ),
        };
    }
  };

  const current = getSnippet(activeIde);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackCopyConfig({ serverId: cleanName, snippetType: activeIde });
      toast.success(`Copied ${current.label} config`);
    } catch (e) {
      toast.error('Failed to copy');
    }
  };

  const ides: { id: IdeTarget; name: string }[] = [
    { id: 'claude-desktop', name: 'Claude Desktop' },
    { id: 'cursor', name: 'Cursor' },
    { id: 'claude-code', name: 'Claude Code' },
    { id: 'windsurf', name: 'Windsurf' },
    { id: 'goose', name: 'Goose' },
    { id: 'continue', name: 'Continue (VS Code)' },
  ];

  return (
    <div 
      className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden p-4 my-6"
      style={{
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: 'rgba(15, 23, 42, 0.65)',
        padding: '1.25rem',
        margin: '1.75rem 0',
      }}
    >
      <div 
        className="flex items-center justify-between gap-3 mb-3 flex-wrap"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}
      >
        <div 
          className="flex items-center gap-2 text-sm font-semibold text-white"
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}
        >
          <Cpu className="w-4 h-4 text-cyan-400" size={18} color="#00E5FF" />
          <span>One-Click IDE Configuration</span>
        </div>
        <div 
          className="text-xs text-zinc-400 flex items-center gap-1"
          style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <Code className="w-3.5 h-3.5" size={15} />
          <span>{current.file}</span>
        </div>
      </div>

      {/* Tab Selector */}
      <div 
        className="flex gap-2.5 overflow-x-auto pb-3 mb-4 scrollbar-none"
        style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem' }}
      >
        {ides.map((ide) => (
          <button
            key={ide.id}
            type="button"
            onClick={() => setActiveIde(ide.id)}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '10px',
              fontSize: '0.825rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: activeIde === ide.id ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: activeIde === ide.id ? 'rgba(0, 229, 255, 0.45)' : 'rgba(255, 255, 255, 0.1)',
              borderStyle: 'solid',
              borderWidth: '1px',
              color: activeIde === ide.id ? '#00E5FF' : '#94a3b8',
              boxShadow: activeIde === ide.id ? '0 0 14px rgba(0, 229, 255, 0.25)' : 'none',
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border ${
              activeIde === ide.id
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-500/10'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {ide.name}
          </button>
        ))}
      </div>

      {/* Code Display */}
      <div 
        className="relative group rounded-lg bg-zinc-950/80 border border-white/10 p-4"
        style={{ position: 'relative', borderRadius: '12px', background: 'rgba(2, 6, 23, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1rem' }}
      >
        <button
          type="button"
          onClick={handleCopy}
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            padding: '0.45rem 0.85rem',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.2s ease',
          }}
          className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
          title="Copy config"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" size={15} color="#10b981" />
              <span className="text-emerald-400 text-xs" style={{ color: '#10b981', fontSize: '0.8rem' }}>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" size={15} />
              <span>Copy</span>
            </>
          )}
        </button>
        <pre 
          className="text-xs text-zinc-300 font-mono overflow-x-auto pr-24 pt-1 pb-1"
          style={{ fontSize: '0.825rem', color: '#e4e4e7', fontFamily: 'monospace', overflowX: 'auto', paddingRight: '6rem', paddingTop: '0.35rem', paddingBottom: '0.35rem', margin: 0, lineHeight: 1.6 }}
        >
          <code>{current.code}</code>
        </pre>
      </div>
    </div>
  );
}
