'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Plug, Loader2, Wrench, Play, AlertTriangle } from 'lucide-react';

type Tool = { name: string; description?: string; inputSchema?: unknown };

/**
 * Live MCP connection panel. Talks to a remote MCP (Streamable HTTP) endpoint
 * through our server-side proxy (/api/v1/inspect) so there's no browser CORS
 * wall — connect, list the real tools, and call one with structured input.
 */
export function LiveMcpInspector() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState<{ name?: string; version?: string } | null>(null);
  const [tools, setTools] = useState<Tool[] | null>(null);

  const [selected, setSelected] = useState<Tool | null>(null);
  const [argsText, setArgsText] = useState('{}');
  const [calling, setCalling] = useState(false);
  const [callResult, setCallResult] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const headers = token.trim() ? { Authorization: `Bearer ${token.trim()}` } : undefined;

  const connect = async () => {
    setConnecting(true);
    setError(null);
    setServerInfo(null);
    setTools(null);
    setSelected(null);
    setCallResult(null);
    setCallError(null);
    try {
      const res = await fetch('/api/v1/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), method: 'tools/list', headers }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        serverInfo?: { name?: string; version?: string };
        tools?: Tool[];
      };
      if (!data.ok) {
        setError(data.error || 'Could not connect.');
        return;
      }
      setServerInfo(data.serverInfo || {});
      setTools(data.tools || []);
    } catch {
      setError('Request failed. Check the URL and try again.');
    } finally {
      setConnecting(false);
    }
  };

  const selectTool = (tool: Tool) => {
    setSelected(tool);
    setCallResult(null);
    setCallError(null);
    // Prefill an args skeleton from the tool's inputSchema when available.
    const schema = tool.inputSchema as { properties?: Record<string, unknown> } | undefined;
    if (schema?.properties && typeof schema.properties === 'object') {
      const skeleton: Record<string, unknown> = {};
      for (const key of Object.keys(schema.properties)) skeleton[key] = '';
      setArgsText(JSON.stringify(skeleton, null, 2));
    } else {
      setArgsText('{}');
    }
  };

  const callTool = async () => {
    if (!selected) return;
    let args: unknown;
    try {
      args = argsText.trim() ? JSON.parse(argsText) : {};
    } catch {
      setCallError('Arguments must be valid JSON.');
      return;
    }
    setCalling(true);
    setCallError(null);
    setCallResult(null);
    try {
      const res = await fetch('/api/v1/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          method: 'tools/call',
          params: { name: selected.name, arguments: args },
          headers,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; result?: unknown };
      if (!data.ok) {
        setCallError(data.error || 'Tool call failed.');
        return;
      }
      setCallResult(JSON.stringify(data.result, null, 2));
    } catch {
      setCallError('Request failed.');
    } finally {
      setCalling(false);
    }
  };

  const label = { display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' } as const;
  const field = {
    width: '100%',
    padding: '0.7rem 0.85rem',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-muted)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
  } as const;

  return (
    <Card style={{ padding: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <Plug size={20} style={{ color: 'var(--accent-color)' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Live Connection</h2>
      </div>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
        Connect to a remote MCP server (Streamable HTTP endpoint), list its real tools, and call one — all
        proxied server-side, so CORS never blocks you. Works with any public HTTP MCP endpoint.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={label} htmlFor="mcp-url">MCP endpoint URL</label>
          <input
            id="mcp-url"
            type="url"
            placeholder="https://example.com/mcp"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={field}
          />
        </div>
        <div>
          <label style={label} htmlFor="mcp-token">Bearer token (optional)</label>
          <input
            id="mcp-token"
            type="password"
            placeholder="For authenticated servers"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={field}
          />
        </div>
        <div>
          <Button onClick={connect} disabled={connecting || !url.trim()}>
            {connecting ? <Loader2 size={16} /> : <Plug size={16} />}
            {connecting ? 'Connecting…' : 'Connect & list tools'}
          </Button>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            background: 'rgba(239, 68, 68, 0.08)',
            color: '#ef4444',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {tools && (
        <div style={{ marginTop: '1.5rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            {serverInfo?.name ? (
              <>Connected to <strong style={{ color: 'var(--text-primary)' }}>{serverInfo.name}</strong>{serverInfo.version ? ` v${serverInfo.version}` : ''} — </>
            ) : (
              <>Connected — </>
            )}
            {tools.length} tool{tools.length === 1 ? '' : 's'} exposed.
          </p>

          {tools.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.6rem' }}>
              {tools.map((tool) => (
                <button
                  key={tool.name}
                  type="button"
                  onClick={() => selectTool(tool)}
                  style={{
                    textAlign: 'left',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    border: `1px solid ${selected?.name === tool.name ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    background: selected?.name === tool.name ? 'var(--brand-gradient-soft)' : 'var(--bg-muted)',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                    <Wrench size={13} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                    <code style={{ fontSize: '0.8rem', fontWeight: 700, wordBreak: 'break-word' }}>{tool.name}</code>
                  </div>
                  {tool.description && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {tool.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <label style={label} htmlFor="mcp-args">
            Call <code style={{ color: 'var(--accent-color)' }}>{selected.name}</code> with arguments (JSON)
          </label>
          <textarea
            id="mcp-args"
            value={argsText}
            onChange={(e) => setArgsText(e.target.value)}
            rows={6}
            spellCheck={false}
            style={{ ...field, fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
          />
          <div style={{ marginTop: '0.75rem' }}>
            <Button onClick={callTool} disabled={calling}>
              {calling ? <Loader2 size={16} /> : <Play size={16} />}
              {calling ? 'Calling…' : 'Call tool'}
            </Button>
          </div>

          {callError && (
            <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', fontSize: '0.85rem' }}>
              {callError}
            </div>
          )}

          {callResult !== null && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Response</div>
              <pre style={{ margin: 0, padding: '1rem', borderRadius: '10px', background: 'var(--bg-muted)', border: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-primary)', overflowX: 'auto', maxHeight: '360px' }}>
                <code>{callResult}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
