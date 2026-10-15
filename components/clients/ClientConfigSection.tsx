'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { formatServerClientConfig, type McpClient } from '@/lib/clients';
import type { Server } from '@/lib/servers';

interface ClientConfigSectionProps {
  client: McpClient;
  featuredServers?: Server[];
}

function snippetLanguage(code: string): string {
  const t = code.trimStart();
  if (t.startsWith('{')) return 'JSON';
  if (t.startsWith('[')) return 'TOML';
  if (t.startsWith('#') || t.startsWith('claude ')) return 'Shell';
  return 'Config';
}

function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    // Optimistic: flip the label immediately; clipboard writes rarely fail.
    setCopied(true);
    navigator.clipboard?.writeText(text).catch(() => setCopied(false));
    setTimeout(() => setCopied(false), 1800);
  };
  return [copied, copy];
}

/**
 * The config card on /clients/[client]: where the file lives (per OS or
 * scope) and a copyable snippet, optionally pre-filled for a popular server.
 */
export function ClientConfigSection({
  client,
  featuredServers = [],
}: ClientConfigSectionProps) {
  const [selectedOsIndex, setSelectedOsIndex] = useState(0);
  const [selectedServerId, setSelectedServerId] = useState<string>('default');
  const [copiedPath, copyPath] = useCopy();
  const [copiedConfig, copyConfig] = useCopy();

  const currentLoc =
    client.configLocations[selectedOsIndex] || client.configLocations[0];
  const selectedServer = featuredServers.find((s) => s.id === selectedServerId);
  const displayCode = selectedServer
    ? formatServerClientConfig(client.slug, selectedServer.name, 'npx', [
        '-y',
        selectedServer.name,
      ])
    : client.configExample;

  return (
    <section className="cl-config" aria-labelledby="client-config-title">
      <div className="cl-config-head">
        <h2 id="client-config-title" className="cl-config-title">
          Configuration
        </h2>
        <code className="cl-config-file">{client.configFilename}</code>
      </div>

      {currentLoc ? (
        <div className="cl-config-block">
          <div className="cl-config-row">
            <span className="cl-label">Location</span>
            {client.configLocations.length > 1 ? (
              <div
                className="segmented cl-os-tabs"
                role="tablist"
                aria-label="Operating system"
              >
                {client.configLocations.map((loc, idx) => (
                  <button
                    key={loc.os}
                    onClick={() => setSelectedOsIndex(idx)}
                    type="button"
                    role="tab"
                    aria-selected={selectedOsIndex === idx}
                    className={selectedOsIndex === idx ? 'is-active' : ''}
                  >
                    {loc.os}
                  </button>
                ))}
              </div>
            ) : (
              <span className="cl-os-single">{currentLoc.os}</span>
            )}
          </div>
          <div className="cl-path">
            <code>{currentLoc.path}</code>
            <button
              onClick={() => copyPath(currentLoc.path)}
              type="button"
              className="cl-copy"
              aria-label={copiedPath ? 'Path copied' : 'Copy path'}
            >
              {copiedPath ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      ) : null}

      <div className="cl-config-block">
        <div className="cl-config-row">
          <span className="cl-label">Snippet</span>
          {featuredServers.length > 0 ? (
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="form-input cl-preset"
              aria-label="Config preset"
            >
              <option value="default">Default example</option>
              {featuredServers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="cl-code">
          <div className="cl-code-bar">
            <span className="cl-code-lang">{snippetLanguage(displayCode)}</span>
            <button
              onClick={() => copyConfig(displayCode)}
              type="button"
              className={`cl-code-copy ${copiedConfig ? 'is-copied' : ''}`}
            >
              {copiedConfig ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              <span aria-live="polite">{copiedConfig ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre>
            <code>{displayCode}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
