'use client';

import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CopyBlock } from '../ui/CopyBlock';
import { ServerPicker, DirectoryServerHit } from './ServerPicker';
import { parseInstallHint, isRemoteHint } from '../../lib/tools/parseInstallHint';
import {
  ClientFormat,
  ServerRow,
  CLIENT_FORMAT_LABELS,
  CLIENT_CONFIG_PATHS,
  serializeConfig,
} from '../../lib/tools/configFormats';
import { trackFeatureUse } from '../../lib/gtag';

const STORAGE_KEY = 'allmcps-config-generator-rows';

function newRow(partial: Partial<ServerRow> = {}): ServerRow {
  return { id: crypto.randomUUID(), name: '', command: '', args: [], env: {}, ...partial };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

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
    trackFeatureUse('config_generator', { action: 'add_server', server_id: server.id });
    const hint = parseInstallHint(server.description);
    const name = slugify(server.name);
    if (hint && isRemoteHint(hint)) {
      setRows((r) => [...r, newRow({ name, url: hint.url, sourceServerId: server.id })]);
    } else if (hint) {
      setRows((r) => [...r, newRow({ name, command: hint.command, args: hint.args, sourceServerId: server.id })]);
    } else {
      setRows((r) => [...r, newRow({ name, sourceServerId: server.id })]);
    }
  }

  function updateRow(id: string, patch: Partial<ServerRow>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  function parseEnvInput(value: string): Record<string, string> {
    const env: Record<string, string> = {};
    value.split(',').forEach((pair) => {
      const [k, ...rest] = pair.trim().split('=');
      if (k) env[k] = rest.join('=');
    });
    return env;
  }

  const configJson = serializeConfig(rows, format);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <section>
        <h2 className="text-section" style={{ marginBottom: '1rem' }}>1. Add servers</h2>
        <div style={{ marginBottom: '1rem' }}>
          <ServerPicker onSelect={addFromDirectory} />
        </div>
        <Button variant="secondary" size="sm" onClick={() => setRows((r) => [...r, newRow()])}>
          + Add custom server
        </Button>
      </section>

      {rows.length > 0 && (
        <section>
          <h2 className="text-section" style={{ marginBottom: '1rem' }}>2. Review &amp; edit</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {rows.map((row) => (
              <Card key={row.id} style={{ padding: '1.25rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                  }}
                >
                  {row.sourceServerId ? (
                    <a
                      href={`/mcp/${row.sourceServerId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.8rem', color: 'var(--accent-color)' }}
                    >
                      View directory listing ↗
                    </a>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => removeRow(row.id)}
                    aria-label="Remove server"
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
                <Input
                  id={`${row.id}-name`}
                  label="Server name (config key)"
                  value={row.name}
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                />
                <Input
                  id={`${row.id}-command`}
                  label="Command"
                  placeholder="npx"
                  value={row.command || ''}
                  onChange={(e) => updateRow(row.id, { command: e.target.value })}
                  disabled={!!row.url}
                />
                <Input
                  id={`${row.id}-args`}
                  label="Args (space-separated)"
                  placeholder="-y @scope/package"
                  value={(row.args || []).join(' ')}
                  onChange={(e) => updateRow(row.id, { args: e.target.value.split(' ').filter(Boolean) })}
                  disabled={!!row.url}
                />
                <Input
                  id={`${row.id}-url`}
                  label="Remote URL (leave blank for a local/stdio server)"
                  placeholder="https://example.com/mcp"
                  value={row.url || ''}
                  onChange={(e) => updateRow(row.id, { url: e.target.value })}
                />
                <Input
                  id={`${row.id}-env`}
                  label="Env vars (KEY=value, comma-separated)"
                  placeholder="API_KEY=xxx, OTHER=yyy"
                  value={Object.entries(row.env || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                  onChange={(e) => updateRow(row.id, { env: parseEnvInput(e.target.value) })}
                />
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-section" style={{ marginBottom: '1rem' }}>3. Choose your client &amp; copy</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {(Object.keys(CLIENT_FORMAT_LABELS) as ClientFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`btn btn-sm ${format === f ? 'btn-primary' : 'btn-secondary'}`}
            >
              {CLIENT_FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Paste into: {CLIENT_CONFIG_PATHS[format].join(' · ')}
        </p>
        <CopyBlock code={configJson} title={CLIENT_CONFIG_PATHS[format][0]} language="json" />
      </section>
    </div>
  );
}
