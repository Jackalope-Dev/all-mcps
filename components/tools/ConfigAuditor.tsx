'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Plus,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { auditMcpConfig, mergeServerIntoConfig } from '../../lib/configAudit';
import { trackFeatureUse } from '../../lib/gtag';
import {
  isRemoteHint,
  parseInstallHint,
} from '../../lib/tools/parseInstallHint';
import { CopyButton, EditorPane } from './CodePanel';
import { type DirectoryServerHit, ServerPicker } from './ServerPicker';

const SAMPLE_CONFIG = `{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_GITHUB_TOKEN>"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    }
  }
}`;

const SAMPLE_SERVERS = [
  {
    id: 'modelcontextprotocol-server-sqlite',
    name: 'SQLite',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite'],
  },
  {
    id: 'modelcontextprotocol-server-filesystem',
    name: 'Filesystem',
    command: 'npx',
    args: [
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '/Users/username/Desktop',
    ],
  },
  {
    id: 'modelcontextprotocol-server-memory',
    name: 'Memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
  {
    id: 'modelcontextprotocol-server-fetch',
    name: 'Fetch',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
  },
  {
    id: 'modelcontextprotocol-server-git',
    name: 'Git',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git'],
  },
];

const FORMAT_NAMES: Record<string, string> = {
  claude: 'Claude Desktop',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  cline: 'Cline',
  zed: 'Zed',
  'vs-code': 'VS Code',
  unknown: 'Unknown',
};

function slugKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Adds a remote (URL) server under mcpServers — mergeServerIntoConfig only knows stdio. */
function mergeRemote(existing: string, key: string, url: string): string {
  let obj: Record<string, any>;
  try {
    obj = existing.trim() ? JSON.parse(existing) : {};
  } catch {
    obj = {};
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) obj = {};
  if (!obj.mcpServers) obj.mcpServers = {};
  obj.mcpServers[key] = { url };
  return JSON.stringify(obj, null, 2);
}

export function ConfigAuditor() {
  const [jsonText, setJsonText] = useState(SAMPLE_CONFIG);
  const [mergeNote, setMergeNote] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const audit = useMemo(() => auditMcpConfig(jsonText), [jsonText]);
  const errors = audit.issues.filter((i) => i.type === 'error').length;
  const warnings = audit.issues.filter((i) => i.type === 'warning').length;

  const handleMergeServer = (s: {
    id: string;
    name: string;
    command: string;
    args: string[];
  }) => {
    setJsonText((t) => mergeServerIntoConfig(t, s));
    setMergeNote({ ok: true, text: `Merged ${s.name} into your config.` });
    trackFeatureUse('config_auditor', {
      action: 'merge_server',
      server_id: s.id,
    });
  };

  const handleDirectoryHit = (hit: DirectoryServerHit) => {
    const hint = parseInstallHint(hit.description);
    const key = slugKey(hit.name);
    if (hint && isRemoteHint(hint)) {
      setJsonText((t) => mergeRemote(t, key, hint.url));
      setMergeNote({ ok: true, text: `Merged ${hit.name} (remote URL).` });
      trackFeatureUse('config_auditor', {
        action: 'merge_server',
        server_id: hit.id,
      });
    } else if (hint) {
      handleMergeServer({
        id: key,
        name: hit.name,
        command: hint.command,
        args: hint.args,
      });
    } else {
      setMergeNote({
        ok: false,
        text: `${hit.name} has no install command we can read. Open its listing for setup steps.`,
      });
    }
  };

  const status = !jsonText.trim() ? null : !audit.isValidJson ? (
    <span className="tl-status tl-status--err">Invalid JSON</span>
  ) : (
    <span className="tl-status tl-status--ok">Valid JSON</span>
  );

  return (
    <div className="tl-workspace tl-workspace--wide-in">
      <section className="tl-pane" aria-labelledby="ca-in">
        <div className="tl-pane-head">
          <h2 id="ca-in" className="tl-pane-title">
            <span className="tl-step">1</span> Paste your config
          </h2>
          <div className="tl-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setJsonText(SAMPLE_CONFIG)}
            >
              Load sample
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setJsonText('')}
              disabled={!jsonText}
            >
              Clear
            </button>
          </div>
        </div>
        <EditorPane
          title="claude_desktop_config.json · .cursor/mcp.json · …"
          value={jsonText}
          onChange={setJsonText}
          ariaLabel="Paste your MCP config JSON"
          placeholder="Paste your JSON configuration here…"
          rows={18}
          invalid={!!jsonText.trim() && !audit.isValidJson}
          status={status}
          actions={
            <CopyButton
              text={jsonText}
              disabled={!jsonText.trim()}
              onCopied={() =>
                trackFeatureUse('config_auditor', { action: 'copy_config' })
              }
            />
          }
        />

        <div className="tl-field">
          <span className="tl-label">Merge a server from the directory</span>
          <ServerPicker
            onSelect={handleDirectoryHit}
            placeholder="Search servers to merge…"
          />
          <div className="tl-toolbar" style={{ marginTop: '0.25rem' }}>
            <span className="tl-hint">Popular:</span>
            {SAMPLE_SERVERS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="chip"
                onClick={() => handleMergeServer(s)}
              >
                <Plus size={12} aria-hidden="true" />
                {s.name}
              </button>
            ))}
          </div>
          {mergeNote ? (
            <p
              className="tl-hint"
              role="status"
              style={{
                color: mergeNote.ok ? 'var(--tl-ok)' : 'var(--tl-warn)',
              }}
            >
              {mergeNote.text}
            </p>
          ) : null}
        </div>
      </section>

      <section
        className="tl-pane tl-sticky"
        aria-labelledby="ca-out"
        aria-live="polite"
      >
        <div className="tl-pane-head">
          <h2 id="ca-out" className="tl-pane-title">
            <span className="tl-step">2</span> Audit report
          </h2>
        </div>

        <div className="tl-stats">
          <div className="tl-stat">
            <span
              className="tl-stat-value"
              style={{
                fontSize: '0.92rem',
                lineHeight: 1.3,
                paddingTop: '0.3rem',
              }}
            >
              {FORMAT_NAMES[audit.formatDetected] ?? audit.formatDetected}
            </span>
            <span className="tl-stat-label">Detected format</span>
          </div>
          <div className="tl-stat">
            <span className="tl-stat-value">{audit.serverCount}</span>
            <span className="tl-stat-label">Servers</span>
          </div>
          <div className="tl-stat">
            <span
              className="tl-stat-value"
              style={errors ? { color: 'var(--tl-err)' } : undefined}
            >
              {errors}
            </span>
            <span className="tl-stat-label">Errors</span>
          </div>
          <div className="tl-stat">
            <span
              className="tl-stat-value"
              style={warnings ? { color: 'var(--tl-warn)' } : undefined}
            >
              {warnings}
            </span>
            <span className="tl-stat-label">Warnings</span>
          </div>
        </div>

        {audit.issues.length === 0 ? (
          <div className="tl-alert tl-alert--ok">
            <CheckCircle2 size={18} aria-hidden="true" />
            <div>
              <p className="tl-alert-title">No issues found</p>
              <p className="tl-alert-body">
                Copy the config back into your client and restart it.
              </p>
            </div>
          </div>
        ) : (
          <ul className="tl-findings">
            {audit.issues.map((issue, idx) => {
              const Icon =
                issue.type === 'error'
                  ? AlertCircle
                  : issue.type === 'warning'
                    ? AlertTriangle
                    : Info;
              const tone =
                issue.type === 'error'
                  ? 'err'
                  : issue.type === 'warning'
                    ? 'warn'
                    : 'info';
              return (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: issues are recomputed wholesale per edit.
                  key={idx}
                  className={`tl-alert tl-alert--${tone}`}
                  style={{ '--i': idx } as React.CSSProperties}
                >
                  <Icon size={18} aria-hidden="true" />
                  <div>
                    <p className="tl-alert-title">{issue.message}</p>
                    {issue.suggestion ? (
                      <p className="tl-alert-body">{issue.suggestion}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
