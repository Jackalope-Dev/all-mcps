'use client';

import { Check, Code2, Layers, Terminal } from 'lucide-react';
import React, { useMemo } from 'react';
import { trackCopyConfig } from '../../lib/gtag';
import {
  type CachedInstallFields,
  isUnverifiedInstall,
  resolveInstallConfig,
} from '../../lib/installConfig';
import { isServerInStack, toggleServerInStack } from '../../lib/stackStore';
import { toast } from './Toast';

interface InstallButtonsProps extends CachedInstallFields {
  serverId: string;
  serverName: string;
  url?: string;
  remoteEndpointUrl?: string | null;
  description?: string | null;
}

/** btoa() throws on non-Latin1 input (e.g. CJK text in an install arg) — encode as UTF-8 bytes first. */
function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * One-click "Add to Cursor / VS Code" deep-link install buttons.
 * Uses the same install resolution as <McpConfigGenerator>.
 */
export function InstallButtons({
  serverId,
  serverName,
  url,
  remoteEndpointUrl,
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
        remoteEndpointUrl,
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
      remoteEndpointUrl,
      description,
      installKind,
      installCommand,
      installArgs,
      installPackage,
      installConfidence,
      suggestedInstallCommand,
      suggestedInstallArgs,
    ],
  );

  const cleanName =
    serverId || serverName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // A deep link is a one-click action, not a suggestion: the editor takes the config
  // as given and either runs the package or connects to the host. So it only gets
  // rendered off install details something actually confirmed — a README/description
  // hint, an owner-set endpoint, a non-low-confidence cache. A guess derived from the
  // listing's name has no business being a button; the copyable config below still
  // shows it, labelled as a guess, which is the honest version of the same help.
  const unverified = isUnverifiedInstall(install);

  // Remote HTTP servers: deep-link config uses url transport
  const cursorConfig =
    install.kind === 'remote'
      ? { url: install.url }
      : { command: install.command, args: install.args };
  const cursorHref = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(
    cleanName,
  )}&config=${encodeURIComponent(base64EncodeUtf8(JSON.stringify(cursorConfig)))}`;

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
      },
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
    toast.success(
      nextState
        ? `Added ${serverName} to your Stack!`
        : `Removed ${serverName} from Stack`,
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '0.5rem',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {!unverified && (
        <>
          <a
            href={cursorHref}
            onClick={() => handleInstall('cursor')}
            className="install-deeplink-btn"
            title="1-click install in Cursor IDE"
          >
            <Terminal
              size={15}
              style={{ color: 'var(--accent-color)', flexShrink: 0 }}
              aria-hidden="true"
            />
            <span>Add to Cursor</span>
          </a>
          <a
            href={vscodeHref}
            onClick={() => handleInstall('vscode')}
            className="install-deeplink-btn"
            title="1-click install in VS Code"
          >
            <Code2
              size={15}
              style={{ color: 'var(--accent-color)', flexShrink: 0 }}
              aria-hidden="true"
            />
            <span>Add to VS Code</span>
          </a>
        </>
      )}
      <button
        type="button"
        onClick={handleToggleStack}
        className={`install-deeplink-btn ${inStack ? 'install-deeplink-btn--instack' : ''}`}
        title={inStack ? 'Already in your MCP Stack' : 'Save to your MCP Stack'}
      >
        {inStack ? (
          <Check size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
        ) : (
          <Layers
            size={15}
            style={{ color: 'var(--accent-color)', flexShrink: 0 }}
            aria-hidden="true"
          />
        )}
        <span>{inStack ? 'In Stack' : 'Add to Stack'}</span>
      </button>
      {unverified && (
        <p
          style={{
            flexBasis: '100%',
            margin: 0,
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
          }}
        >
          One-click editor setup isn&rsquo;t available for this listing yet — we
          don&rsquo;t have a confirmed install command, and we&rsquo;d rather
          show nothing than point your editor at the wrong package or host.
          Follow the project&rsquo;s own setup instructions, linked above.
        </p>
      )}
    </div>
  );
}
