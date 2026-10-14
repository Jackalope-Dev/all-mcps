'use client';

import {
  AlertTriangle,
  Check,
  Copy,
  Folder,
  Info,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildClientConfigs, serverConfigKey } from '../lib/clientConfigs';
import { trackFeatureUse } from '../lib/gtag';
import {
  isUnverifiedInstall,
  resolveInstallConfig,
} from '../lib/installConfig';
import { CopyBlock } from './ui/CopyBlock';
import { toast } from './ui/Toast';

interface ServerConfigProps {
  server: {
    id: string;
    name: string;
    url?: string;
    description?: string | null;
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
  };
}

const PRESET_ENV_KEYS = [
  'API_KEY',
  'GITHUB_TOKEN',
  'AUTH_TOKEN',
  'OPENAI_API_KEY',
];

/** Shown as tabs; every other client sits in the "More clients" picker. */
const PRIMARY_CLIENTS = [
  'claude-desktop',
  'claude-code',
  'cursor',
  'vs-code',
  'windsurf',
  'cli',
];

export function ClientConfigTabs({ server }: ServerConfigProps) {
  const [activeTab, setActiveTab] = useState<string>('claude-desktop');
  const initialEnvVars = useMemo(() => {
    if (server.aiEnvVars && server.aiEnvVars.length > 0) {
      return server.aiEnvVars.map((key) => ({ key, value: '' }));
    }
    return [{ key: 'API_KEY', value: '' }];
  }, [server.aiEnvVars]);

  const [showEnvVars, setShowEnvVars] = useState(
    Boolean(server.aiEnvVars && server.aiEnvVars.length > 0),
  );
  const [copiedPath, setCopiedPath] = useState(false);
  const [locationIndex, setLocationIndex] = useState(0);
  const [envVars, setEnvVars] =
    useState<Array<{ key: string; value: string }>>(initialEnvVars);

  // Robust install configuration derivation supporting stdio, python/uvx, and remote endpoints
  const install = useMemo(
    () =>
      resolveInstallConfig({
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

  const serverKey = serverConfigKey(server.id || server.name);

  const configs = useMemo(
    () =>
      buildClientConfigs({
        install,
        serverKey,
        serverName: server.name,
        env: showEnvVars
          ? envVars.map((e) => ({
              key: e.key,
              value: e.value || 'YOUR_VALUE_HERE',
            }))
          : [],
      }),
    [install, serverKey, server.name, showEnvVars, envVars],
  );

  const active = configs.find((c) => c.client === activeTab) ?? configs[0];
  const primary = configs.filter((c) => PRIMARY_CLIENTS.includes(c.client));
  const more = configs.filter((c) => !PRIMARY_CLIENTS.includes(c.client));
  const location =
    active.locations[Math.min(locationIndex, active.locations.length - 1)];
  const activePathString = location?.path ?? '';

  const selectClient = (client: string) => {
    trackFeatureUse('client_config_tabs', {
      client,
      server_id: server.id,
    });
    setActiveTab(client);
    setLocationIndex(0);
  };

  const handleCopyPath = async () => {
    if (!activePathString) return;
    try {
      await navigator.clipboard.writeText(activePathString);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
      toast.success('Config path copied', {
        description:
          'Paste it into your terminal, Finder (Cmd+Shift+G), or editor.',
      });
    } catch {
      toast.error('Could not copy path automatically.');
    }
  };

  const handleAddEnvVar = (presetKey?: string) => {
    setEnvVars((prev) => [...prev, { key: presetKey || '', value: '' }]);
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ key: '', value: '' }];
    });
  };

  const handleEnvChange = (
    index: number,
    field: 'key' | 'value',
    val: string,
  ) => {
    setEnvVars((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)),
    );
  };

  // Nothing here is presented as a suggestion — every tab is a block someone copies
  // straight into a client config and runs. When the resolver only had the listing's
  // name to work from, the honest output is no snippet at all: a guessed package either
  // doesn't exist or belongs to somebody else, and a warning above a ready-to-paste
  // config doesn't stop anyone from pasting it. The listing's own links stay on the page.
  if (isUnverifiedInstall(install)) {
    return (
      <div
        className="client-config-tabs"
        style={{
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'flex-start',
          padding: '0.85rem 1rem',
          borderRadius: '10px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#d97706',
          fontSize: '0.82rem',
          lineHeight: 1.55,
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          <strong>No confirmed setup config for this listing yet.</strong> We
          only publish a config block when the install details come from the
          project itself — its README, its docs, or a verified owner. We
          haven&rsquo;t found those for {server.name}, and we&rsquo;d rather
          show nothing than a guess you&rsquo;d paste into your client. Follow
          the project&rsquo;s own setup instructions for the current steps.
        </span>
      </div>
    );
  }

  return (
    <div
      className="client-config-tabs"
      style={{
        borderRadius: '12px',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {server.installNote ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
            padding: '0.85rem 1rem',
            marginBottom: '1.15rem',
            borderRadius: '10px',
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          <Info
            size={18}
            style={{ color: '#38bdf8', flexShrink: 0, marginTop: '0.1rem' }}
            aria-hidden="true"
          />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>
              Recommended setup:
            </strong>{' '}
            {server.installNote}
            {server.installNoteHref ? (
              <>
                {' '}
                <a
                  href={server.installNoteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--accent-color)',
                    textDecoration: 'underline',
                  }}
                >
                  Open the official setup page
                </a>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            minWidth: 0,
          }}
        >
          <Sparkles
            size={18}
            style={{ color: 'var(--accent-color)', flexShrink: 0 }}
            aria-hidden="true"
          />
          <h3
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Client Config &amp; Setup
          </h3>
          {install.kind === 'remote' && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#34d399',
                background: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: '6px',
                padding: '0.15rem 0.45rem',
              }}
            >
              Remote HTTP
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowEnvVars(!showEnvVars)}
          aria-expanded={showEnvVars}
          aria-controls="client-config-env-section"
          className="btn btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: showEnvVars
              ? 'var(--brand-gradient-soft)'
              : 'var(--bg-muted)',
            border: showEnvVars
              ? '1px solid var(--accent-color)'
              : '1px solid var(--border-color)',
            color: showEnvVars
              ? 'var(--accent-color)'
              : 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showEnvVars ? 'Hide Env Variables' : '+ Custom Env Variables'}
        </button>
      </div>

      {/* Env Variables Drawer */}
      {showEnvVars && (
        <div
          id="client-config-env-section"
          style={{
            marginBottom: '1.25rem',
            padding: '1rem 1.15rem',
            background: 'var(--bg-muted)',
            borderRadius: '10px',
            border: '1px dashed var(--accent-color)',
          }}
        >
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.25rem',
            }}
          >
            Configure Environment Variables (API Keys, Tokens, Options):
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.75rem',
              lineHeight: 1.45,
            }}
          >
            Add required secrets below — values are included directly in the
            generated snippet so you can copy and paste with confidence.
          </div>

          {/* Quick preset chips */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.4rem',
              marginBottom: '0.75rem',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}
            >
              Quick Add:
            </span>
            {PRESET_ENV_KEYS.map((pk) => {
              const alreadyExists = envVars.some(
                (ev) => ev.key.toUpperCase() === pk,
              );
              return (
                <button
                  key={pk}
                  type="button"
                  disabled={alreadyExists}
                  onClick={() => {
                    if (envVars.length === 1 && !envVars[0].key) {
                      setEnvVars([{ key: pk, value: '' }]);
                    } else {
                      handleAddEnvVar(pk);
                    }
                  }}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: alreadyExists
                      ? 'transparent'
                      : 'var(--bg-elevated)',
                    color: alreadyExists
                      ? 'var(--text-secondary)'
                      : 'var(--accent-color)',
                    cursor: alreadyExists ? 'default' : 'pointer',
                    opacity: alreadyExists ? 0.5 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <Plus size={11} aria-hidden="true" />
                  {pk}
                </button>
              );
            })}
          </div>

          {/* Variable Rows */}
          {envVars.map((env, idx) => (
            <div
              key={idx}
              className="client-config-env-row"
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <input
                type="text"
                aria-label={`Environment variable key ${idx + 1}`}
                placeholder="KEY (e.g. API_KEY)"
                value={env.key}
                onChange={(e) =>
                  handleEnvChange(idx, 'key', e.target.value.toUpperCase())
                }
                style={{
                  flex: 1,
                  minWidth: 0,
                  boxSizing: 'border-box',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                }}
              />
              <input
                type="text"
                aria-label={`Environment variable value for ${env.key || 'key'}`}
                placeholder="VALUE (e.g. sk-1234...)"
                value={env.value}
                onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                style={{
                  flex: 1.5,
                  minWidth: 0,
                  boxSizing: 'border-box',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                }}
              />
              {envVars.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveEnvVar(idx)}
                  aria-label={`Remove ${env.key || 'variable'}`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0.2rem 0.4rem',
                    flexShrink: 0,
                    borderRadius: '4px',
                  }}
                  title="Remove variable"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => handleAddEnvVar()}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-color)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0.25rem 0',
              marginTop: '0.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <Plus size={13} aria-hidden="true" /> Add Another Variable
          </button>
        </div>
      )}

      {/* Tabs list */}
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        Choose your client or environment
      </div>

      <div
        role="tablist"
        aria-label="MCP Client Selector"
        style={{
          display: 'flex',
          gap: '0.35rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
          background: 'var(--bg-muted)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '0.35rem',
        }}
      >
        {primary.map((t) => {
          const isSelected = active.client === t.client;
          return (
            <button
              key={t.client}
              id={`tab-${t.client}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`panel-${t.client}`}
              onClick={() => selectClient(t.client)}
              className="client-config-tab"
              style={{
                padding: '0.42rem 0.85rem',
                borderRadius: '8px',
                border: isSelected
                  ? '1px solid var(--accent-color)'
                  : '1px solid transparent',
                background: isSelected
                  ? 'var(--brand-gradient-soft)'
                  : 'transparent',
                color: isSelected
                  ? 'var(--accent-color)'
                  : 'var(--text-secondary)',
                fontWeight: isSelected ? 700 : 500,
                fontSize: '0.825rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              {t.label}
            </button>
          );
        })}
        {more.length > 0 && (
          <select
            aria-label="More MCP clients"
            className={`client-config-more${more.some((m) => m.client === active.client) ? ' is-active' : ''}`}
            value={
              more.some((m) => m.client === active.client) ? active.client : ''
            }
            onChange={(e) => {
              if (e.target.value) selectClient(e.target.value);
            }}
          >
            <option value="">More clients…</option>
            {more.map((m) => (
              <option key={m.client} value={m.client}>
                {m.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Active Tab Panel */}
      <div
        id={`panel-${active.client}`}
        role="tabpanel"
        aria-labelledby={
          PRIMARY_CLIENTS.includes(active.client)
            ? `tab-${active.client}`
            : undefined
        }
        aria-label={
          PRIMARY_CLIENTS.includes(active.client) ? undefined : active.label
        }
        style={{ minWidth: 0 }}
      >
        {/* Config Destination Path Box */}
        {location && (
          <div className="client-config-location">
            <div className="client-config-location-main">
              <Folder
                size={15}
                style={{ color: 'var(--accent-color)', flexShrink: 0 }}
                aria-hidden="true"
              />
              <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
                Where:
              </span>
              <code
                className="client-config-location-path"
                title={activePathString}
              >
                {activePathString}
              </code>
            </div>

            <div className="client-config-location-actions">
              {active.locations.length > 1 && (
                <select
                  aria-label="Config location"
                  className="client-config-location-select"
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
                onClick={handleCopyPath}
                className="btn btn-secondary btn-sm"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.55rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
                title="Copy configuration location"
              >
                {copiedPath ? (
                  <Check size={12} color="#10b981" aria-hidden="true" />
                ) : (
                  <Copy size={12} aria-hidden="true" />
                )}
                <span>{copiedPath ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Code Snippet Box */}
        <CopyBlock
          code={active.snippet}
          title={
            active.format === 'shell'
              ? 'Terminal'
              : active.format === 'text'
                ? 'Server URL'
                : (location?.path.split(/[/]/).pop() ?? active.label)
          }
          serverId={server.id}
          snippetType={`config_${active.client}`}
          toastMessage={`Copied ${active.label} config`}
        />

        {/* How to apply it */}
        <p
          style={{
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            marginTop: '0.75rem',
            marginBottom: 0,
            lineHeight: 1.45,
          }}
        >
          💡 {active.note}
        </p>
      </div>
    </div>
  );
}
