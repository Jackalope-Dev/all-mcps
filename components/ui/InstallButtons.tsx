'use client';

import React, { useMemo } from 'react';
import { toast } from './Toast';
import { trackCopyConfig } from '../../lib/gtag';
import { resolveInstallConfig, type CachedInstallFields } from '../../lib/installConfig';
import { isServerInStack, toggleServerInStack } from '../../lib/stackStore';

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
  suggestedInstallCommand,
  suggestedInstallArgs,
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
        suggestedInstallCommand,
        suggestedInstallArgs,
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
      suggestedInstallCommand,
      suggestedInstallArgs,
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

  const [inStack, setInStack] = React.useState(false);

  React.useEffect(() => {
    setInStack(isServerInStack(serverId));
    const handleUpdate = () => setInStack(isServerInStack(serverId));
    window.addEventListener('mcp_stack_updated', handleUpdate);
    return () => window.removeEventListener('mcp_stack_updated', handleUpdate);
  }, [serverId]);

  const handleToggleStack = () => {
    const nextState = toggleServerInStack(serverId);
    setInStack(nextState);
    toast.success(nextState ? `Added ${serverName} to your Stack!` : `Removed ${serverName} from Stack`);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem', minWidth: 0, maxWidth: '100%' }}>
      <a
        href={cursorHref}
        onClick={() => handleInstall('cursor')}
        className="install-deeplink-btn"
      >
        Add to Cursor
      </a>
      <a
        href={vscodeHref}
        onClick={() => handleInstall('vscode')}
        className="install-deeplink-btn"
      >
        Add to VS Code
      </a>
      <button
        type="button"
        onClick={handleToggleStack}
        className={`install-deeplink-btn ${inStack ? 'install-deeplink-btn--instack' : ''}`}
      >
        {inStack ? '✓ In Stack' : '+ Add to Stack'}
      </button>
    </div>
  );
}

