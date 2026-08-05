'use client';

import React, { useState, useMemo } from 'react';
import { Copy, Check, Terminal, Code2, FileCode, FileText } from 'lucide-react';
import { toast } from './Toast';
import { trackCopyConfig } from '../../lib/gtag';

interface CopyBlockProps {
  code: string;
  serverId?: string;
  title?: string;
  language?: string;
}

/**
 * Detects snippet title and language for IDE header styling.
 */
function inferLanguageAndTitle(code: string, explicitTitle?: string, explicitLang?: string) {
  const trimmed = code.trim();

  if (explicitTitle) {
    return {
      title: explicitTitle,
      lang: explicitLang || (explicitTitle.endsWith('.json') ? 'json' : explicitTitle.endsWith('.ts') ? 'typescript' : 'text'),
    };
  }

  if (trimmed.startsWith('{\n') || trimmed.startsWith('[\n') || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    return { title: explicitLang === 'json' ? 'config.json' : 'JSON Config', lang: 'json' };
  }
  if (trimmed.startsWith('npx ') || trimmed.startsWith('npm ') || trimmed.startsWith('pip ') || trimmed.startsWith('docker ') || trimmed.startsWith('fly ') || trimmed.startsWith('claude ') || trimmed.startsWith('wrangler ') || trimmed.startsWith('curl ')) {
    return { title: 'Terminal', lang: 'bash' };
  }
  if (trimmed.includes('FROM ') || trimmed.includes('WORKDIR ') || trimmed.includes('RUN npm')) {
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
  if (trimmed.includes('import ') || trimmed.includes('export ') || trimmed.includes('const ') || trimmed.includes('async ')) {
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
  if (trimmed.startsWith('//') || (trimmed.startsWith('#') && !trimmed.startsWith('#!'))) {
    return (
      <span key={index} style={{ color: '#8b949e', fontStyle: 'italic' }}>
        {line}
        {'\n'}
      </span>
    );
  }

  // Tokenize line using Regex for strings, JSON keys, keywords, CLI commands, booleans, and numbers
  const tokenRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.+$|\b(?:import|export|from|const|let|var|function|async|await|return|class|extends|default|new|if|else|try|catch|throw|type|interface|enum|public|private|static)\b|\b(?:true|false|null|undefined)\b|\b(?:string|number|boolean|void|any|unknown|Request|Response|McpServer|McpAgent|ExecutionContext)\b|\b\d+(?:\.\d+)?\b)/g;

  const elements: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    const matchedStr = match[0];
    const matchIdx = match.index;

    // Push preceding plain text
    if (matchIdx > lastIdx) {
      elements.push(line.substring(lastIdx, matchIdx));
    }

    // Determine token color
    let tokenColor = '#e6edf3';
    let fontWeight: string | undefined = undefined;

    if (matchedStr.startsWith('//')) {
      tokenColor = '#8b949e';
    } else if (matchedStr.startsWith('"') || matchedStr.startsWith("'") || matchedStr.startsWith('`')) {
      // JSON key vs String value check
      const restOfLine = line.substring(matchIdx + matchedStr.length).trim();
      if (restOfLine.startsWith(':')) {
        tokenColor = '#7ee787'; // JSON Key (mint green)
      } else {
        tokenColor = '#a5d6ff'; // String literal (soft blue)
      }
    } else if (/^(?:import|export|from|const|let|var|function|async|await|return|class|extends|default|new|if|else|try|catch|throw|type|interface|enum|public|private|static)$/.test(matchedStr)) {
      tokenColor = '#ff7b72'; // Keyword (coral red)
      fontWeight = '600';
    } else if (/^(?:true|false|null|undefined)$/.test(matchedStr)) {
      tokenColor = '#79c0ff'; // Boolean / null (cyan)
    } else if (/^(?:string|number|boolean|void|any|unknown|Request|Response|McpServer|McpAgent|ExecutionContext)$/.test(matchedStr)) {
      tokenColor = '#ffa657'; // Type / Class name (amber)
    } else if (/^\d+(?:\.\d+)?$/.test(matchedStr)) {
      tokenColor = '#79c0ff'; // Numbers
    }

    elements.push(
      <span key={`${index}-${matchIdx}`} style={{ color: tokenColor, fontWeight }}>
        {matchedStr}
      </span>
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

export function CopyBlock({ code, serverId, title, language }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  const meta = useMemo(() => inferLanguageAndTitle(code, title, language), [code, title, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');

      trackCopyConfig({ serverId, snippetType: 'install_command' });

      if (serverId) {
        fetch(`/api/mcp/${serverId}/metric`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric: 'copy' }),
        }).catch(() => {});
      }
    } catch {
      toast.error('Could not copy', {
        description: 'Your browser blocked clipboard access. Try selecting the text manually.',
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
      }}
    >
      {/* IDE Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.55rem 1rem',
          background: 'rgba(255, 255, 255, 0.035)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
          <span
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              letterSpacing: '0.02em',
            }}
          >
            {meta.title}
          </span>
        </div>

        <button
          onClick={handleCopy}
          aria-label="Copy to clipboard"
          style={{
            background: copied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
            border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.12)'}`,
            borderRadius: '6px',
            padding: '0.35rem 0.65rem',
            cursor: 'pointer',
            color: copied ? '#10b981' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            outline: 'none',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!copied) e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            if (!copied) e.currentTarget.style.color = 'var(--text-secondary)';
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
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Fira Code", monospace',
          color: '#e6edf3',
        }}
      >
        <code>{lines.map((line, idx) => renderHighlightedLine(line, idx))}</code>
      </pre>
    </div>
  );
}
