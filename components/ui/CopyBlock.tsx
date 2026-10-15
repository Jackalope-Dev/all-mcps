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
  /** Extra class on the wrapper — e.g. `copyblock--flush` to drop the outer margin. */
  className?: string;
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
  className,
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
    <div className={`copyblock${className ? ` ${className}` : ''}`}>
      <div className="copyblock-bar">
        <span className="copyblock-title">{meta.title}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy to clipboard'}
          className={`copyblock-btn${copied ? ' is-copied' : ''}`}
          data-copied={copied || undefined}
        >
          <span className="copyblock-btn-icon" aria-hidden="true">
            <Copy size={13} className="copyblock-icon-copy" />
            <Check size={13} className="copyblock-icon-check" />
          </span>
          <span className="copyblock-btn-label">
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>
      </div>
      <pre className="copyblock-pre">
        <code>
          {lines.map((line, idx) => renderHighlightedLine(line, idx))}
        </code>
      </pre>
    </div>
  );
}
