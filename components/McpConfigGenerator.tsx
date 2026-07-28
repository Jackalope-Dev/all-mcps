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
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden p-4 my-6">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span>One-Click IDE Configuration</span>
        </div>
        <div className="text-xs text-zinc-400 flex items-center gap-1">
          <Code className="w-3.5 h-3.5" />
          <span>{current.file}</span>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
        {ides.map((ide) => (
          <button
            key={ide.id}
            type="button"
            onClick={() => setActiveIde(ide.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
              activeIde === ide.id
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-500/10'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {ide.name}
          </button>
        ))}
      </div>

      {/* Code Display */}
      <div className="relative group rounded-lg bg-zinc-950/80 border border-white/10 p-3">
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1 text-xs"
          title="Copy config"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-xs">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
        <pre className="text-xs text-zinc-300 font-mono overflow-x-auto pr-20 pt-1 pb-1">
          <code>{current.code}</code>
        </pre>
      </div>
    </div>
  );
}
