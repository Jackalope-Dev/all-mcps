'use client';

import { AlertTriangle, Loader2, Play, Plug, Wrench } from 'lucide-react';
import { useState } from 'react';
import { trackFeatureUse } from '../../lib/gtag';
import { CodePanel, EditorPane } from './CodePanel';

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
  const [serverInfo, setServerInfo] = useState<{
    name?: string;
    version?: string;
  } | null>(null);
  const [tools, setTools] = useState<Tool[] | null>(null);

  const [selected, setSelected] = useState<Tool | null>(null);
  const [argsText, setArgsText] = useState('{}');
  const [calling, setCalling] = useState(false);
  const [callResult, setCallResult] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const headers = token.trim()
    ? { Authorization: `Bearer ${token.trim()}` }
    : undefined;

  const trimmedUrl = url.trim();
  const urlLooksValid = /^https?:\/\/\S+$/i.test(trimmedUrl);

  const connect = async () => {
    if (!urlLooksValid || connecting) return;
    trackFeatureUse('live_mcp_inspector', { action: 'connect' });
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
        body: JSON.stringify({
          url: trimmedUrl,
          method: 'tools/list',
          headers,
        }),
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
    const schema = tool.inputSchema as
      | { properties?: Record<string, unknown> }
      | undefined;
    if (schema?.properties && typeof schema.properties === 'object') {
      const skeleton: Record<string, unknown> = {};
      for (const key of Object.keys(schema.properties)) skeleton[key] = '';
      setArgsText(JSON.stringify(skeleton, null, 2));
    } else {
      setArgsText('{}');
    }
  };

  let argsError: string | null = null;
  try {
    if (argsText.trim()) JSON.parse(argsText);
  } catch {
    argsError = 'Arguments must be valid JSON.';
  }

  const callTool = async () => {
    if (!selected || argsError) return;
    const args = argsText.trim() ? JSON.parse(argsText) : {};
    setCalling(true);
    setCallError(null);
    setCallResult(null);
    try {
      const res = await fetch('/api/v1/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmedUrl,
          method: 'tools/call',
          params: { name: selected.name, arguments: args },
          headers,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        result?: unknown;
      };
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

  return (
    <div className="tl-workspace tl-workspace--wide-out">
      <section className="tl-pane" aria-labelledby="li-connect">
        <div className="tl-pane-head">
          <h2 id="li-connect" className="tl-pane-title">
            <span className="tl-step">1</span> Connect
          </h2>
        </div>
        <p className="tl-pane-sub">
          Any public Streamable HTTP endpoint. Requests are proxied server-side,
          so CORS never blocks you.
        </p>
        <form
          className="tl-pane tl-pane--flush"
          onSubmit={(e) => {
            e.preventDefault();
            connect();
          }}
        >
          <label className="tl-field">
            <span className="tl-label">MCP endpoint URL</span>
            <input
              type="url"
              className="tl-input"
              placeholder="https://example.com/mcp"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={(!!trimmedUrl && !urlLooksValid) || undefined}
              spellCheck={false}
            />
            {trimmedUrl && !urlLooksValid ? (
              <span className="tl-hint" style={{ color: 'var(--tl-err)' }}>
                Enter a full http(s):// URL.
              </span>
            ) : (
              <button
                type="button"
                className="tl-link-btn"
                onClick={() => setUrl('https://allmcps.com/api/mcp')}
              >
                Try the AllMCPs server
              </button>
            )}
          </label>
          <label className="tl-field">
            <span className="tl-label">
              Bearer token <span className="tl-label-opt">(optional)</span>
            </span>
            <input
              type="password"
              className="tl-input"
              placeholder="For authenticated servers"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="tl-actions">
            <button
              type="submit"
              className="btn btn-primary btn-md"
              disabled={connecting || !urlLooksValid}
            >
              {connecting ? (
                <Loader2 size={16} className="tl-spin" aria-hidden="true" />
              ) : (
                <Plug size={16} aria-hidden="true" />
              )}
              {connecting ? 'Connecting…' : 'Connect & list tools'}
            </button>
          </div>
        </form>

        {error ? (
          <div className="tl-alert tl-alert--err" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}

        {tools ? (
          <div aria-live="polite">
            <p className="tl-hint" style={{ marginBottom: '0.6rem' }}>
              {serverInfo?.name ? (
                <>
                  Connected to{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {serverInfo.name}
                  </strong>
                  {serverInfo.version ? ` v${serverInfo.version}` : ''} ·{' '}
                </>
              ) : (
                <>Connected · </>
              )}
              {tools.length} tool{tools.length === 1 ? '' : 's'}
            </p>
            {tools.length > 0 ? (
              <ul className="li-tools">
                {tools.map((tool) => (
                  <li key={tool.name}>
                    <button
                      type="button"
                      onClick={() => selectTool(tool)}
                      className={`li-tool ${selected?.name === tool.name ? 'is-active' : ''}`}
                      aria-pressed={selected?.name === tool.name}
                    >
                      <span className="li-tool-name">
                        <Wrench size={13} aria-hidden="true" />
                        <code>{tool.name}</code>
                      </span>
                      {tool.description ? (
                        <span className="li-tool-desc">{tool.description}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section
        className="tl-pane tl-sticky"
        aria-labelledby="li-call"
        aria-live="polite"
      >
        <div className="tl-pane-head">
          <h2 id="li-call" className="tl-pane-title">
            <span className="tl-step">2</span> Call a tool
          </h2>
        </div>
        {!selected ? (
          <div className="tl-empty">
            <Wrench size={22} aria-hidden="true" />
            <p className="tl-empty-title">
              {tools ? 'Pick a tool' : 'Not connected'}
            </p>
            <p style={{ margin: 0 }}>
              {tools
                ? 'Choose a tool on the left to prefill its arguments.'
                : 'Connect to a server to list its tools, then call one here.'}
            </p>
          </div>
        ) : (
          <>
            <EditorPane
              title={`${selected.name} · arguments`}
              value={argsText}
              onChange={setArgsText}
              ariaLabel={`Arguments for ${selected.name} (JSON)`}
              rows={8}
              invalid={!!argsError}
              status={
                argsError ? (
                  <span className="tl-status tl-status--err">Invalid JSON</span>
                ) : null
              }
            />
            <div className="tl-actions">
              <button
                type="button"
                className="btn btn-primary btn-md"
                onClick={callTool}
                disabled={calling || !!argsError}
              >
                {calling ? (
                  <Loader2 size={16} className="tl-spin" aria-hidden="true" />
                ) : (
                  <Play size={16} aria-hidden="true" />
                )}
                {calling ? 'Calling…' : 'Call tool'}
              </button>
            </div>
            {callError ? (
              <div className="tl-alert tl-alert--err" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                <p>{callError}</p>
              </div>
            ) : null}
            {callResult !== null ? (
              <CodePanel
                title="result.json"
                code={callResult}
                maxHeight="26rem"
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
