'use client';

import React, { useMemo } from 'react';
import { toast } from './Toast';
import { trackCopyConfig } from '../../lib/gtag';
import { resolveInstallConfig, type CachedInstallFields } from '../../lib/installConfig';

interface InstallButtonsProps extends CachedInstallFields {
  serverId: string;
  serverName: string;
  url?: string;
  description?: string | null;
}

/**
 * One-click "Add to Cursor / VS Code" deep-link install buttons.
 * Uses the same install resolution as <McpConfigGenerator>.
 */
export function InstallButtons({
  serverId,
  serverName,
  url,
  description,
  installKind,
  installCommand,
  installArgs,
  installPackage,
  installConfidence,
}: InstallButtonsProps) {
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

  const cleanName = serverId || serverName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Remote HTTP servers: deep-link config uses url transport
  const cursorConfig =
    install.kind === 'remote'
      ? { url: install.url }
      : { command: install.command, args: install.args };
  const cursorHref = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(
    cleanName
  )}&config=${encodeURIComponent(btoa(JSON.stringify(cursorConfig)))}`;

  const vscodeConfig =
    install.kind === 'remote'
      ? { name: cleanName, url: install.url }
      : { name: cleanName, command: install.command, args: install.args };
  const vscodeHref = `vscode:mcp/install?${encodeURIComponent(JSON.stringify(vscodeConfig))}`;

  const handleInstall = (target: 'cursor' | 'vscode') => {
    trackCopyConfig({ serverId: cleanName, snippetType: `deeplink-${target}` });
    fetch(`/api/mcp/${serverId}/metric`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric: 'copy' }),
    }).catch(() => {});
    toast.success(
      target === 'cursor' ? 'Opening Cursor…' : 'Opening VS Code…',
      {
        description:
          install.confidence === 'low'
            ? 'Config is a best-effort guess — verify in README after install.'
            : 'Approve the install in your editor to finish.',
      }
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
      >
        Add to Cursor
      </a>
      <a
        href={vscodeHref}
        onClick={() => handleInstall('vscode')}
        style={btnStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.5)';
          e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
      >
        Add to VS Code
      </a>
    </div>
  );
}
