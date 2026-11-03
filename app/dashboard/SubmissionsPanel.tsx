'use client';

import { Clock, Edit3, XCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from '@/components/ui/Toast';
import type { MySubmission } from '@/lib/submissions';

/**
 * The signed-in user's submissions that aren't live yet: pending ones, and
 * rejected ones they can fix and send back (lib/submissions.ts).
 */
export function SubmissionsPanel({ initial }: { initial: MySubmission[] }) {
  const [items, setItems] = useState(initial);
  if (items.length === 0) return null;

  const markPending = (id: string, patch: Partial<MySubmission>) =>
    setItems((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, ...patch, status: 'pending', canResubmit: false }
          : s,
      ),
    );

  return (
    <section className="acct-subs" aria-labelledby="acct-subs-title">
      <h2 id="acct-subs-title" className="acct-subs-title">
        Your submissions
      </h2>
      <ul className="acct-subs-list">
        {items.map((s) => (
          <SubmissionRow key={s.id} s={s} onResubmitted={markPending} />
        ))}
      </ul>
    </section>
  );
}

function SubmissionRow({
  s,
  onResubmitted,
}: {
  s: MySubmission;
  onResubmitted: (id: string, patch: Partial<MySubmission>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: s.name,
    description: s.description,
    url: s.url,
    websiteUrl: s.websiteUrl ?? '',
    remoteEndpointUrl: s.remoteEndpointUrl ?? '',
  });
  const ids = {
    name: useId(),
    description: useId(),
    url: useId(),
    websiteUrl: useId(),
    remoteEndpointUrl: useId(),
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/resubmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, ...form }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not resubmit.');
      toast.success('Sent back for review. We’ll email you when it’s done.');
      setEditing(false);
      onResubmitted(s.id, {
        name: form.name,
        description: form.description,
        url: form.url,
        websiteUrl: form.websiteUrl || null,
        remoteEndpointUrl: form.remoteEndpointUrl || null,
      });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const rejected = s.status === 'rejected';
  return (
    <li className={`acct-sub${rejected ? ' is-rejected' : ''}`}>
      <div className="acct-sub-head">
        <strong className="acct-sub-name">{s.name}</strong>
        <span className="acct-sub-status">
          {rejected ? (
            <>
              <XCircle size={14} aria-hidden="true" /> Needs changes
            </>
          ) : (
            <>
              <Clock size={14} aria-hidden="true" /> In review
            </>
          )}
        </span>
      </div>

      {rejected && (s.reasons.length > 0 || s.feedback) && (
        <div className="acct-sub-feedback">
          {s.reasons.length > 0 && (
            <p className="acct-sub-reasons">{s.reasons.join(' · ')}</p>
          )}
          {s.feedback?.split(/\n{2,}/).map((para) => (
            <p key={para}>{para}</p>
          ))}
        </div>
      )}

      {rejected && !s.canResubmit && (
        <p className="acct-sub-note">
          This one has been reviewed the maximum number of times.{' '}
          <a href="/contact">Contact us</a> if you think we got it wrong.
        </p>
      )}

      {rejected && s.canResubmit && !editing && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setEditing(true)}
        >
          <Edit3 size={14} aria-hidden="true" /> Edit and resubmit
        </button>
      )}

      {editing && (
        <form
          className="form-stack acct-sub-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="form-field">
            <label className="form-label" htmlFor={ids.name}>
              Name
            </label>
            <input
              id={ids.name}
              className="form-input"
              maxLength={200}
              required
              value={form.name}
              onChange={set('name')}
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor={ids.description}>
              Description
            </label>
            <textarea
              id={ids.description}
              className="form-input"
              rows={4}
              minLength={20}
              maxLength={2000}
              required
              value={form.description}
              onChange={set('description')}
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor={ids.url}>
              Repository or website URL
            </label>
            <input
              id={ids.url}
              className="form-input"
              type="url"
              required
              value={form.url}
              onChange={set('url')}
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor={ids.websiteUrl}>
              Website (optional)
            </label>
            <input
              id={ids.websiteUrl}
              className="form-input"
              type="url"
              value={form.websiteUrl}
              onChange={set('websiteUrl')}
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor={ids.remoteEndpointUrl}>
              Hosted MCP endpoint (optional)
            </label>
            <input
              id={ids.remoteEndpointUrl}
              className="form-input"
              type="url"
              placeholder="https://example.com/mcp"
              value={form.remoteEndpointUrl}
              onChange={set('remoteEndpointUrl')}
            />
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={busy}
            >
              {busy ? 'Sending…' : 'Resubmit for review'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
