'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Ban,
  RotateCcw,
  ListChecks,
} from 'lucide-react';

/* ---------------------------------------------------------------------- */
/* Part 1: MRTR (Multi Round-Trip Requests) step-through                  */
/* ---------------------------------------------------------------------- */

type ElicitAction = 'accept' | 'decline' | 'cancel';

function buildInitialRequest() {
  return JSON.stringify(
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'open_github_issue',
        arguments: { title: 'Docs typo on the versioning page' },
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': { elicitation: {} },
        },
      },
    },
    null,
    2
  );
}

function buildInputRequiredResult() {
  return JSON.stringify(
    {
      jsonrpc: '2.0',
      id: 1,
      result: {
        resultType: 'input_required',
        inputRequests: {
          github_login: {
            method: 'elicitation/create',
            params: {
              message: 'Which GitHub username should this issue be filed under?',
              requestedSchema: {
                type: 'object',
                properties: { name: { type: 'string' } },
                required: ['name'],
              },
            },
          },
        },
        requestState: 'AEAD-protected-blob-abc123',
      },
    },
    null,
    2
  );
}

function buildElicitResult(action: ElicitAction, username: string) {
  if (action === 'accept') {
    return { action: 'accept', content: { name: username || 'octocat' } };
  }
  return { action };
}

function buildRetryRequest(action: ElicitAction, username: string) {
  return JSON.stringify(
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'open_github_issue',
        arguments: { title: 'Docs typo on the versioning page' },
        inputResponses: { github_login: buildElicitResult(action, username) },
        requestState: 'AEAD-protected-blob-abc123',
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': { elicitation: {} },
        },
      },
    },
    null,
    2
  );
}

function buildFinalResult(action: ElicitAction, username: string) {
  if (action === 'accept') {
    return JSON.stringify(
      {
        jsonrpc: '2.0',
        id: 2,
        result: {
          resultType: 'complete',
          content: [
            {
              type: 'text',
              text: `Opened issue #482 under ${username || 'octocat'}/docs-site.`,
            },
          ],
          isError: false,
        },
      },
      null,
      2
    );
  }

  if (action === 'decline') {
    return JSON.stringify(
      {
        jsonrpc: '2.0',
        id: 2,
        result: {
          resultType: 'complete',
          content: [
            { type: 'text', text: 'Skipped filing the issue since no username was provided.' },
          ],
          isError: false,
        },
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      jsonrpc: '2.0',
      id: 2,
      result: {
        resultType: 'input_required',
        inputRequests: {
          github_login: {
            method: 'elicitation/create',
            params: {
              message: 'Still need a GitHub username to file this issue. Try again?',
              requestedSchema: {
                type: 'object',
                properties: { name: { type: 'string' } },
                required: ['name'],
              },
            },
          },
        },
        requestState: 'AEAD-protected-blob-def456',
      },
    },
    null,
    2
  );
}

const MRTR_STEPS = [
  { key: 'initial', label: '1. Client calls the tool' },
  { key: 'input_required', label: '2. Server asks for input' },
  { key: 'user_input', label: '3. Client gathers the answer' },
  { key: 'retry', label: '4. Client retries with the answer' },
  { key: 'final', label: '5. Server returns the result' },
] as const;

function JsonPane({ json, dim }: { json: string; dim?: boolean }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: '1rem',
        borderRadius: '8px',
        background: '#0d1117',
        color: '#e6edf3',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.78rem',
        lineHeight: 1.6,
        overflowX: 'auto',
        opacity: dim ? 0.35 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      {json}
    </pre>
  );
}

function MrtrWalkthrough() {
  const [stepIndex, setStepIndex] = useState(0);
  const [username, setUsername] = useState('octocat');
  const [action, setAction] = useState<ElicitAction>('accept');

  const stepKey = MRTR_STEPS[stepIndex].key;

  const reset = () => {
    setStepIndex(0);
    setAction('accept');
  };

  return (
    <Card style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ListChecks size={18} style={{ color: 'var(--accent-color)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
            Walk through a Multi Round-Trip Request
          </h3>
        </div>
        <Button variant="secondary" size="sm" onClick={reset}>
          <RotateCcw size={14} style={{ marginRight: '0.35rem' }} />
          Restart
        </Button>
      </div>

      {/* Step tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {MRTR_STEPS.map((s, idx) => (
          <button
            key={s.key}
            onClick={() => setStepIndex(idx)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              border: `1px solid ${idx === stepIndex ? 'var(--accent-color)' : 'var(--border-color)'}`,
              background: idx === stepIndex ? 'rgba(0, 229, 255, 0.12)' : 'transparent',
              color: idx === stepIndex ? 'var(--accent-color)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {stepKey === 'initial' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            The client calls a tool. It has no username to pass yet, so the request only
            carries what it already knows.
          </p>
          <JsonPane json={buildInitialRequest()} />
        </div>
      )}

      {stepKey === 'input_required' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            The server can&rsquo;t finish without a username. Instead of sending its own
            JSON-RPC request back to the client (the old, now-removed pattern), it answers
            the original request with <code>resultType: &quot;input_required&quot;</code> and
            an opaque <code>requestState</code> blob the client must echo back unmodified.
          </p>
          <JsonPane json={buildInputRequiredResult()} />
        </div>
      )}

      {stepKey === 'user_input' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            The client renders the requested schema as a form and asks the user. Try each
            outcome below, an elicitation can be accepted, declined, or cancelled, and the
            protocol defines a distinct response shape for each.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '420px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Which GitHub username should this issue be filed under?
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. octocat"
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '0.4rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-muted)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant={action === 'accept' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setAction('accept')}
              >
                <CheckCircle2 size={14} style={{ marginRight: '0.35rem' }} /> Accept
              </Button>
              <Button
                variant={action === 'decline' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setAction('decline')}
              >
                <XCircle size={14} style={{ marginRight: '0.35rem' }} /> Decline
              </Button>
              <Button
                variant={action === 'cancel' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setAction('cancel')}
              >
                <Ban size={14} style={{ marginRight: '0.35rem' }} /> Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {stepKey === 'retry' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            The client retries the <em>original</em> request under a brand-new JSON-RPC{' '}
            <code>id</code>, this time carrying <code>inputResponses</code> for the answer
            and the exact <code>requestState</code> value the server handed back. The client
            never inspects that blob, it just echoes it.
          </p>
          <JsonPane json={buildRetryRequest(action, username)} />
        </div>
      )}

      {stepKey === 'final' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            {action === 'accept' &&
              'The server has what it needs and completes the request.'}
            {action === 'decline' &&
              'The user declined. The server treats this as a normal, complete outcome rather than an error, exactly the behavior the spec asks for.'}
            {action === 'cancel' &&
              'The user dismissed the prompt without a real answer. The server is free to ask again with a fresh requestState instead of failing outright.'}
          </p>
          <JsonPane json={buildFinalResult(action, username)} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={stepIndex === 0}
        >
          Back
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setStepIndex((i) => Math.min(MRTR_STEPS.length - 1, i + 1))}
          disabled={stepIndex === MRTR_STEPS.length - 1}
        >
          Next <ArrowRight size={14} style={{ marginLeft: '0.35rem' }} />
        </Button>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------------- */
/* Part 2: Era compatibility checker                                      */
/* ---------------------------------------------------------------------- */

type Era = 'modern' | 'legacy' | 'dual';

const ERA_LABELS: Record<Era, string> = {
  modern: 'Modern (2026-07-28+)',
  legacy: 'Legacy (initialize handshake, 2025-11-25 and earlier)',
  dual: 'Dual-era (supports both)',
};

const OUTCOMES: Record<Era, Record<Era, { works: boolean; text: string }>> = {
  modern: {
    modern: {
      works: true,
      text:
        'Works. Calling server/discover first is optional here, since a version mismatch simply comes back as UnsupportedProtocolVersionError and the client retries with a mutually supported version.',
    },
    legacy: {
      works: false,
      text:
        "Fails by default. A legacy server has no concept of the modern _meta protocol fields. It may reject the request with an implementation-defined error, stay silent, or even try to process it under legacy rules. On stdio, send server/discover first so an unrecognized-method response lets the client fail deterministically instead of hanging.",
    },
    dual: {
      works: true,
      text:
        "Works. A dual-era server decides its behavior from how the request arrives: since this request carries modern _meta fields, the server serves it under the current stateless revision, the same as a modern-only server would.",
    },
  },
  legacy: {
    modern: {
      works: false,
      text:
        "Fails, with no way to recover. On stdio the server rejects initialize outright since it is no longer a recognized method. On Streamable HTTP the request is missing the required headers and gets a 400. Legacy clients have no fall-forward mechanism, so the only real fix is upgrading the client.",
    },
    legacy: {
      works: true,
      text:
        'Works exactly as it always has. The initialize / initialized handshake negotiates a shared legacy protocol version and the session proceeds as before. Neither side ever speaks the modern, stateless dialect.',
    },
    dual: {
      works: true,
      text:
        "Works. The server recognizes the client's initialize request as the start of a legacy session and serves it under whichever legacy revision they negotiate. From the client's side, nothing looks different.",
    },
  },
  dual: {
    modern: {
      works: true,
      text:
        "Works, and the client stays modern. On stdio its server/discover probe gets back a real DiscoverResult; on HTTP its first modern-shaped request either succeeds or returns a modern error it can act on. It never needs to fall back.",
    },
    legacy: {
      works: true,
      text:
        'Works, by falling back. On stdio the probe times out or returns an error that is not a recognized modern one, so the client falls back to initialize. On Streamable HTTP, a modern-shaped request gets a 4xx whose body is not a recognized modern error, so the client falls back to initialize (and, as a last resort, to the deprecated HTTP+SSE transport).',
    },
    dual: {
      works: true,
      text:
        "Works either way the client lands. Its probe or first request will read as modern to the server, so it gets served the current stateless revision. Had it opened with initialize instead, the same server would have negotiated a legacy session just as happily. Staying modern is preferable, since it gets the newer error handling and discovery.",
    },
  },
};

function EraChecker() {
  const [client, setClient] = useState<Era>('dual');
  const [server, setServer] = useState<Era>('modern');

  const outcome = OUTCOMES[client][server];

  return (
    <Card style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <ListChecks size={18} style={{ color: 'var(--accent-color)' }} />
        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
          Era compatibility checker
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          Your client implements
          <select
            value={client}
            onChange={(e) => setClient(e.target.value as Era)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '0.4rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-muted)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            {(Object.keys(ERA_LABELS) as Era[]).map((e) => (
              <option key={e} value={e}>{ERA_LABELS[e]}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          The server implements
          <select
            value={server}
            onChange={(e) => setServer(e.target.value as Era)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '0.4rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-muted)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            {(Object.keys(ERA_LABELS) as Era[]).map((e) => (
              <option key={e} value={e}>{ERA_LABELS[e]}</option>
            ))}
          </select>
        </label>
      </div>

      <div
        style={{
          padding: '1rem 1.1rem',
          borderRadius: '8px',
          background: outcome.works ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${outcome.works ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          display: 'flex',
          gap: '0.65rem',
          alignItems: 'flex-start',
        }}
      >
        {outcome.works ? (
          <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
        ) : (
          <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
        )}
        <div>
          <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: outcome.works ? '#10b981' : '#ef4444' }}>
            {outcome.works ? 'Connects successfully' : 'Connection fails'}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {outcome.text}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------------- */

export function MCPVersioningPlayground() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <MrtrWalkthrough />
      <EraChecker />
    </div>
  );
}
