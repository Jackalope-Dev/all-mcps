'use client';

import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Folder,
  Info,
  Layers,
  Plus,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildClientConfigs, serverConfigKey } from '../../lib/clientConfigs';
import { trackCopyConfig, trackFeatureUse } from '../../lib/gtag';
import {
  isUnverifiedInstall,
  type ResolvedInstall,
  resolveInstallConfig,
} from '../../lib/installConfig';
import { isServerInStack, toggleServerInStack } from '../../lib/stackStore';
import { CopyBlock } from '../ui/CopyBlock';
import { toast } from '../ui/Toast';

interface InstallPanelServer {
  id: string;
  name: string;
  url?: string;
  description?: string | null;
  remoteEndpointUrl?: string | null;
  installCommand?: string | null;
  installPackage?: string | null;
  installArgs?: string[] | string | null;
  installKind?: string | null;
  installConfidence?: string | null;
  suggestedInstallCommand?: string | null;
  suggestedInstallArgs?: string | string[] | null;
  aiEnvVars?: string[] | null;
  installNote?: string | null;
  installNoteHref?: string | null;
}

/** Shown as tabs; every other client sits in the "More" picker. */
const PRIMARY_CLIENTS = [
  'claude-desktop',
  'claude-code',
  'cursor',
  'vs-code',
  'windsurf',
  'cline',
];

const SHORT_LABEL: Record<string, string> = {
  windsurf: 'Windsurf',
};

const PRESET_ENV_KEYS = [
  'API_KEY',
  'GITHUB_TOKEN',
  'AUTH_TOKEN',
  'OPENAI_API_KEY',
];

/** btoa() throws on non-Latin1 input (e.g. CJK text in an install arg) — encode as UTF-8 bytes first. */
function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bumpCopyMetric(serverId: string) {
  fetch(`/api/mcp/${serverId}/metric`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metric: 'copy' }),
  }).catch(() => {});
}

/** One-click editor deep links. Only built for a confirmed install (see below). */
function deepLinks(install: ResolvedInstall, key: string) {
  const cursorConfig =
    install.kind === 'remote'
      ? { url: install.url }
      : { command: install.command, args: install.args };
  const vscodeConfig =
    install.kind === 'remote'
      ? { name: key, url: install.url }
      : { name: key, command: install.command, args: install.args };
  return {
    cursor: `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(
      key,
    )}&config=${encodeURIComponent(base64EncodeUtf8(JSON.stringify(cursorConfig)))}`,
    'vs-code': `vscode:mcp/install?${encodeURIComponent(JSON.stringify(vscodeConfig))}`,
  } as Record<string, string>;
}

/**
 * The listing page's single install flow: pick a client, then either one-click
 * install (Cursor / VS Code deep links) or copy the client-correct config.
 * "Copy prompt for your agent" and "Add to stack" sit in the same footer so
 * there is one place to act, not four competing install affordances.
 *
 * Honesty rule (unchanged from the old ClientConfigTabs/InstallButtons): when
 * the resolver only has a guess derived from the listing name, we render no
 * config and no deep link at all — a guessed package either doesn't exist or
 * belongs to somebody else.
 */
export function InstallPanel({
  server,
  setupUrl,
  setupLabel,
}: {
  server: InstallPanelServer;
  /** Where the project's own setup steps live (repo or website). */
  setupUrl?: string | null;
  setupLabel?: string;
}) {
  const baseInput = useMemo(
    () => ({
      id: server.id,
      name: server.name,
      url: server.url || '',
      description: server.description,
      installKind: server.installKind,
      installCommand: server.installCommand,
      installArgs: server.installArgs,
      installPackage: server.installPackage,
      installConfidence: server.installConfidence,
      suggestedInstallCommand: server.suggestedInstallCommand,
      suggestedInstallArgs: server.suggestedInstallArgs,
    }),
    [server],
  );

  // A listing can have both a confirmed local (stdio) command and an
  // owner-set hosted endpoint. Offer both instead of silently picking one.
  const localInstall = useMemo(
    () => resolveInstallConfig(baseInput),
    [baseInput],
  );
  const hostedInstall = useMemo(
    () =>
      server.remoteEndpointUrl
        ? resolveInstallConfig({
            ...baseInput,
            remoteEndpointUrl: server.remoteEndpointUrl,
          })
        : null,
    [baseInput, server.remoteEndpointUrl],
  );
  const localOk = !isUnverifiedInstall(localInstall);
  const hostedOk = hostedInstall ? !isUnverifiedInstall(hostedInstall) : false;
  const hasBoth = localOk && hostedOk && localInstall.kind !== 'remote';
  const [mode, setMode] = useState<'local' | 'hosted'>('local');
  const install: ResolvedInstall =
    (hasBoth && mode === 'hosted') || (!localOk && hostedOk && hostedInstall)
      ? (hostedInstall as ResolvedInstall)
      : localInstall;
  const unverified = isUnverifiedInstall(install);

  const [activeTab, setActiveTab] = useState('claude-desktop');
  const [locationIndex, setLocationIndex] = useState(0);
  const [copiedPath, setCopiedPath] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [showEnv, setShowEnv] = useState(
    Boolean(server.aiEnvVars && server.aiEnvVars.length > 0),
  );
  // Each env row carries a stable id so React keys survive edits and removals.
  const nextEnvId = useRef(0);
  const [paneHeight, setPaneHeight] = useState<number | null>(null);
  const newEnvRow = (key = '') => ({ id: nextEnvId.current++, key, value: '' });
  const [envVars, setEnvVars] = useState<
    Array<{ id: number; key: string; value: string }>
  >(() =>
    server.aiEnvVars && server.aiEnvVars.length > 0
      ? server.aiEnvVars.map((key) => newEnvRow(key))
      : [newEnvRow('API_KEY')],
  );

  const [inStack, setInStack] = useState(false);
  useEffect(() => {
    setInStack(isServerInStack(server.id));
    const onUpdate = () => setInStack(isServerInStack(server.id));
    window.addEventListener('mcp_stack_updated', onUpdate);
    return () => window.removeEventListener('mcp_stack_updated', onUpdate);
  }, [server.id]);

  const serverKey = serverConfigKey(server.id || server.name);
  const configs = useMemo(
    () =>
      buildClientConfigs({
        install,
        serverKey,
        serverName: server.name,
        env: showEnv
          ? envVars.map((e) => ({
              key: e.key,
              value: e.value || 'YOUR_VALUE_HERE',
            }))
          : [],
      }),
    [install, serverKey, server.name, showEnv, envVars],
  );
  const links = useMemo(
    () => deepLinks(install, server.id || serverKey),
    [install, server.id, serverKey],
  );

  const active = configs.find((c) => c.client === activeTab) ?? configs[0];
  const primary = configs.filter((c) => PRIMARY_CLIENTS.includes(c.client));
  const more = configs.filter((c) => !PRIMARY_CLIENTS.includes(c.client));
  const activeInMore = more.some((m) => m.client === active.client);
  const location =
    active.locations[Math.min(locationIndex, active.locations.length - 1)];
  const deepLink = unverified ? undefined : links[active.client];

  const paneKey = `${active.client}-${install.kind}`;
  // Track the active config's natural height so the frame can animate to it.
  // A callback ref on the keyed pane: React re-runs it (and its cleanup)
  // whenever the pane remounts for a new client / install kind.
  const observePane = useCallback((pane: HTMLDivElement | null) => {
    if (!pane || typeof ResizeObserver === 'undefined') return;
    const measure = () => setPaneHeight(pane.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(pane);
    return () => ro.disconnect();
  }, []);

  const selectClient = (client: string) => {
    trackFeatureUse('client_config_tabs', { client, server_id: server.id });
    setActiveTab(client);
    setLocationIndex(0);
  };

  const onDeepLink = (target: string) => {
    trackCopyConfig({
      serverId: server.id,
      snippetType: `deeplink-${target === 'vs-code' ? 'vscode' : target}`,
    });
    bumpCopyMetric(server.id);
    toast.success(
      target === 'cursor' ? 'Opening Cursor…' : 'Opening VS Code…',
      { description: 'Approve the install in your editor to finish.' },
    );
  };

  const copyPath = async () => {
    if (!location?.path) return;
    try {
      await navigator.clipboard.writeText(location.path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 1800);
      toast.success('Config path copied');
    } catch {
      toast.error('Could not copy path automatically.');
    }
  };

  const copyPrompt = async () => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://allmcps.com';
    const prompt = `Fetch ${origin}/mcp/${server.id}.md and follow its instructions to install and configure the "${server.name}" MCP server in this environment. Verify the exact install command against the README before running it.`;
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
      trackFeatureUse('copy_agent_prompt', { server_id: server.id });
      toast.success('Install prompt copied', {
        description: 'Paste it into your AI agent to install this MCP.',
      });
      bumpCopyMetric(server.id);
    } catch {
      toast.error('Could not copy prompt', {
        description: 'Your browser blocked clipboard access.',
      });
    }
  };

  const toggleStack = () => {
    const next = toggleServerInStack(server.id);
    setInStack(next);
    toast.success(
      next
        ? `Added ${server.name} to your Stack`
        : `Removed ${server.name} from Stack`,
    );
  };

  const setEnv = (index: number, field: 'key' | 'value', val: string) =>
    setEnvVars((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)),
    );
  const addEnv = (key = '') =>
    setEnvVars((prev) =>
      prev.length === 1 && !prev[0].key && !prev[0].value
        ? [newEnvRow(key)]
        : [...prev, newEnvRow(key)],
    );
  const removeEnv = (index: number) =>
    setEnvVars((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [newEnvRow()];
    });

  const footer = (
    <div className="lst-install-footer">
      <button
        type="button"
        className={`btn btn-secondary btn-sm lst-morph${promptCopied ? ' is-done' : ''}`}
        onClick={copyPrompt}
      >
        <span className="lst-morph-icon" aria-hidden="true">
          <Bot size={15} className="lst-morph-a" />
          <Check size={15} className="lst-morph-b" />
        </span>
        {promptCopied ? 'Prompt copied' : 'Copy prompt for your agent'}
      </button>
      <button
        type="button"
        className={`btn btn-ghost btn-sm lst-morph${inStack ? ' is-done' : ''}`}
        onClick={toggleStack}
        aria-pressed={inStack}
        title={
          inStack ? 'Remove from your MCP Stack' : 'Save to your MCP Stack'
        }
      >
        <span className="lst-morph-icon" aria-hidden="true">
          <Layers size={15} className="lst-morph-a" />
          <Check size={15} className="lst-morph-b" />
        </span>
        {inStack ? 'In your stack' : 'Add to stack'}
      </button>
    </div>
  );

  if (unverified) {
    return (
      <div className="lst-install-body">
        <div className="lst-install-empty">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <p className="lst-install-empty-title">
              No confirmed install command yet
            </p>
            <p className="lst-install-empty-text">
              We only publish a config when the install details come from the
              project itself — its README, its docs, or a verified owner. We
              haven&rsquo;t found those for {server.name}, and we&rsquo;d rather
              show nothing than a guess you&rsquo;d paste into your client.
            </p>
            {setupUrl && (
              <a
                href={setupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                {setupLabel || 'Open setup instructions'}
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="lst-install-body">
      {server.installNote ? (
        <div className="lst-callout">
          <Info size={16} aria-hidden="true" />
          <p>
            <strong>Recommended setup:</strong> {server.installNote}
            {server.installNoteHref ? (
              <>
                {' '}
                <a
                  href={server.installNoteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open the official setup page
                </a>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="lst-install-toolbar">
        <div className="lst-tabs scroll-x">
          {/* display: contents — the tabs flow in the row, but the "more"
              picker below stays outside the tablist (only tabs belong in it). */}
          <div role="tablist" aria-label="MCP client" className="lst-tablist">
            {primary.map((t) => {
              const selected = active.client === t.client;
              return (
                <button
                  key={t.client}
                  id={`tab-${t.client}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="lst-install-pane"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectClient(t.client)}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                    const i = primary.findIndex((p) => p.client === t.client);
                    const n =
                      primary[
                        (i +
                          (e.key === 'ArrowRight' ? 1 : -1) +
                          primary.length) %
                          primary.length
                      ];
                    selectClient(n.client);
                    document.getElementById(`tab-${n.client}`)?.focus();
                  }}
                  className="lst-tab"
                >
                  {SHORT_LABEL[t.client] ?? t.label}
                </button>
              );
            })}
          </div>
          {more.length > 0 && (
            <span className={`lst-tab-more${activeInMore ? ' is-active' : ''}`}>
              <select
                aria-label="More MCP clients"
                value={activeInMore ? active.client : ''}
                onChange={(e) => {
                  if (e.target.value) selectClient(e.target.value);
                }}
              >
                <option value="">More…</option>
                {more.map((m) => (
                  <option key={m.client} value={m.client}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </span>
          )}
        </div>
        {hasBoth && (
          <fieldset
            className="segmented lst-mode fieldset-plain"
            aria-label="Install type"
          >
            <button
              type="button"
              className={mode === 'local' ? 'is-active' : undefined}
              aria-pressed={mode === 'local'}
              onClick={() => setMode('local')}
            >
              Local
            </button>
            <button
              type="button"
              className={mode === 'hosted' ? 'is-active' : undefined}
              aria-pressed={mode === 'hosted'}
              onClick={() => setMode('hosted')}
            >
              Hosted
            </button>
          </fieldset>
        )}
      </div>

      {/* The frame animates to each config's real height, so switching
          clients glides instead of jumping and short configs don't leave a
          reserved gap (configs range from one line to a long settings file). */}
      <div
        className="lst-install-pane-frame"
        style={paneHeight == null ? undefined : { height: paneHeight }}
      >
        <div
          id="lst-install-pane"
          role="tabpanel"
          aria-labelledby={activeInMore ? undefined : `tab-${active.client}`}
          aria-label={activeInMore ? active.label : undefined}
          className="lst-install-pane"
          key={paneKey}
          ref={observePane}
        >
          {deepLink && (
            <div className="lst-oneclick">
              <a
                href={deepLink}
                onClick={() => onDeepLink(active.client)}
                className="btn btn-primary btn-md"
              >
                <Zap size={16} aria-hidden="true" />
                Add to {active.label} in one click
              </a>
              <span className="lst-oneclick-hint">
                or paste the config below
              </span>
            </div>
          )}

          {location && (
            <div className="lst-location">
              <Folder size={14} aria-hidden="true" />
              <code title={location.path}>{location.path}</code>
              {active.locations.length > 1 && (
                <select
                  aria-label="Operating system"
                  value={Math.min(locationIndex, active.locations.length - 1)}
                  onChange={(e) => setLocationIndex(Number(e.target.value))}
                >
                  {active.locations.map((l, i) => (
                    <option key={l.os} value={i}>
                      {l.os}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={copyPath}
                className="lst-icon-btn"
                aria-label="Copy config file path"
                title="Copy path"
              >
                {copiedPath ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}
              </button>
            </div>
          )}

          <CopyBlock
            className="copyblock--flush"
            code={active.snippet}
            title={
              active.format === 'shell'
                ? 'Terminal'
                : active.format === 'text'
                  ? 'Server URL'
                  : (location?.path.split(/[/\\]/).pop() ?? active.label)
            }
            serverId={server.id}
            snippetType={`config_${active.client}`}
            toastMessage={`Copied ${active.label} config`}
          />
          <p className="lst-install-note">{active.note}</p>
        </div>
      </div>

      {install.kind === 'stdio' && (
        <div className="lst-env">
          <button
            type="button"
            className="lst-env-toggle"
            onClick={() => setShowEnv((v) => !v)}
            aria-expanded={showEnv}
            aria-controls="lst-env-fields"
          >
            <ChevronDown size={14} aria-hidden="true" />
            Environment variables
            {showEnv && envVars.some((e) => e.key) ? (
              <span className="chip-count">
                {envVars.filter((e) => e.key).length}
              </span>
            ) : null}
          </button>
          {showEnv && (
            <div id="lst-env-fields" className="lst-env-fields">
              <p className="lst-env-help">
                Values are written into the snippet above so you can paste it as
                is. They never leave your browser.
              </p>
              {envVars.map((env, idx) => (
                <div key={env.id} className="lst-env-row">
                  <input
                    type="text"
                    className="form-input"
                    aria-label={`Environment variable name ${idx + 1}`}
                    placeholder="NAME"
                    value={env.key}
                    onChange={(e) =>
                      setEnv(idx, 'key', e.target.value.toUpperCase())
                    }
                  />
                  <input
                    type="text"
                    className="form-input"
                    aria-label={`Value for ${env.key || 'variable'}`}
                    placeholder="value"
                    value={env.value}
                    onChange={(e) => setEnv(idx, 'value', e.target.value)}
                  />
                  <button
                    type="button"
                    className="lst-icon-btn"
                    onClick={() => removeEnv(idx)}
                    aria-label={`Remove ${env.key || 'variable'}`}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
              <div className="lst-env-presets">
                <button type="button" className="chip" onClick={() => addEnv()}>
                  <Plus size={12} aria-hidden="true" /> Add variable
                </button>
                {PRESET_ENV_KEYS.filter(
                  (pk) => !envVars.some((ev) => ev.key.toUpperCase() === pk),
                ).map((pk) => (
                  <button
                    key={pk}
                    type="button"
                    className="chip"
                    onClick={() => addEnv(pk)}
                  >
                    {pk}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {footer}
    </div>
  );
}
