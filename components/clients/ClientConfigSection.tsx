'use client';

import React, { useState } from 'react';
import { Terminal, Copy, Check, Folder, ChevronDown, Sparkles } from 'lucide-react';
import { McpClient, formatServerClientConfig } from '@/lib/clients';
import { Server } from '@/lib/servers';

interface ClientConfigSectionProps {
  client: McpClient;
  featuredServers?: Server[];
}

export function ClientConfigSection({ client, featuredServers = [] }: ClientConfigSectionProps) {
  const [selectedOsIndex, setSelectedOsIndex] = useState(0);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string>('default');

  const currentLoc = client.configLocations[selectedOsIndex] || client.configLocations[0];

  const selectedServer = featuredServers.find((s) => s.id === selectedServerId);

  const displayCode = selectedServer
    ? formatServerClientConfig(client.slug, selectedServer.name, 'npx', ['-y', selectedServer.name])
    : client.configExample;

  const handleCopyPath = () => {
    if (!currentLoc) return;
    navigator.clipboard.writeText(currentLoc.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(displayCode);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  return (
    <section
      className="surface"
      style={{
        padding: '1.75rem',
        borderRadius: '16px',
        marginBottom: '3rem',
        border: '1px solid rgba(var(--accent-rgb), 0.25)',
        background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-color) 100%)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              margin: '0 0 0.4rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: 'var(--text-primary)',
            }}
          >
            <Terminal size={22} style={{ color: 'var(--accent-color)' }} />
            <span>
              Configuring <span style={{ color: 'var(--accent-color)' }}>{client.name}</span>
            </span>
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Config file: <code style={{ color: 'var(--accent-color)' }}>{client.configFilename}</code>
          </p>
        </div>

        {/* OS Tabs */}
        {client.configLocations.length > 1 && (
          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            {client.configLocations.map((loc, idx) => (
              <button
                key={loc.os}
                onClick={() => setSelectedOsIndex(idx)}
                type="button"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  background: selectedOsIndex === idx ? 'var(--brand-gradient)' : 'transparent',
                  color: selectedOsIndex === idx ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {loc.os}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Path Box */}
      {currentLoc && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed var(--border-color)',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
            <Folder size={16} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', fontWeight: 700, flexShrink: 0 }}>
              {currentLoc.os} Path:
            </span>
            <code style={{ fontSize: '0.825rem', color: '#e2e8f0', wordBreak: 'break-all' }}>{currentLoc.path}</code>
          </div>
          <button
            onClick={handleCopyPath}
            type="button"
            className="btn btn-secondary"
            style={{
              padding: '0.3rem 0.6rem',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              flexShrink: 0,
            }}
          >
            {copiedPath ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
            <span>{copiedPath ? 'Copied Path!' : 'Copy Path'}</span>
          </button>
        </div>
      )}

      {/* Code Block Header & Server Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Configuration Snippet
          </span>
          {featuredServers.length > 0 && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select
                value={selectedServerId}
                onChange={(e) => setSelectedServerId(e.target.value)}
                style={{
                  appearance: 'none',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.25rem 1.75rem 0.25rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <option value="default">Default Example</option>
                {featuredServers.map((s) => (
                  <option key={s.id} value={s.id}>
                    Preset: {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
            </div>
          )}
        </div>

        <button
          onClick={handleCopyConfig}
          type="button"
          className="btn btn-primary"
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            borderRadius: '6px',
          }}
        >
          {copiedConfig ? <Check size={13} /> : <Copy size={13} />}
          <span>{copiedConfig ? 'Copied Config!' : 'Copy Config JSON'}</span>
        </button>
      </div>

      {/* Code Block */}
      <pre
        style={{
          background: '#020617',
          padding: '1.25rem',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          color: '#38bdf8',
          fontSize: '0.85rem',
          lineHeight: 1.5,
          overflowX: 'auto',
          margin: 0,
        }}
      >
        <code>{displayCode}</code>
      </pre>
    </section>
  );
}
