'use client';

import React, { useState } from 'react';
import { Play, Copy, Check, Terminal, Sparkles, RefreshCw, Send } from 'lucide-react';
import { trackFeatureUse } from '../../lib/gtag';

export function McpPlayground() {
  const [endpointUrl, setEndpointUrl] = useState('https://allmcps.com/api/mcp');
  const [selectedMethod, setSelectedMethod] = useState<'initialize' | 'tools/list' | 'search_mcp_servers' | 'get_mcp_install_config' | 'list_mcp_categories'>('search_mcp_servers');
  const [searchQuery, setSearchQuery] = useState('postgres');
  const [loading, setLoading] = useState(false);
  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
            arguments: { server_name: searchQuery || 'postgres', client: 'claude' },
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

  const handleExecute = async () => {
    trackFeatureUse('mcp_playground', { method: selectedMethod });
    setLoading(true);
    setResponseOutput(null);
    try {
      const payload = getJsonRpcPayload();
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setResponseOutput(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResponseOutput(
        JSON.stringify(
          {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32603,
              message: e.message || 'Failed to connect to MCP endpoint',
            },
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResponse = () => {
    if (responseOutput) {
      navigator.clipboard.writeText(responseOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Controls Bar */}
      <div className="surface" style={{ padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label htmlFor="playground-endpoint-url" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
              MCP Endpoint URL
            </label>
            <input
              id="playground-endpoint-url"
              type="text"
              className="form-input"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <label htmlFor="playground-method" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
              JSON-RPC Method / Action
            </label>
            <select
              id="playground-method"
              className="form-input"
              value={selectedMethod}
              onChange={(e: any) => setSelectedMethod(e.target.value)}
            >
              <option value="search_mcp_servers">search_mcp_servers (Directory Search)</option>
              <option value="tools/list">tools/list (List Remote MCP Tools)</option>
              <option value="initialize">initialize (Protocol Handshake)</option>
              <option value="get_mcp_install_config">get_mcp_install_config</option>
              <option value="list_mcp_categories">list_mcp_categories</option>
            </select>
          </div>

          {selectedMethod === 'search_mcp_servers' && (
            <div>
              <label htmlFor="playground-search-query" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Search Query (`query`)
              </label>
              <input
                id="playground-search-query"
                type="text"
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. postgres, github, slack"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleExecute}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
          <span>{loading ? 'Sending Request...' : 'Send JSON-RPC Request'}</span>
        </button>
      </div>

      {/* Editor & Response Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Request Pane */}
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={16} style={{ color: 'var(--accent-color)' }} /> Outgoing Request (JSON-RPC 2.0)
          </h2>
          <pre
            style={{
              background: 'var(--bg-muted)',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              overflowX: 'auto',
              margin: 0,
              minHeight: '280px',
            }}
          >
            <code>{JSON.stringify(getJsonRpcPayload(), null, 2)}</code>
          </pre>
        </div>

        {/* Response Inspector Pane */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} style={{ color: 'var(--accent-color)' }} /> Server Response Inspector
            </h2>
            {responseOutput && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleCopyResponse}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>
          <pre
            style={{
              background: 'var(--bg-muted)',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              color: responseOutput?.includes('"error"') ? '#ef4444' : '#059669',
              fontSize: '0.85rem',
              overflowX: 'auto',
              margin: 0,
              minHeight: '280px',
            }}
          >
            <code>{responseOutput || '// Click "Send JSON-RPC Request" to execute against the endpoint'}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
