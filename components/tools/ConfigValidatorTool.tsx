'use client';

import { AlertTriangle, CheckCircle2, FileJson, XCircle } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { trackFeatureUse } from '../../lib/gtag';
import {
  CLIENT_FORMAT_LABELS,
  type ClientFormat,
  detectFormat,
  validateConfig,
} from '../../lib/tools/configFormats';
import { CodePanel, EditorPane } from './CodePanel';

const VALID_EXAMPLE = `{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_yourtoken" }
    }
  }
}`;

const BROKEN_EXAMPLE = `{
  "mcpServers": {
    "filesystem": {
      "args": "-y @modelcontextprotocol/server-filesystem"
    },
    "remote": {
      "url": "example.com/mcp"
    }
  }
}`;

const FORMAT_OPTIONS: Array<{ id: ClientFormat | 'auto'; label: string }> = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'claude', label: 'Claude' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'windsurf', label: 'Windsurf' },
  { id: 'vscode', label: 'VS Code' },
];

export function ConfigValidatorTool() {
  const [raw, setRaw] = useState(VALID_EXAMPLE);
  const [formatOverride, setFormatOverride] = useState<ClientFormat | 'auto'>(
    'auto',
  );

  const result = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      const parsed = JSON.parse(raw);
      const format =
        formatOverride === 'auto' ? detectFormat(parsed) : formatOverride;
      return {
        findings: validateConfig(parsed, format),
        parseError: null as string | null,
        format,
        pretty: JSON.stringify(parsed, null, 2),
      };
    } catch (err) {
      return {
        findings: [],
        parseError: (err as Error).message,
        format: 'claude' as ClientFormat,
        pretty: '',
      };
    }
  }, [raw, formatOverride]);

  // Track a validation once typing settles, not on every keystroke.
  const trackedFormat = result && !result.parseError ? result.format : null;
  useEffect(() => {
    if (!trackedFormat || raw === VALID_EXAMPLE) return;
    const t = setTimeout(
      () => trackFeatureUse('config_validator', { format: trackedFormat }),
      1200,
    );
    return () => clearTimeout(t);
  }, [raw, trackedFormat]);

  const errors = result?.findings.filter((f) => f.level === 'error') ?? [];
  const warnings = result?.findings.filter((f) => f.level === 'warning') ?? [];

  let status: React.ReactNode = null;
  if (result?.parseError)
    status = <span className="tl-status tl-status--err">Invalid JSON</span>;
  else if (result && errors.length > 0)
    status = (
      <span className="tl-status tl-status--err">
        {errors.length} error{errors.length === 1 ? '' : 's'}
      </span>
    );
  else if (result)
    status = <span className="tl-status tl-status--ok">Valid JSON</span>;

  return (
    <div className="tl-workspace">
      <section className="tl-pane" aria-labelledby="cv-in">
        <div className="tl-pane-head">
          <h2 id="cv-in" className="tl-pane-title">
            <span className="tl-step">1</span> Paste your config
          </h2>
          <div className="tl-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRaw(BROKEN_EXAMPLE)}
            >
              Try a broken one
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRaw('')}
              disabled={!raw}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="tl-toolbar">
          <fieldset className="segmented" aria-label="Config format">
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={formatOverride === f.id}
                onClick={() => setFormatOverride(f.id)}
              >
                {f.label}
              </button>
            ))}
          </fieldset>
        </div>
        <EditorPane
          title="config.json"
          value={raw}
          onChange={setRaw}
          ariaLabel="Paste your MCP config JSON"
          placeholder={VALID_EXAMPLE}
          rows={18}
          invalid={!!result?.parseError}
          status={status}
        />
      </section>

      <section
        className="tl-pane tl-sticky"
        aria-labelledby="cv-out"
        aria-live="polite"
      >
        <div className="tl-pane-head">
          <h2 id="cv-out" className="tl-pane-title">
            <span className="tl-step">2</span> Results
          </h2>
          {result && !result.parseError ? (
            <span className="tl-hint">
              Checked as {CLIENT_FORMAT_LABELS[result.format]}
            </span>
          ) : null}
        </div>

        {!result ? (
          <div className="tl-empty">
            <FileJson size={22} aria-hidden="true" />
            <p className="tl-empty-title">Nothing to check yet</p>
            <p style={{ margin: 0 }}>
              Paste a config on the left — results update as you type.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setRaw(VALID_EXAMPLE)}
            >
              Load an example
            </button>
          </div>
        ) : result.parseError ? (
          <div className="tl-alert tl-alert--err" role="alert">
            <XCircle size={18} aria-hidden="true" />
            <div>
              <p className="tl-alert-title">Invalid JSON</p>
              <p className="tl-alert-body">{result.parseError}</p>
              <p className="tl-alert-body" style={{ marginTop: '0.35rem' }}>
                Look for trailing commas, unquoted keys, or single backslashes
                in Windows paths.
              </p>
            </div>
          </div>
        ) : errors.length === 0 && warnings.length === 0 ? (
          <div className="tl-alert tl-alert--ok">
            <CheckCircle2 size={18} aria-hidden="true" />
            <div>
              <p className="tl-alert-title">Looks good</p>
              <p className="tl-alert-body">
                Valid {CLIENT_FORMAT_LABELS[result.format]} config. Save it and
                fully restart your client.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`tl-alert ${errors.length ? 'tl-alert--err' : 'tl-alert--warn'}`}
            >
              {errors.length ? (
                <XCircle size={18} aria-hidden="true" />
              ) : (
                <AlertTriangle size={18} aria-hidden="true" />
              )}
              <p className="tl-alert-title">
                {errors.length > 0
                  ? `${errors.length} error${errors.length === 1 ? '' : 's'}`
                  : 'No errors'}
                {warnings.length > 0
                  ? ` · ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
                  : ''}
              </p>
            </div>
            <ul className="tl-findings">
              {[...errors, ...warnings].map((f, i) => (
                <li
                  key={`${f.level}-${f.path}-${f.message}`}
                  className="tl-finding"
                  style={{ '--i': i } as React.CSSProperties}
                >
                  <span
                    className={`tl-tag ${f.level === 'error' ? 'tl-tag--err' : 'tl-tag--warn'}`}
                  >
                    {f.level}
                  </span>
                  <span>
                    <code>{f.path}</code> — {f.message}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {result && !result.parseError && result.pretty ? (
          <CodePanel title="Formatted" code={result.pretty} maxHeight="20rem" />
        ) : null}
      </section>
    </div>
  );
}
