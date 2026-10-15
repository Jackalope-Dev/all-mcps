'use client';

import { ExternalLink, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { trackFeatureUse } from '../../lib/gtag';
import {
  CLIENT_CONFIG_PATHS,
  type ClientFormat,
  type ServerRow,
  serializeConfig,
} from '../../lib/tools/configFormats';
import {
  isRemoteHint,
  parseInstallHint,
} from '../../lib/tools/parseInstallHint';
import { CodePanel } from './CodePanel';
import { type DirectoryServerHit, ServerPicker } from './ServerPicker';

const STORAGE_KEY = 'allmcps-config-generator-rows';

const FORMATS: Array<{ id: ClientFormat; label: string; file: string }> = [
  { id: 'claude', label: 'Claude', file: 'claude_desktop_config.json' },
  { id: 'cursor', label: 'Cursor', file: 'mcp.json' },
  { id: 'vscode', label: 'VS Code', file: 'mcp.json' },
  { id: 'windsurf', label: 'Windsurf', file: 'mcp_config.json' },
];

function newRow(partial: Partial<ServerRow> = {}): ServerRow {
  return {
    id: crypto.randomUUID(),
    name: '',
    command: '',
    args: [],
    env: {},
    ...partial,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseEnvInput(value: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const pair of value.split(',')) {
    const [k, ...rest] = pair.trim().split('=');
    if (k) env[k.trim()] = rest.join('=').trim();
  }
  return env;
}

const EXAMPLE_ROW: Partial<ServerRow> = {
  name: 'filesystem',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '~/Documents'],
};

export function ConfigGeneratorTool() {
  const [rows, setRows] = useState<ServerRow[]>([]);
  const [format, setFormat] = useState<ClientFormat>('claude');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRows(JSON.parse(saved));
    } catch {
      // localStorage unavailable or corrupt — start with an empty list.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // Storage full/blocked — the in-memory list still works for this session.
    }
  }, [rows, hydrated]);

  function addFromDirectory(server: DirectoryServerHit) {
    trackFeatureUse('config_generator', {
      action: 'add_server',
      server_id: server.id,
    });
    const hint = parseInstallHint(server.description);
    const name = slugify(server.name);
    if (hint && isRemoteHint(hint)) {
      setRows((r) => [
        ...r,
        newRow({ name, url: hint.url, sourceServerId: server.id }),
      ]);
    } else if (hint) {
      setRows((r) => [
        ...r,
        newRow({
          name,
          command: hint.command,
          args: hint.args,
          sourceServerId: server.id,
        }),
      ]);
    } else {
      setRows((r) => [...r, newRow({ name, sourceServerId: server.id })]);
    }
  }

  function updateRow(id: string, patch: Partial<ServerRow>) {
    setRows((r) =>
      r.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  const configJson = serializeConfig(rows, format);
  const active = FORMATS.find((f) => f.id === format) ?? FORMATS[0];
  const addedIds = useMemo(
    () =>
      new Set(
        rows.map((r) => r.sourceServerId).filter((x): x is string => !!x),
      ),
    [rows],
  );
  const unnamed = rows.filter((r) => !r.name.trim()).length;

  return (
    <div className="tl-workspace">
      <section className="tl-pane" aria-labelledby="cg-add">
        <div className="tl-pane-head">
          <h2 id="cg-add" className="tl-pane-title">
            <span className="tl-step">1</span> Add servers
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setRows((r) => [...r, newRow()])}
          >
            <Plus size={14} aria-hidden="true" /> Custom server
          </button>
        </div>
        <ServerPicker
          onSelect={addFromDirectory}
          addedIds={addedIds}
          placeholder="Search 30,000+ servers — e.g. github, postgres"
        />

        {rows.length === 0 ? (
          <div className="tl-empty">
            <PackagePlus size={22} aria-hidden="true" />
            <p className="tl-empty-title">No servers yet</p>
            <p style={{ margin: 0 }}>
              Search the directory above, add a custom server, or start from an
              example.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setRows([newRow(EXAMPLE_ROW)])}
            >
              Load an example
            </button>
          </div>
        ) : (
          <ul className="tl-rows">
            {rows.map((row) => (
              <RowEditor
                key={row.id}
                row={row}
                onChange={(patch) => updateRow(row.id, patch)}
                onRemove={() => removeRow(row.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="tl-pane tl-sticky" aria-labelledby="cg-out">
        <div className="tl-pane-head">
          <h2 id="cg-out" className="tl-pane-title">
            <span className="tl-step">2</span> Copy into your client
          </h2>
        </div>
        <fieldset className="segmented" aria-label="Client">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={format === f.id}
              onClick={() => setFormat(f.id)}
            >
              {f.label}
            </button>
          ))}
        </fieldset>
        <CodePanel
          title={active.file}
          code={configJson}
          downloadName={active.file}
          downloadMime="application/json"
          maxHeight="32rem"
          snippetType="install_command"
          onCopied={() =>
            trackFeatureUse('config_generator', {
              action: 'copy',
              format,
              count: rows.length,
            })
          }
        />
        {unnamed > 0 ? (
          <p className="tl-hint" role="status">
            {unnamed === 1
              ? '1 server has no name and is left out of the config.'
              : `${unnamed} servers have no name and are left out of the config.`}
          </p>
        ) : null}
        <p className="tl-hint">
          Paste into{' '}
          {CLIENT_CONFIG_PATHS[format].map((p, i) => (
            <span key={p}>
              {i > 0 ? ' · ' : ''}
              <code>{p}</code>
            </span>
          ))}
          , then fully restart the client.
        </p>
      </section>
    </div>
  );
}

function RowEditor({
  row,
  onChange,
  onRemove,
}: {
  row: ServerRow;
  onChange: (patch: Partial<ServerRow>) => void;
  onRemove: () => void;
}) {
  // Keep the raw text for list-ish fields locally so typing a space or comma
  // isn't swallowed by the parse → re-join round trip.
  const [argsText, setArgsText] = useState((row.args || []).join(' '));
  const [envText, setEnvText] = useState(
    Object.entries(row.env || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(', '),
  );
  const isRemote = !!row.url;
  const nameMissing = !row.name.trim();

  return (
    <li className="tl-row">
      <div className="tl-row-head">
        <span className="tl-row-title">{row.name || 'Untitled server'}</span>
        {row.sourceServerId ? (
          <a
            href={`/mcp/${row.sourceServerId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tl-icon-btn"
            aria-label="View directory listing (opens in new tab)"
            title="View directory listing"
          >
            <ExternalLink size={15} />
          </a>
        ) : null}
        <button
          type="button"
          className="tl-icon-btn tl-icon-btn--danger"
          onClick={onRemove}
          aria-label={`Remove ${row.name || 'server'}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="tl-grid-2">
        <label className="tl-field">
          <span className="tl-label">Name (config key)</span>
          <input
            className="tl-input is-mono"
            value={row.name}
            aria-invalid={nameMissing || undefined}
            placeholder="my-server"
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </label>
        <label className="tl-field">
          <span className="tl-label">
            Remote URL <span className="tl-label-opt">(HTTP servers)</span>
          </span>
          <input
            className="tl-input"
            type="url"
            value={row.url || ''}
            placeholder="https://example.com/mcp"
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </label>
        <label className="tl-field">
          <span className="tl-label">Command</span>
          <input
            className="tl-input is-mono"
            value={row.command || ''}
            placeholder="npx"
            disabled={isRemote}
            onChange={(e) => onChange({ command: e.target.value })}
          />
        </label>
        <label className="tl-field">
          <span className="tl-label">
            Args <span className="tl-label-opt">(space-separated)</span>
          </span>
          <input
            className="tl-input is-mono"
            value={argsText}
            placeholder="-y @scope/package"
            disabled={isRemote}
            onChange={(e) => {
              setArgsText(e.target.value);
              onChange({ args: e.target.value.split(/\s+/).filter(Boolean) });
            }}
          />
        </label>
      </div>
      <label className="tl-field" style={{ marginTop: '0.75rem' }}>
        <span className="tl-label">
          Env vars{' '}
          <span className="tl-label-opt">(KEY=value, comma-separated)</span>
        </span>
        <input
          className="tl-input is-mono"
          value={envText}
          placeholder="API_KEY=xxx, OTHER=yyy"
          onChange={(e) => {
            setEnvText(e.target.value);
            onChange({ env: parseEnvInput(e.target.value) });
          }}
        />
      </label>
    </li>
  );
}
