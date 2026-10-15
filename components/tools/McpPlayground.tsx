'use client';

import { Loader2, Send, Terminal } from 'lucide-react';
import { useState } from 'react';
import { trackFeatureUse } from '../../lib/gtag';
import { CodePanel } from './CodePanel';

type Method =
  | 'initialize'
  | 'tools/list'
  | 'search_mcp_servers'
  | 'get_mcp_install_config'
  | 'list_mcp_categories';

const METHODS: Array<{ id: Method; label: string; hint: string }> = [
  {
    id: 'search_mcp_servers',
    label: 'search_mcp_servers',
    hint: 'tools/call — search the directory',
  },
  {
    id: 'get_mcp_install_config',
    label: 'get_mcp_install_config',
    hint: 'tools/call — install config for a server',
  },
  {
    id: 'list_mcp_categories',
    label: 'list_mcp_categories',
    hint: 'tools/call — list categories',
  },
  { id: 'tools/list', label: 'tools/list', hint: 'List the server’s tools' },
  { id: 'initialize', label: 'initialize', hint: 'Protocol handshake' },
];

const DEFAULT_ENDPOINT = 'https://allmcps.com/api/mcp';

interface ResponseState {
  body: string;
  ok: boolean;
  status: number | null;
  ms: number;
}

export function McpPlayground() {
  const [endpointUrl, setEndpointUrl] = useState(DEFAULT_ENDPOINT);
  const [selectedMethod, setSelectedMethod] =
    useState<Method>('search_mcp_servers');
  const [searchQuery, setSearchQuery] = useState('postgres');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseState | null>(null);

  const getJsonRpcPayload = () => {
    switch (selectedMethod) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            clientInfo: { name: 'MCP Playground Console', version: '1.0.0' },
          },
        };
      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        };
      case 'search_mcp_servers':
        return {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'search_mcp_servers',
            arguments: { query: searchQuery, limit: 5 },
          },
        };
      case 'get_mcp_install_config':
        return {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'get_mcp_install_config',
            arguments: {
              server_name: searchQuery || 'postgres',
              client: 'claude',
            },
          },
        };
      case 'list_mcp_categories':
        return {
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'list_mcp_categories',
            arguments: {},
          },
        };
    }
  };

  const urlValid = /^https?:\/\/\S+$/i.test(endpointUrl.trim());
  const needsQuery =
    selectedMethod === 'search_mcp_servers' ||
    selectedMethod === 'get_mcp_install_config';

  const handleExecute = async () => {
    if (!urlValid || loading) return;
    trackFeatureUse('mcp_playground', { method: selectedMethod });
    setLoading(true);
    const started = performance.now();
    try {
      const payload = getJsonRpcPayload();
      const res = await fetch(endpointUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let body = text;
      let rpcError = false;
      try {
        const data = JSON.parse(text);
        rpcError = !!data?.error || !!data?.result?.isError;
        body = JSON.stringify(data, null, 2);
      } catch {
        // Not JSON (SSE stream, HTML error page) — show it raw.
      }
      setResponse({
        body,
        ok: res.ok && !rpcError,
        status: res.status,
        ms: Math.round(performance.now() - started),
      });
    } catch (e: any) {
      setResponse({
        body: JSON.stringify(
          {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32603,
              message: e.message || 'Failed to connect to MCP endpoint',
            },
          },
          null,
          2,
        ),
        ok: false,
        status: null,
        ms: Math.round(performance.now() - started),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tl-workspace tl-workspace--wide-out">
      <section className="tl-pane" aria-labelledby="pg-req">
        <div className="tl-pane-head">
          <h2 id="pg-req" className="tl-pane-title">
            <span className="tl-step">1</span> Build a request
          </h2>
        </div>
        <form
          className="tl-pane tl-pane--flush"
          onSubmit={(e) => {
            e.preventDefault();
            handleExecute();
          }}
        >
          <label className="tl-field">
            <span className="tl-label">MCP endpoint URL</span>
            <input
              type="url"
              className="tl-input"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://…"
              aria-invalid={!urlValid || undefined}
              spellCheck={false}
            />
            {!urlValid ? (
              <span className="tl-hint" style={{ color: 'var(--tl-err)' }}>
                Enter a full http(s):// URL.
              </span>
            ) : endpointUrl !== DEFAULT_ENDPOINT ? (
              <button
                type="button"
                className="tl-hint"
                style={{
                  background: 'none',
                  border: 0,
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--accent-color)',
                }}
                onClick={() => setEndpointUrl(DEFAULT_ENDPOINT)}
              >
                Reset to the AllMCPs server
              </button>
            ) : (
              <span className="tl-hint">
                Defaults to the AllMCPs MCP server so you can try it now.
              </span>
            )}
          </label>

          <fieldset
            className="tl-field"
            style={{ border: 0, margin: 0, padding: 0 }}
          >
            <legend className="tl-label" style={{ marginBottom: '0.35rem' }}>
              Method
            </legend>
            <div className="pg-methods">
              {METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`pg-method ${selectedMethod === m.id ? 'is-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="pg-method"
                    value={m.id}
                    checked={selectedMethod === m.id}
                    onChange={() => setSelectedMethod(m.id)}
                  />
                  <span className="pg-method-name">{m.label}</span>
                  <span className="pg-method-hint">{m.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {needsQuery ? (
            <label className="tl-field">
              <span className="tl-label">
                {selectedMethod === 'search_mcp_servers'
                  ? 'Search query'
                  : 'Server name'}
              </span>
              <input
                type="text"
                className="tl-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. postgres, github, slack"
              />
            </label>
          ) : null}

          <div className="tl-actions">
            <button
              type="submit"
              className="btn btn-primary btn-md"
              disabled={loading || !urlValid}
            >
              {loading ? (
                <Loader2 size={16} className="tl-spin" aria-hidden="true" />
              ) : (
                <Send size={16} aria-hidden="true" />
              )}
              {loading ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </form>

        <CodePanel
          title="Request · JSON-RPC 2.0"
          code={JSON.stringify(getJsonRpcPayload(), null, 2)}
        />
      </section>

      <section
        className="tl-pane tl-sticky"
        aria-labelledby="pg-res"
        aria-live="polite"
        aria-busy={loading}
      >
        <div className="tl-pane-head">
          <h2 id="pg-res" className="tl-pane-title">
            <span className="tl-step">2</span> Response
          </h2>
          {response ? (
            <span
              className={`tl-status ${response.ok ? 'tl-status--ok' : 'tl-status--err'}`}
              style={{ color: response.ok ? 'var(--tl-ok)' : 'var(--tl-err)' }}
            >
              {response.status ?? 'Network error'} · {response.ms} ms
            </span>
          ) : null}
        </div>
        <CodePanel
          title={response ? 'response.json' : 'Waiting for a request'}
          code={response?.body ?? ''}
          maxHeight="36rem"
          className={loading ? 'is-loading' : ''}
          empty={
            <>
              <Terminal size={22} aria-hidden="true" />
              <span>
                Pick a method and press <strong>Send request</strong>. The raw
                JSON-RPC reply shows up here.
              </span>
            </>
          }
        />
      </section>
    </div>
  );
}
