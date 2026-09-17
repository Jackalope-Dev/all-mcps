'use client';

import { Check, Copy } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { trackCopyConfig } from '../../lib/gtag';
import { toast } from './Toast';

interface CopyBlockProps {
  code: string;
  serverId?: string;
  title?: string;
  language?: string;
  /** trackCopyConfig snippetType tag; defaults to 'install_command'. */
  snippetType?: string;
  /** Toast message shown after a successful copy. */
  toastMessage?: string;
}

/**
 * Detects snippet title and language for IDE header styling.
 */
function inferLanguageAndTitle(
  code: string,
  explicitTitle?: string,
  explicitLang?: string,
) {
  const trimmed = code.trim();

  if (explicitTitle) {
    return {
      title: explicitTitle,
      lang:
        explicitLang ||
        (explicitTitle.endsWith('.json')
          ? 'json'
          : explicitTitle.endsWith('.ts')
            ? 'typescript'
            : 'text'),
    };
  }

  if (
    trimmed.startsWith('{\n') ||
    trimmed.startsWith('[\n') ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    return {
      title: explicitLang === 'json' ? 'config.json' : 'JSON Config',
      lang: 'json',
    };
  }
  if (
    trimmed.startsWith('npx ') ||
    trimmed.startsWith('npm ') ||
    trimmed.startsWith('pip ') ||
    trimmed.startsWith('docker ') ||
    trimmed.startsWith('fly ') ||
    trimmed.startsWith('claude ') ||
    trimmed.startsWith('wrangler ') ||
    trimmed.startsWith('curl ')
  ) {
    return { title: 'Terminal', lang: 'bash' };
  }
  if (
    trimmed.includes('FROM ') ||
    trimmed.includes('WORKDIR ') ||
    trimmed.includes('RUN npm')
  ) {
    return { title: 'Dockerfile', lang: 'dockerfile' };
  }
  if (trimmed.includes('services:') && trimmed.includes('image:')) {
    return { title: 'docker-compose.yml', lang: 'yaml' };
  }
  if (trimmed.includes('server {') || trimmed.includes('location /')) {
    return { title: 'nginx.conf', lang: 'nginx' };
  }
  if (trimmed.includes('reverse_proxy')) {
    return { title: 'Caddyfile', lang: 'caddy' };
  }
  if (
    trimmed.includes('import ') ||
    trimmed.includes('export ') ||
    trimmed.includes('const ') ||
    trimmed.includes('async ')
  ) {
    return { title: 'server.ts', lang: 'typescript' };
  }

  return { title: explicitLang || 'Code', lang: explicitLang || 'text' };
}

/**
 * Lightweight syntax highlighter rendering colored spans for TypeScript, JSON, Bash, Dockerfile, etc.
 */
function renderHighlightedLine(line: string, index: number) {
  const trimmed = line.trim();

  // Full-line comments
  if (
    trimmed.startsWith('//') ||
    (trimmed.startsWith('#') && !trimmed.startsWith('#!'))
  ) {
    return (
      <span key={index} style={{ color: '#8b949e', fontStyle: 'italic' }}>
        {line}
        {'\n'}
      </span>
    );
  }

  // Tokenize line using Regex for strings, JSON keys, keywords, CLI commands, booleans, and numbers
  const tokenRegex =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.+$|\b(?:import|export|from|const|let|var|function|async|await|return|class|extends|default|new|if|else|try|catch|throw|type|interface|enum|public|private|static)\b|\b(?:true|false|null|undefined)\b|\b(?:string|number|boolean|void|any|unknown|Request|Response|McpServer|McpAgent|ExecutionContext)\b|\b\d+(?:\.\d+)?\b)/g;

  const elements: React.ReactNode[] = [];
  let lastIdx = 0;

  for (const match of line.matchAll(tokenRegex)) {
    const matchedStr = match[0];
    const matchIdx = match.index;

    // Push preceding plain text
    if (matchIdx > lastIdx) {
      elements.push(line.substring(lastIdx, matchIdx));
    }

    // Determine token color
    let tokenColor = '#e6edf3';
    let fontWeight: string | undefined;

    if (matchedStr.startsWith('//')) {
      tokenColor = '#8b949e';
    } else if (
      matchedStr.startsWith('"') ||
      matchedStr.startsWith("'") ||
      matchedStr.startsWith('`')
    ) {
      // JSON key vs String value check
      const restOfLine = line.substring(matchIdx + matchedStr.length).trim();
      if (restOfLine.startsWith(':')) {
        tokenColor = '#7ee787'; // JSON Key (mint green)
      } else {
        tokenColor = '#a5d6ff'; // String literal (soft blue)
      }
    } else if (
      /^(?:import|export|from|const|let|var|function|async|await|return|class|extends|default|new|if|else|try|catch|throw|type|interface|enum|public|private|static)$/.test(
        matchedStr,
      )
    ) {
      tokenColor = '#ff7b72'; // Keyword (coral red)
      fontWeight = '600';
    } else if (/^(?:true|false|null|undefined)$/.test(matchedStr)) {
      tokenColor = '#79c0ff'; // Boolean / null (cyan)
    } else if (
      /^(?:string|number|boolean|void|any|unknown|Request|Response|McpServer|McpAgent|ExecutionContext)$/.test(
        matchedStr,
      )
    ) {
      tokenColor = '#ffa657'; // Type / Class name (amber)
    } else if (/^\d+(?:\.\d+)?$/.test(matchedStr)) {
      tokenColor = '#79c0ff'; // Numbers
    }

    elements.push(
      <span
        key={`${index}-${matchIdx}`}
        style={{ color: tokenColor, fontWeight }}
      >
        {matchedStr}
      </span>,
    );

    lastIdx = matchIdx + matchedStr.length;
  }

  // Push remaining plain text
  if (lastIdx < line.length) {
    elements.push(line.substring(lastIdx));
  }

  return (
    <React.Fragment key={index}>
      {elements}
      {'\n'}
    </React.Fragment>
  );
}

export function CopyBlock({
  code,
  serverId,
  title,
  language,
  snippetType = 'install_command',
  toastMessage = 'Copied to clipboard',
}: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  const meta = useMemo(
    () => inferLanguageAndTitle(code, title, language),
    [code, title, language],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(toastMessage);

      trackCopyConfig({ serverId, snippetType });

      if (serverId) {
        fetch(`/api/mcp/${serverId}/metric`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric: 'copy' }),
        }).catch(() => {});

        // Let a listing page's ReviewNudge know this visitor just took the
        // install config — the highest-intent moment to ask for a rating.
        try {
          window.dispatchEvent(
            new CustomEvent('allmcps:config-copied', { detail: { serverId } }),
          );
          localStorage.setItem(`allmcps:copied:${serverId}`, '1');
        } catch {
          /* storage / event unavailable — non-critical */
        }
      }
    } catch {
      toast.error('Could not copy', {
        description:
          'Your browser blocked clipboard access. Try selecting the text manually.',
      });
    }
  };

  const lines = code.split('\n');

  return (
    <div
      style={{
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: '#0d1117',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        margin: '1.5rem 0',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* IDE Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.55rem 1rem',
          background: 'rgba(255, 255, 255, 0.035)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          userSelect: 'none',
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#ff5f56',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#ffbd2e',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#27c93f',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#8b949e',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              letterSpacing: '0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {meta.title}
          </span>
        </div>

        <button
          onClick={handleCopy}
          aria-label="Copy to clipboard"
          style={{
            background: copied
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(255, 255, 255, 0.08)',
            border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.12)'}`,
            borderRadius: '6px',
            padding: '0.35rem 0.65rem',
            cursor: 'pointer',
            color: copied ? '#10b981' : '#c9d1d9',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            outline: 'none',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!copied) e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            if (!copied) e.currentTarget.style.color = '#c9d1d9';
          }}
        >
          {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Code Editor Body */}
      <pre
        style={{
          background: 'transparent',
          padding: '1.15rem 1.25rem',
          margin: 0,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          maxWidth: '100%',
          fontSize: '0.86rem',
          lineHeight: 1.65,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Fira Code", monospace',
          color: '#e6edf3',
        }}
      >
        <code style={{ color: '#e6edf3' }}>
          {lines.map((line, idx) => renderHighlightedLine(line, idx))}
        </code>
      </pre>
    </div>
  );
}
