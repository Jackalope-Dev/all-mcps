'use client';

import React, { useMemo, useState } from 'react';
import { Code, Cpu, AlertTriangle } from 'lucide-react';
import { CopyBlock } from './ui/CopyBlock';
import {
  resolveInstallConfig,
  type ResolvedInstall,
  type CachedInstallFields,
} from '../lib/installConfig';

export type IdeTarget = 'claude-desktop' | 'cursor' | 'claude-code' | 'windsurf' | 'goose' | 'continue';

interface McpConfigGeneratorProps extends CachedInstallFields {
  serverId: string;
  serverName: string;
  url?: string;
  description?: string | null;
}

function buildSnippet(
  ide: IdeTarget,
  install: ResolvedInstall,
  key: string
): { label: string; file: string; code: string } {
  if (install.kind === 'remote') {
    const remoteBlock = {
      mcpServers: {
        [key]: {
          url: install.url,
        },
      },
    };
    switch (ide) {
      case 'claude-desktop':
        return {
          label: 'Claude Desktop',
          file: 'claude_desktop_config.json',
          code: JSON.stringify(remoteBlock, null, 2),
        };
      case 'cursor':
        return {
          label: 'Cursor IDE',
          file: '.cursor/mcp.json',
          code: JSON.stringify(remoteBlock, null, 2),
        };
      case 'claude-code':
        return {
          label: 'Claude Code CLI',
          file: 'Terminal Command',
          code: `claude mcp add --transport http ${key} ${install.url}`,
        };
      case 'windsurf':
        return {
          label: 'Windsurf IDE',
          file: '~/.codeium/windsurf/mcp_config.json',
          code: JSON.stringify(remoteBlock, null, 2),
        };
      case 'goose':
        return {
          label: 'Goose AI Agent',
          file: 'Terminal Command',
          code: `goose mcp add ${key} --url ${install.url}`,
        };
      case 'continue':
        return {
          label: 'VS Code (Continue)',
          file: '.continue/config.json',
          code: JSON.stringify(
            {
              mcpServers: [
                {
                  name: key,
                  url: install.url,
                },
              ],
            },
            null,
            2
          ),
        };
    }
  }

  const { command: execCmd, args: execArgs } = install;

  switch (ide) {
    case 'claude-desktop':
      return {
        label: 'Claude Desktop',
        file: 'claude_desktop_config.json',
        code: JSON.stringify(
          {
            mcpServers: {
              [key]: {
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
              [key]: {
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
        code: `claude mcp add ${key} -- ${execCmd} ${execArgs.join(' ')}`,
      };

    case 'windsurf':
      return {
        label: 'Windsurf IDE',
        file: '~/.codeium/windsurf/mcp_config.json',
        code: JSON.stringify(
          {
            mcpServers: {
              [key]: {
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
        code: `goose mcp add ${key} -- ${execCmd} ${execArgs.join(' ')}`,
      };

    case 'continue':
      return {
        label: 'VS Code (Continue)',
        file: '.continue/config.json',
        code: JSON.stringify(
          {
            mcpServers: [
              {
                name: key,
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
}

export function McpConfigGenerator({
  serverId,
  serverName,
  url,
  description,
  installKind,
  installCommand,
  installArgs,
  installPackage,
  installConfidence,
}: McpConfigGeneratorProps) {
  const [activeIde, setActiveIde] = useState<IdeTarget>('claude-desktop');

  const install = useMemo(
    () =>
      resolveInstallConfig({
        id: serverId,
        name: serverName,
        url: url || '',
        description,
        installKind,
        installCommand,
        installArgs,
        installPackage,
        installConfidence,
      }),
    [
      serverId,
      serverName,
      url,
      description,
      installKind,
      installCommand,
      installArgs,
      installPackage,
      installConfidence,
    ]
  );

  const key = serverId || serverName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const current = buildSnippet(activeIde, install, key);
  const showGuessWarning = install.confidence === 'low' || install.source === 'heuristic';

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
      className="surface"
      style={{
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-elevated)',
        padding: '1.5rem',
        margin: '1.75rem 0',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          <Cpu size={18} style={{ color: 'var(--accent-color)' }} />
          <span>One-Click IDE Configuration</span>
        </div>
        <div
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <Code size={15} style={{ color: 'var(--accent-color)' }} />
          <span>{current.file}</span>
        </div>
      </div>

      {showGuessWarning && (
        <div
          style={{
            display: 'flex',
            gap: '0.6rem',
            alignItems: 'flex-start',
            padding: '0.75rem 0.9rem',
            marginBottom: '1rem',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#d97706',
            fontSize: '0.8rem',
            lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            This config is a best-effort guess from the listing. Confirm the package name
            and install steps in the project README before restarting your client
            {install.kind === 'stdio' ? ` (package: ${install.packageName})` : ''}.
          </span>
        </div>
      )}

      {install.kind === 'remote' && install.confidence !== 'low' && (
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.85rem',
            lineHeight: 1.5,
          }}
        >
          Remote HTTP MCP endpoint detected — using URL transport instead of{' '}
          <code style={{ color: 'var(--text-primary)' }}>npx</code>.
        </p>
      )}

      {/* Tab Selector */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        {ides.map((ide) => {
          const isActive = activeIde === ide.id;
          return (
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
                background: isActive ? 'var(--brand-gradient-soft)' : 'var(--bg-muted)',
                borderColor: isActive ? 'var(--accent-color)' : 'var(--border-color)',
                borderStyle: 'solid',
                borderWidth: '1px',
                color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                boxShadow: isActive ? '0 0 14px var(--accent-glow)' : 'none',
              }}
            >
              {ide.name}
            </button>
          );
        })}
      </div>

      {/* Code Display */}
      <CopyBlock
        code={current.code}
        title={current.file}
        serverId={key}
        snippetType={activeIde}
        toastMessage={`Copied ${current.label} config`}
      />
    </div>
  );
}
