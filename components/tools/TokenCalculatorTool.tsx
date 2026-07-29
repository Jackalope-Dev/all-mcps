'use client';

import { useMemo, useState } from 'react';
import { Card } from '../ui/Card';
import { ServerPicker, DirectoryServerHit } from './ServerPicker';
import { extractTools, computeToolTokens } from '../../lib/tools/tokenize';

const AVERAGE_TOKENS_PER_SERVER = 600;

const CONTEXT_WINDOWS = [
  { label: '128K (GPT-4 class)', size: 128000 },
  { label: '200K (Claude)', size: 200000 },
  { label: '1M (Claude long context)', size: 1000000 },
];

export function TokenCalculatorTool() {
  const [tab, setTab] = useState<'paste' | 'directory'>('paste');
  const [raw, setRaw] = useState('');
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

  const directoryTotal = selected.length * AVERAGE_TOKENS_PER_SERVER;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setTab('paste')}
          className={`btn btn-sm ${tab === 'paste' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Paste your tools JSON
        </button>
        <button
          onClick={() => setTab('directory')}
          className={`btn btn-sm ${tab === 'directory' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Quick estimate from directory
        </button>
      </div>

      {tab === 'paste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Paste the raw <code>tools/list</code> JSON-RPC response from your MCP server (or a bare array of tool
            schemas). Counts use a GPT-4-class tokenizer as an approximation &mdash; exact counts vary by model.
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={12}
            className="form-input"
            style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
            placeholder='{"result": {"tools": [{"name": "search", "description": "...", "inputSchema": {}}]}}'
            aria-label="Paste your tools JSON"
          />
          {pasteResult && 'error' in pasteResult && (
            <div className="surface-muted" style={{ padding: '1rem', borderLeft: '3px solid #ef4444', wordBreak: 'break-word' }}>
              {pasteResult.error}
            </div>
          )}
          {pasteResult && 'total' in pasteResult && (
            <div>
              <h3 className="text-section" style={{ marginBottom: '0.5rem' }}>
                Total: {pasteResult.total.toLocaleString()} tokens
              </h3>
              <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', paddingLeft: '1.25rem' }}>
                {CONTEXT_WINDOWS.map((w) => (
                  <li key={w.label}>
                    ≈ {((pasteResult.total / w.size) * 100).toFixed(2)}% of a {w.label} context window
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {pasteResult.breakdown.map((t) => (
                  <div
                    key={t.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      fontSize: '0.85rem',
                      borderBottom: '1px solid var(--border-color)',
                      padding: '0.4rem 0',
                    }}
                  >
                    <code style={{ wordBreak: 'break-all' }}>{t.name}</code>
                    <span style={{ flexShrink: 0, fontWeight: 500 }}>{t.tokens.toLocaleString()} tokens</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'directory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Rough estimate only &mdash; assumes ~{AVERAGE_TOKENS_PER_SERVER} tokens per server. Actual cost depends
            on each server's real tool count and schema complexity. Use "Paste your tools JSON" for an exact number.
          </p>
          <ServerPicker
            onSelect={(server) =>
              setSelected((s) => (s.some((x) => x.id === server.id) ? s : [...s, server]))
            }
          />
          {selected.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selected.map((server) => (
                <Card
                  key={server.id}
                  style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <a href={`/mcp/${server.id}`} target="_blank" rel="noopener noreferrer">
                    {server.name}
                  </a>
                  <button
                    onClick={() => setSelected((s) => s.filter((x) => x.id !== server.id))}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </Card>
              ))}
              <h3 className="text-section" style={{ marginTop: '0.5rem' }}>
                ~{directoryTotal.toLocaleString()} tokens (estimate)
              </h3>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
