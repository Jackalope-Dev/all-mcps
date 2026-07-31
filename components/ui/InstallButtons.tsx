'use client';

import React from 'react';
import { toast } from './Toast';
import { trackCopyConfig } from '../../lib/gtag';

interface InstallButtonsProps {
  serverId: string;
  serverName: string;
  url?: string;
}

/**
 * One-click "Add to Cursor / VS Code" deep-link install buttons.
 *
 * Mirrors the command/args derivation used by <McpConfigGenerator> so the
 * deep links stay consistent with the copy-paste config shown right below.
 * Cursor and VS Code both register OS-level URL handlers that open the editor
 * and pre-fill the MCP install dialog from these links.
 */
export function InstallButtons({ serverId, serverName, url }: InstallButtonsProps) {
  const cleanName = serverId || serverName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const isPython = url?.toLowerCase().includes('python') || cleanName.includes('py');
  const execCmd = isPython ? 'uvx' : 'npx';
  const execArgs = isPython ? [cleanName] : ['-y', cleanName];

  // Cursor: cursor://anysphere.cursor-deeplink/mcp/install?name=<name>&config=<base64 JSON>
  const cursorConfig = { command: execCmd, args: execArgs };
  const cursorHref = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(
    cleanName
  )}&config=${encodeURIComponent(btoa(JSON.stringify(cursorConfig)))}`;

  // VS Code: vscode:mcp/install?<url-encoded JSON with name/command/args>
  const vscodeConfig = { name: cleanName, command: execCmd, args: execArgs };
  const vscodeHref = `vscode:mcp/install?${encodeURIComponent(JSON.stringify(vscodeConfig))}`;

  const handleInstall = (target: 'cursor' | 'vscode') => {
    trackCopyConfig({ serverId: cleanName, snippetType: `deeplink-${target}` });
    // Count deep-link installs the same way the copy actions do.
    fetch(`/api/mcp/${serverId}/metric`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric: 'copy' }),
    }).catch(() => {});
    toast.success(
      target === 'cursor' ? 'Opening Cursor…' : 'Opening VS Code…',
      { description: 'Approve the install in your editor to finish.' }
    );
  };

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    flex: '1 1 180px',
    padding: '0.7rem 1.1rem',
    borderRadius: '10px',
    fontSize: '0.85rem',
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--text-primary)',
    transition: 'transform 0.15s ease, border-color 0.15s ease, background 0.15s ease',
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
      <a
        href={cursorHref}
        onClick={() => handleInstall('cursor')}
        style={btnStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.5)';
          e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
        aria-label={`Add ${serverName} to Cursor with one click`}
      >
        <span aria-hidden>▸</span> Add to Cursor
      </a>
      <a
        href={vscodeHref}
        onClick={() => handleInstall('vscode')}
        style={btnStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(0, 123, 255, 0.5)';
          e.currentTarget.style.background = 'rgba(0, 123, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
        aria-label={`Add ${serverName} to VS Code with one click`}
      >
        <span aria-hidden>▸</span> Add to VS Code
      </a>
    </div>
  );
}
