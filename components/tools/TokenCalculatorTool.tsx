'use client';

import { Calculator, ExternalLink, X, XCircle } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { trackFeatureUse } from '../../lib/gtag';
import { computeToolTokens, extractTools } from '../../lib/tools/tokenize';
import { EditorPane } from './CodePanel';
import { type DirectoryServerHit, ServerPicker } from './ServerPicker';

const AVERAGE_TOKENS_PER_SERVER = 600;

const CONTEXT_WINDOWS = [
  { label: '128K', note: 'GPT-4 class', size: 128000 },
  { label: '200K', note: 'Claude', size: 200000 },
  { label: '1M', note: 'Claude long context', size: 1000000 },
];

const EXAMPLE_TOOLS = `{
  "result": {
    "tools": [
      {
        "name": "search_issues",
        "description": "Search GitHub issues and pull requests by query, repository, label, or state.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": { "type": "string", "description": "GitHub search syntax" },
            "repo": { "type": "string", "description": "owner/name" },
            "state": { "type": "string", "enum": ["open", "closed", "all"] },
            "limit": { "type": "number", "default": 20 }
          },
          "required": ["query"]
        }
      },
      {
        "name": "create_issue",
        "description": "Open a new issue in a repository.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "repo": { "type": "string" },
            "title": { "type": "string" },
            "body": { "type": "string" },
            "labels": { "type": "array", "items": { "type": "string" } }
          },
          "required": ["repo", "title"]
        }
      }
    ]
  }
}`;

function pct(tokens: number, size: number) {
  const p = (tokens / size) * 100;
  return p < 0.01 && p > 0 ? '<0.01' : p.toFixed(p < 1 ? 2 : 1);
}

export function TokenCalculatorTool() {
  const [tab, setTab] = useState<'paste' | 'directory'>('paste');
  const [raw, setRaw] = useState(EXAMPLE_TOOLS);
  const [selected, setSelected] = useState<DirectoryServerHit[]>([]);

  const pasteResult = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      const parsed = JSON.parse(raw);
      const tools = extractTools(parsed);
      if (tools.length === 0) {
        return {
          error:
            'No tools found — expected a tools/list response ({"result":{"tools":[...]}}) or a bare array of {name, description, inputSchema}.',
        };
      }
      return computeToolTokens(tools);
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [raw]);

  const pasteTotal =
    pasteResult && 'total' in pasteResult ? pasteResult.total : null;

  // Report a calculation once typing settles, not on every keystroke.
  useEffect(() => {
    if (pasteTotal === null || raw === EXAMPLE_TOOLS) return;
    const t = setTimeout(
      () =>
        trackFeatureUse('token_calculator', {
          mode: 'paste',
          total_tokens: pasteTotal,
        }),
      1200,
    );
    return () => clearTimeout(t);
  }, [raw, pasteTotal]);

  const directoryTotal = selected.length * AVERAGE_TOKENS_PER_SERVER;
  const total = tab === 'paste' ? pasteTotal : directoryTotal;
  const breakdown =
    tab === 'paste' && pasteResult && 'breakdown' in pasteResult
      ? [...pasteResult.breakdown].sort((a, b) => b.tokens - a.tokens)
      : [];
  const maxTool = breakdown[0]?.tokens ?? 1;
  const addedIds = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected],
  );

  return (
    <div className="tl-workspace">
      <section className="tl-pane" aria-labelledby="tc-in">
        <div className="tl-pane-head">
          <h2 id="tc-in" className="tl-pane-title">
            <span className="tl-step">1</span> Your tools
          </h2>
        </div>
        <fieldset className="segmented" aria-label="Input mode">
          <button
            type="button"
            aria-pressed={tab === 'paste'}
            onClick={() => setTab('paste')}
          >
            Paste tools JSON
          </button>
          <button
            type="button"
            aria-pressed={tab === 'directory'}
            onClick={() => setTab('directory')}
          >
            Estimate from directory
          </button>
        </fieldset>

        {tab === 'paste' ? (
          <>
            <p className="tl-pane-sub" style={{ margin: 0 }}>
              Paste the raw <code>tools/list</code> response from your server
              (or a bare array of tool schemas). The example below is a small
              GitHub-style server.
            </p>
            <EditorPane
              title="tools/list response"
              value={raw}
              onChange={setRaw}
              ariaLabel="Paste your tools JSON"
              placeholder='{"result": {"tools": [{"name": "search", "description": "...", "inputSchema": {}}]}}'
              rows={18}
              invalid={!!pasteResult && 'error' in pasteResult}
              actions={
                <button
                  type="button"
                  className="tl-code-btn"
                  onClick={() => setRaw('')}
                  disabled={!raw}
                >
                  Clear
                </button>
              }
            />
            {pasteResult && 'error' in pasteResult ? (
              <div className="tl-alert tl-alert--err" role="alert">
                <XCircle size={18} aria-hidden="true" />
                <p>{pasteResult.error}</p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="tl-pane-sub" style={{ margin: 0 }}>
              Rough estimate only &mdash; assumes ~{AVERAGE_TOKENS_PER_SERVER}{' '}
              tokens per server. Real cost depends on each server&apos;s tool
              count and schema size. Paste tools JSON for an exact number.
            </p>
            <ServerPicker
              addedIds={addedIds}
              onSelect={(server) =>
                setSelected((s) =>
                  s.some((x) => x.id === server.id) ? s : [...s, server],
                )
              }
            />
            {selected.length === 0 ? (
              <div className="tl-empty">
                <Calculator size={22} aria-hidden="true" />
                <p style={{ margin: 0 }}>
                  Add the servers you have installed to estimate their combined
                  overhead.
                </p>
              </div>
            ) : (
              <ul className="tl-rows">
                {selected.map((server) => (
                  <li
                    key={server.id}
                    className="tl-row"
                    style={{ padding: '0.55rem 0.6rem 0.55rem 0.9rem' }}
                  >
                    <div className="tl-row-head" style={{ margin: 0 }}>
                      <span className="tl-row-title">{server.name}</span>
                      <span className="tl-hint tabular">
                        ~{AVERAGE_TOKENS_PER_SERVER}
                      </span>
                      <a
                        href={`/mcp/${server.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tl-icon-btn"
                        aria-label={`View ${server.name} (opens in new tab)`}
                      >
                        <ExternalLink size={15} />
                      </a>
                      <button
                        type="button"
                        className="tl-icon-btn tl-icon-btn--danger"
                        aria-label={`Remove ${server.name}`}
                        onClick={() =>
                          setSelected((s) =>
                            s.filter((x) => x.id !== server.id),
                          )
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section
        className="tl-pane tl-sticky"
        aria-labelledby="tc-out"
        aria-live="polite"
      >
        <div className="tl-pane-head">
          <h2 id="tc-out" className="tl-pane-title">
            <span className="tl-step">2</span> Context cost
          </h2>
        </div>

        <div className="tc-total">
          <span className="tc-total-value tabular">
            {total === null
              ? '—'
              : `${tab === 'directory' ? '~' : ''}${total.toLocaleString()}`}
          </span>
          <span className="tc-total-label">
            tokens on every turn
            {tab === 'directory' ? ' (estimate)' : ''}
          </span>
        </div>

        <ul className="tc-windows">
          {CONTEXT_WINDOWS.map((w) => {
            const used = total ?? 0;
            const width = Math.min(100, (used / w.size) * 100);
            return (
              <li key={w.label}>
                <div className="tc-window-row">
                  <span>
                    <strong>{w.label}</strong>{' '}
                    <span className="tl-hint">{w.note}</span>
                  </span>
                  <span className="tabular">{pct(used, w.size)}%</span>
                </div>
                <div className="tl-meter">
                  <span
                    style={{ width: `${Math.max(width, used ? 0.6 : 0)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {breakdown.length > 0 ? (
          <div>
            <p className="tl-label" style={{ margin: '0 0 0.5rem' }}>
              Per tool ({breakdown.length})
            </p>
            <ul className="tc-bars">
              {breakdown.map((t, i) => (
                <li key={t.name} style={{ '--i': i } as React.CSSProperties}>
                  <code>{t.name}</code>
                  <span className="tc-bar" aria-hidden="true">
                    <span style={{ width: `${(t.tokens / maxTool) * 100}%` }} />
                  </span>
                  <span className="tabular">{t.tokens.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="tl-hint">
          Counts use a GPT-4-class tokenizer as an approximation &mdash; exact
          counts vary by model.
        </p>
      </section>
    </div>
  );
}
