'use client';

import { useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import {
  ClientFormat,
  CLIENT_FORMAT_LABELS,
  detectFormat,
  validateConfig,
} from '../../lib/tools/configFormats';
import { trackFeatureUse } from '../../lib/gtag';

export function ConfigValidatorTool() {
  const [raw, setRaw] = useState('');
  const [formatOverride, setFormatOverride] = useState<ClientFormat | 'auto'>('auto');

  const { findings, parseError, effectiveFormat } = useMemo(() => {
    if (!raw.trim()) {
      return { findings: [], parseError: null as string | null, effectiveFormat: 'claude' as ClientFormat };
    }
    try {
      const parsed = JSON.parse(raw);
      const format = formatOverride === 'auto' ? detectFormat(parsed) : formatOverride;
      trackFeatureUse('config_validator', { format });
      return { findings: validateConfig(parsed, format), parseError: null as string | null, effectiveFormat: format };
    } catch (err) {
      return { findings: [], parseError: (err as Error).message, effectiveFormat: 'claude' as ClientFormat };
    }
  }, [raw, formatOverride]);

  const errors = findings.filter((f) => f.level === 'error');
  const warnings = findings.filter((f) => f.level === 'warning');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFormatOverride('auto')}
          className={`btn btn-sm ${formatOverride === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Auto-detect
        </button>
        {(Object.keys(CLIENT_FORMAT_LABELS) as ClientFormat[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormatOverride(f)}
            className={`btn btn-sm ${formatOverride === f ? 'btn-primary' : 'btn-secondary'}`}
          >
            {CLIENT_FORMAT_LABELS[f]}
          </button>
        ))}
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={'{\n  "mcpServers": {\n    "github": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-github"]\n    }\n  }\n}'}
        rows={14}
        className="form-input"
        style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
        aria-label="Paste your MCP config JSON"
      />

      {raw.trim() && (
        <div>
          {parseError ? (
            <div className="surface-muted" style={{ padding: '1rem', borderLeft: '3px solid #ef4444', wordBreak: 'break-word' }}>
              <strong>Invalid JSON:</strong> {parseError}
            </div>
          ) : errors.length === 0 && warnings.length === 0 ? (
            <div className="surface-muted" style={{ padding: '1rem', borderLeft: '3px solid #10b981' }}>
              ✓ Looks good &mdash; valid {CLIENT_FORMAT_LABELS[effectiveFormat]} config.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {errors.map((f, i) => (
                <div
                  key={`e${i}`}
                  className="surface-muted"
                  style={{ padding: '0.75rem 1rem', borderLeft: '3px solid #ef4444', wordBreak: 'break-word' }}
                >
                  <Badge variant="default" style={{ marginRight: '0.5rem' }}>error</Badge>
                  <code style={{ wordBreak: 'break-all' }}>{f.path}</code> &mdash; {f.message}
                </div>
              ))}
              {warnings.map((f, i) => (
                <div
                  key={`w${i}`}
                  className="surface-muted"
                  style={{ padding: '0.75rem 1rem', borderLeft: '3px solid #f59e0b', wordBreak: 'break-word' }}
                >
                  <Badge variant="default" style={{ marginRight: '0.5rem' }}>warning</Badge>
                  <code style={{ wordBreak: 'break-all' }}>{f.path}</code> &mdash; {f.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
