'use client';

import { Check, Copy, Download } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { trackCopyConfig } from '../../lib/gtag';
import { toast } from '../ui/Toast';

/**
 * Shared code/editor surfaces for every tool page, so outputs and inputs look
 * the same everywhere: one dark "code" panel (dark in both themes), one copy
 * button with an optimistic success state, one download helper.
 */

export function downloadText(
  text: string,
  filename: string,
  mimeType = 'text/plain',
) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Copy-to-clipboard with a 1.8s "Copied" state. Returns [copied, copy]. */
export function useCopy(): [boolean, (text: string) => Promise<boolean>] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
      return true;
    } catch {
      toast.error('Could not copy', {
        description:
          'Your browser blocked clipboard access. Select the text and copy it manually.',
      });
      return false;
    }
  };
  return [copied, copy];
}

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  /** Fires after a successful copy (analytics hooks). */
  onCopied?: () => void;
  variant?: 'code' | 'secondary' | 'primary';
  className?: string;
  disabled?: boolean;
}

export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  onCopied,
  variant = 'code',
  className = '',
  disabled,
}: CopyButtonProps) {
  const [copied, copy] = useCopy();
  const base =
    variant === 'code'
      ? 'tl-code-btn'
      : `btn btn-sm ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`;
  return (
    <button
      type="button"
      className={`${base} tl-copy ${copied ? 'is-copied' : ''} ${className}`.trim()}
      disabled={disabled}
      onClick={async () => {
        if (await copy(text)) onCopied?.();
      }}
      aria-live="polite"
    >
      <span className="tl-copy-icon" aria-hidden="true">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </span>
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}

const TOKEN_RE =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.*$|#.*$|\b(?:import|export|from|const|let|var|function|async|await|return|class|def|if|else|elif|try|catch|except|throw|raise|new|with|as|type|interface|for|in|of)\b|\b(?:true|false|null|undefined|None|True|False)\b|-?\b\d+(?:\.\d+)?\b)/g;

const KEYWORDS = new Set([
  'import',
  'export',
  'from',
  'const',
  'let',
  'var',
  'function',
  'async',
  'await',
  'return',
  'class',
  'def',
  'if',
  'else',
  'elif',
  'try',
  'catch',
  'except',
  'throw',
  'raise',
  'new',
  'with',
  'as',
  'type',
  'interface',
  'for',
  'in',
  'of',
]);

/** Tiny token highlighter (JSON / TS / Python / shell). Class names only — colors live in tools.css. */
function highlightLine(line: string, language: string, li: number) {
  const out: React.ReactNode[] = [];
  let last = 0;
  const hashComments = language === 'python' || language === 'bash';
  for (const m of line.matchAll(TOKEN_RE)) {
    const tok = m[0];
    const at = m.index ?? 0;
    if (tok.startsWith('#') && !hashComments) continue;
    if (at > last) out.push(line.slice(last, at));
    let cls = 'tk-num';
    if (tok.startsWith('//') || tok.startsWith('#')) cls = 'tk-com';
    else if (/^["'`]/.test(tok)) {
      cls = line
        .slice(at + tok.length)
        .trimStart()
        .startsWith(':')
        ? 'tk-key'
        : 'tk-str';
    } else if (KEYWORDS.has(tok)) cls = 'tk-kw';
    else if (/^(?:true|false|null|undefined|None|True|False)$/.test(tok))
      cls = 'tk-lit';
    out.push(
      <span key={`${li}-${at}`} className={cls}>
        {tok}
      </span>,
    );
    last = at + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

interface CodePanelProps {
  /** Shown in the panel bar — usually a filename or what the output is. */
  title: React.ReactNode;
  code: string;
  language?: string;
  /** When set, a Download button saves the code under this filename. */
  downloadName?: string;
  downloadMime?: string;
  /** Extra controls rendered before Copy (tabs, toggles). */
  actions?: React.ReactNode;
  onCopied?: () => void;
  /** When set, a copy also fires the GA copy_install_config event. */
  snippetType?: string;
  onDownloaded?: () => void;
  /** Cap the body height and scroll inside it. */
  maxHeight?: number | string;
  /** Wrap long lines (default) or scroll horizontally. */
  wrap?: boolean;
  className?: string;
  /** Rendered instead of the code when `code` is empty. */
  empty?: React.ReactNode;
  highlight?: boolean;
}

export function CodePanel({
  title,
  code,
  language = 'json',
  downloadName,
  downloadMime,
  actions,
  onCopied,
  snippetType,
  onDownloaded,
  maxHeight,
  wrap = true,
  className = '',
  empty,
  highlight = true,
}: CodePanelProps) {
  const isEmpty = !code.trim();
  const lines = code.split('\n');
  return (
    <div className={`tl-code ${className}`.trim()}>
      <div className="tl-code-bar">
        <span className="tl-code-title">{title}</span>
        <div className="tl-code-actions">
          {actions}
          {downloadName ? (
            <button
              type="button"
              className="tl-code-btn"
              disabled={isEmpty}
              onClick={() => {
                downloadText(code, downloadName, downloadMime);
                onDownloaded?.();
              }}
            >
              <Download size={14} aria-hidden="true" />
              <span className="tl-hide-sm">Download</span>
            </button>
          ) : null}
          <CopyButton
            text={code}
            disabled={isEmpty}
            onCopied={() => {
              if (snippetType) trackCopyConfig({ snippetType });
              onCopied?.();
            }}
          />
        </div>
      </div>
      {isEmpty && empty ? (
        <div className="tl-code-empty">{empty}</div>
      ) : (
        <pre
          className={`tl-code-body ${wrap ? 'is-wrap' : ''}`}
          style={maxHeight ? { maxHeight } : undefined}
        >
          <code>
            {highlight
              ? lines.map((line, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional and re-render together.
                  <span key={i} className="tl-code-line">
                    {highlightLine(line, language, i)}
                    {'\n'}
                  </span>
                ))
              : code}
          </code>
        </pre>
      )}
    </div>
  );
}

interface EditorPaneProps {
  title: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  rows?: number;
  actions?: React.ReactNode;
  /** Status shown in the bar's right edge, e.g. "Valid JSON". */
  status?: React.ReactNode;
  invalid?: boolean;
  className?: string;
}

/** A monospace textarea dressed as a code panel, for pasted JSON/specs. */
export function EditorPane({
  title,
  value,
  onChange,
  placeholder,
  ariaLabel,
  rows = 16,
  actions,
  status,
  invalid,
  className = '',
}: EditorPaneProps) {
  return (
    <div
      className={`tl-code tl-editor ${invalid ? 'is-invalid' : ''} ${className}`.trim()}
    >
      <div className="tl-code-bar">
        <span className="tl-code-title">{title}</span>
        <div className="tl-code-actions">
          {status}
          {actions}
        </div>
      </div>
      <textarea
        className="tl-editor-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        rows={rows}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
      />
    </div>
  );
}
