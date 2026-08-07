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
    <section className="client-config-panel surface">
      <div className="client-config-panel-header">
        <div>
          <h2 className="client-config-panel-title">
            <Terminal size={22} aria-hidden="true" />
            <span>
              Configuring <span className="client-config-panel-title-accent">{client.name}</span>
            </span>
          </h2>
          <p className="client-config-panel-meta">
            Config file: <code className="inline-path">{client.configFilename}</code>
          </p>
        </div>

        {client.configLocations.length > 1 && (
          <div className="client-config-os-tabs" role="tablist" aria-label="Operating system">
            {client.configLocations.map((loc, idx) => (
              <button
                key={loc.os}
                onClick={() => setSelectedOsIndex(idx)}
                type="button"
                role="tab"
                aria-selected={selectedOsIndex === idx}
                className={`client-config-os-tab${selectedOsIndex === idx ? ' is-active' : ''}`}
              >
                {loc.os}
              </button>
            ))}
          </div>
        )}
      </div>

      {currentLoc && (
        <div className="client-config-path-box">
          <div className="client-config-path-main">
            <Folder size={16} className="client-config-path-icon" aria-hidden="true" />
            <span className="client-config-path-label">{currentLoc.os} path</span>
            <code className="client-config-path-value">{currentLoc.path}</code>
          </div>
          <button
            onClick={handleCopyPath}
            type="button"
            className="btn btn-secondary client-config-path-copy"
          >
            {copiedPath ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            <span>{copiedPath ? 'Copied' : 'Copy path'}</span>
          </button>
        </div>
      )}

      <div className="client-config-snippet-toolbar">
        <div className="client-config-snippet-toolbar-left">
          <span className="client-config-snippet-label">Configuration snippet</span>
          {featuredServers.length > 0 && (
            <div className="client-config-preset-wrap">
              <select
                value={selectedServerId}
                onChange={(e) => setSelectedServerId(e.target.value)}
                className="client-config-preset-select"
                aria-label="Config preset"
              >
                <option value="default">Default example</option>
                {featuredServers.map((s) => (
                  <option key={s.id} value={s.id}>
                    Preset: {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="client-config-preset-chevron" aria-hidden="true" />
            </div>
          )}
        </div>

        <button
          onClick={handleCopyConfig}
          type="button"
          className="btn btn-primary client-config-copy-json"
        >
          {copiedConfig ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          <span>{copiedConfig ? 'Copied config' : 'Copy config JSON'}</span>
        </button>
      </div>

      <pre className="client-config-code-block">
        <code>{displayCode}</code>
      </pre>
    </section>
  );
}
