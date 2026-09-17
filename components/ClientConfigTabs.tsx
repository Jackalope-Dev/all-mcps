'use client';

import {
  AlertTriangle,
  Check,
  Copy,
  Folder,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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
  };
}

type ClientTab =
  | 'claude'
  | 'cursor'
  | 'claude-code'
  | 'windsurf'
  | 'cline'
  | 'zed'
  | 'cli';

const PRESET_ENV_KEYS = [
  'API_KEY',
  'GITHUB_TOKEN',
  'AUTH_TOKEN',
  'OPENAI_API_KEY',
];

const TABS: { id: ClientTab; label: string; file: string }[] = [
  { id: 'claude', label: 'Claude Desktop', file: 'claude_desktop_config.json' },
  { id: 'cursor', label: 'Cursor IDE', file: '.cursor/mcp.json' },
  { id: 'claude-code', label: 'Claude Code', file: 'Terminal CLI' },
  { id: 'windsurf', label: 'Windsurf', file: 'mcp_config.json' },
  { id: 'cline', label: 'Cline / VS Code', file: 'cline_mcp_settings.json' },
  { id: 'zed', label: 'Zed', file: 'settings.json' },
  { id: 'cli', label: 'Terminal / Run', file: 'Terminal Command' },
];

export function ClientConfigTabs({ server }: ServerConfigProps) {
  const [activeTab, setActiveTab] = useState<ClientTab>('claude');
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [osMode, setOsMode] = useState<'mac' | 'windows'>('mac');
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    [{ key: 'API_KEY', value: '' }],
  );

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

  const serverKey =
    (server.id || server.name)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '') || 'mcp-server';

  // Active env vars map (only non-empty keys)
  const envObj = useMemo(() => {
    return envVars.reduce<Record<string, string>>((acc, item) => {
      const k = item.key.trim();
      if (k) {
        acc[k] = item.value || 'YOUR_VALUE_HERE';
      }
      return acc;
    }, {});
  }, [envVars]);

  const hasEnv = Object.keys(envObj).length > 0 && showEnvVars;

  // Build snippet per client
  const { snippet, pathInfo } = useMemo(() => {
    if (install.kind === 'remote') {
      const remoteBlock = {
        mcpServers: {
          [serverKey]: {
            url: install.url,
            ...(hasEnv ? { env: envObj } : {}),
          },
        },
      };

      const pathMap: Record<
        ClientTab,
        { mac: string; win: string; note?: string }
      > = {
        claude: {
          mac: '~/Library/Application Support/Claude/claude_desktop_config.json',
          win: '%APPDATA%\\Claude\\claude_desktop_config.json',
        },
        cursor: {
          mac: '.cursor/mcp.json',
          win: '.cursor/mcp.json',
          note: 'Workspace root or Cursor Settings > MCP',
        },
        'claude-code': {
          mac: `claude mcp add --transport http ${serverKey} ${install.url}`,
          win: `claude mcp add --transport http ${serverKey} ${install.url}`,
          note: 'Run in terminal to register with Claude Code CLI',
        },
        windsurf: {
          mac: '~/.codeium/windsurf/mcp_config.json',
          win: '%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json',
        },
        cline: {
          mac: 'cline_mcp_settings.json',
          win: 'cline_mcp_settings.json',
          note: 'VS Code Cline extension settings',
        },
        zed: {
          mac: '~/.config/zed/settings.json',
          win: '%APPDATA%\\Zed\\settings.json',
        },
        cli: {
          mac: `curl -s -i "${install.url}"`,
          win: `curl -s -i "${install.url}"`,
          note: 'Test HTTP connection directly',
        },
      };

      let code = '';
      switch (activeTab) {
        case 'claude':
        case 'cursor':
        case 'windsurf':
          code = JSON.stringify(remoteBlock, null, 2);
          break;
        case 'claude-code':
          code = `claude mcp add --transport http ${serverKey} ${install.url}`;
          break;
        case 'cline':
          code = JSON.stringify(
            {
              mcpServers: {
                [serverKey]: {
                  url: install.url,
                  disabled: false,
                  autoApprove: [],
                },
              },
            },
            null,
            2,
          );
          break;
        case 'zed':
          code = JSON.stringify(
            {
              experimental: {
                context_servers: [
                  {
                    id: serverKey,
                    url: install.url,
                  },
                ],
              },
            },
            null,
            2,
          );
          break;
        case 'cli':
          code = `curl -s -i "${install.url}"`;
          break;
      }

      return { snippet: code, pathInfo: pathMap[activeTab] };
    }

    // stdio transport
    const { command, args } = install;
    const stdioBlock = {
      mcpServers: {
        [serverKey]: {
          command,
          args,
          ...(hasEnv ? { env: envObj } : {}),
        },
      },
    };

    const envCliStr = hasEnv
      ? `${Object.entries(envObj)
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ')} `
      : '';

    const envClaudeCodeFlags = hasEnv
      ? `${Object.entries(envObj)
          .map(([k, v]) => `-e ${k}="${v}"`)
          .join(' ')} `
      : '';

    const pathMap: Record<
      ClientTab,
      { mac: string; win: string; note?: string }
    > = {
      claude: {
        mac: '~/Library/Application Support/Claude/claude_desktop_config.json',
        win: '%APPDATA%\\Claude\\claude_desktop_config.json',
      },
      cursor: {
        mac: '.cursor/mcp.json',
        win: '.cursor/mcp.json',
        note: 'Workspace root or Cursor Settings > MCP',
      },
      'claude-code': {
        mac: `claude mcp add ${serverKey} ${envClaudeCodeFlags}-- ${command} ${args.join(' ')}`.trim(),
        win: `claude mcp add ${serverKey} ${envClaudeCodeFlags}-- ${command} ${args.join(' ')}`.trim(),
        note: 'Run in terminal to register with Claude Code CLI',
      },
      windsurf: {
        mac: '~/.codeium/windsurf/mcp_config.json',
        win: '%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json',
      },
      cline: {
        mac: 'cline_mcp_settings.json',
        win: 'cline_mcp_settings.json',
        note: 'VS Code Cline extension settings',
      },
      zed: {
        mac: '~/.config/zed/settings.json',
        win: '%APPDATA%\\Zed\\settings.json',
      },
      cli: {
        mac: `${envCliStr}${command} ${args.join(' ')}`.trim(),
        win: `${envCliStr}${command} ${args.join(' ')}`.trim(),
        note: 'Execute in terminal to run the MCP server directly',
      },
    };

    let code = '';
    switch (activeTab) {
      case 'claude':
      case 'cursor':
      case 'windsurf':
        code = JSON.stringify(stdioBlock, null, 2);
        break;
      case 'claude-code':
        code =
          `claude mcp add ${serverKey} ${envClaudeCodeFlags}-- ${command} ${args.join(' ')}`.trim();
        break;
      case 'cline':
        code = JSON.stringify(
          {
            mcpServers: {
              [serverKey]: {
                command,
                args,
                ...(hasEnv ? { env: envObj } : {}),
                disabled: false,
                autoApprove: [],
              },
            },
          },
          null,
          2,
        );
        break;
      case 'zed':
        code = JSON.stringify(
          {
            experimental: {
              context_servers: [
                {
                  id: serverKey,
                  command,
                  args,
                  ...(hasEnv ? { env: envObj } : {}),
                },
              ],
            },
          },
          null,
          2,
        );
        break;
      case 'cli':
        code = `${envCliStr}${command} ${args.join(' ')}`.trim();
        break;
    }

    return { snippet: code, pathInfo: pathMap[activeTab] };
  }, [install, serverKey, activeTab, hasEnv, envObj]);

  const activeTabMeta = TABS.find((t) => t.id === activeTab) || TABS[0];
  const activePathString = osMode === 'mac' ? pathInfo.mac : pathInfo.win;
  const isCliOrCommand = activeTab === 'claude-code' || activeTab === 'cli';

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
        {TABS.map((t) => {
          const isSelected = activeTab === t.id;
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`panel-${t.id}`}
              onClick={() => {
                trackFeatureUse('client_config_tabs', {
                  client: t.id,
                  server_id: server.id,
                });
                setActiveTab(t.id);
              }}
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
      </div>

      {/* Active Tab Panel */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        style={{ minWidth: 0 }}
      >
        {/* Config Destination Path Box */}
        {!isCliOrCommand && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
              padding: '0.65rem 0.85rem',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              marginBottom: '0.85rem',
              fontSize: '0.8rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                minWidth: 0,
                flex: 1,
              }}
            >
              <Folder
                size={15}
                style={{ color: 'var(--accent-color)', flexShrink: 0 }}
                aria-hidden="true"
              />
              <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
                Target File:
              </span>
              <code
                style={{
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
                title={activePathString}
              >
                {activePathString}
              </code>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexShrink: 0,
              }}
            >
              {/* OS Toggle if windows/mac paths differ */}
              {pathInfo.mac !== pathInfo.win && (
                <div
                  style={{
                    display: 'inline-flex',
                    background: 'var(--bg-elevated)',
                    borderRadius: '6px',
                    padding: '2px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOsMode('mac')}
                    style={{
                      border: 'none',
                      background:
                        osMode === 'mac'
                          ? 'var(--accent-color)'
                          : 'transparent',
                      color:
                        osMode === 'mac'
                          ? 'var(--bg-color)'
                          : 'var(--text-secondary)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    macOS
                  </button>
                  <button
                    type="button"
                    onClick={() => setOsMode('windows')}
                    style={{
                      border: 'none',
                      background:
                        osMode === 'windows'
                          ? 'var(--accent-color)'
                          : 'transparent',
                      color:
                        osMode === 'windows'
                          ? 'var(--bg-color)'
                          : 'var(--text-secondary)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Windows
                  </button>
                </div>
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
                title="Copy configuration file path"
              >
                {copiedPath ? (
                  <Check size={12} color="#10b981" aria-hidden="true" />
                ) : (
                  <Copy size={12} aria-hidden="true" />
                )}
                <span>{copiedPath ? 'Copied' : 'Copy path'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Code Snippet Box */}
        <CopyBlock
          code={snippet}
          title={activeTabMeta.file}
          serverId={server.id}
          snippetType={`config_${activeTab}`}
          toastMessage={`Copied ${activeTabMeta.label} config`}
        />

        {/* Informative footer tip */}
        <p
          style={{
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            marginTop: '0.75rem',
            marginBottom: 0,
            lineHeight: 1.45,
          }}
        >
          {pathInfo.note ? (
            <>💡 {pathInfo.note}</>
          ) : isCliOrCommand ? (
            <>
              💡 Run the command directly in your shell to register or test this
              MCP server.
            </>
          ) : (
            <>
              💡 Paste the JSON block into your client&apos;s configuration file
              under{' '}
              <code style={{ color: 'var(--text-primary)' }}>mcpServers</code>,
              then restart the application.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
