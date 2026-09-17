'use client';

import {
  AlertCircle,
  AlertTriangle,
  Check,
  Copy,
  Info,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { auditMcpConfig, mergeServerIntoConfig } from '../../lib/configAudit';
import { trackFeatureUse } from '../../lib/gtag';

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
    name: 'Server Sqlite',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite'],
  },
  {
    id: 'modelcontextprotocol-server-filesystem',
    name: 'Server Filesystem',
    command: 'npx',
    args: [
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '/Users/username/Desktop',
    ],
  },
  {
    id: 'modelcontextprotocol-server-memory',
    name: 'Server Memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
  {
    id: 'modelcontextprotocol-server-fetch',
    name: 'Server Fetch',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
  },
  {
    id: 'modelcontextprotocol-server-git',
    name: 'Server Git',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git'],
  },
];

export function ConfigAuditor() {
  const [jsonText, setJsonText] = useState(SAMPLE_CONFIG);
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const audit = useMemo(() => auditMcpConfig(jsonText), [jsonText]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    trackFeatureUse('config_auditor', { action: 'copy_config' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMergeServer = (s: {
    id: string;
    command: string;
    args: string[];
  }) => {
    const updated = mergeServerIntoConfig(jsonText, s);
    setJsonText(updated);
    setShowModal(false);
    trackFeatureUse('config_auditor', {
      action: 'merge_server',
      server_id: s.id,
    });
  };

  const filteredPickerServers = SAMPLE_SERVERS.filter(
    (s) =>
      s.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      s.id.toLowerCase().includes(pickerSearch.toLowerCase()),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setJsonText(SAMPLE_CONFIG)}
          >
            Load Sample Config
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setJsonText('')}
          >
            Clear
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setShowModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Plus size={14} /> Merge Directory Server
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy Config'}</span>
          </button>
        </div>
      </div>

      {/* Editor & Audit Results Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Editor Pane */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <label
            htmlFor="config-auditor-input"
            style={{
              fontWeight: 700,
              fontSize: '0.9rem',
              color: 'var(--text-primary)',
            }}
          >
            Paste Config JSON (`claude_desktop_config.json`, `.cursor/mcp.json`,
            etc.)
          </label>
          <textarea
            id="config-auditor-input"
            className="form-input"
            rows={18}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder="Paste your JSON configuration here..."
            style={{
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              lineHeight: 1.5,
              background: 'var(--bg-muted)',
              color: 'var(--text-primary)',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Audit Report Pane */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Sparkles size={18} style={{ color: 'var(--accent-color)' }} />
            Live Audit Report
          </h2>

          <div
            className="surface"
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              border: audit.isValidJson
                ? '1px solid var(--border-color)'
                : '1px solid rgba(248, 113, 113, 0.4)',
              background: 'var(--bg-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Status Summary Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
              >
                Detected format:{' '}
                <strong
                  style={{
                    color: 'var(--accent-color)',
                    textTransform: 'uppercase',
                  }}
                >
                  {audit.formatDetected}
                </strong>
              </span>
              <span
                style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}
              >
                Servers:{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {audit.serverCount}
                </strong>
              </span>
            </div>

            {/* Issue Items */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              {audit.issues.map((issue, idx) => {
                const Icon =
                  issue.type === 'error'
                    ? AlertCircle
                    : issue.type === 'warning'
                      ? AlertTriangle
                      : Info;
                const borderClr =
                  issue.type === 'error'
                    ? 'rgba(248, 113, 113, 0.4)'
                    : issue.type === 'warning'
                      ? 'rgba(245, 158, 11, 0.4)'
                      : 'var(--border-color)';
                const bgClr =
                  issue.type === 'error'
                    ? 'rgba(248, 113, 113, 0.08)'
                    : issue.type === 'warning'
                      ? 'rgba(245, 158, 11, 0.08)'
                      : 'var(--brand-gradient-soft)';
                const textClr =
                  issue.type === 'error'
                    ? '#ef4444'
                    : issue.type === 'warning'
                      ? '#d97706'
                      : 'var(--accent-color)';

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '8px',
                      border: `1px solid ${borderClr}`,
                      background: bgClr,
                      display: 'flex',
                      gap: '0.65rem',
                    }}
                  >
                    <Icon
                      size={18}
                      style={{
                        color: textClr,
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    />
                    <div style={{ fontSize: '0.85rem', lineHeight: 1.45 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {issue.message}
                      </div>
                      {issue.suggestion && (
                        <div
                          style={{
                            color: 'var(--text-secondary)',
                            marginTop: '0.25rem',
                            fontSize: '0.8rem',
                          }}
                        >
                          💡 {issue.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Directory Server Merger Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'var(--bg-overlay, rgba(2, 6, 23, 0.85))',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="surface"
            style={{
              width: '100%',
              maxWidth: '500px',
              borderRadius: '16px',
              padding: '1.5rem',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-elevated)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h3
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text-primary)',
                }}
              >
                Merge Directory Server into Config
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn btn-sm btn-secondary"
                style={{ padding: '0.3rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Search server..."
                aria-label="Search directory servers"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                maxHeight: '280px',
                overflowY: 'auto',
              }}
            >
              {filteredPickerServers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleMergeServer(s)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-muted)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {s.name}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {s.command} {s.args.join(' ')}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: 'var(--accent-color)',
                    }}
                  >
                    + Merge
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
