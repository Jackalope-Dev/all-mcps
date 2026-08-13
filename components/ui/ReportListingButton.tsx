'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag, X } from 'lucide-react';
import { toast } from './Toast';
import { TurnstileWidget } from './TurnstileWidget';

const REASONS: { value: string; label: string }[] = [
  { value: 'broken_install', label: "Install doesn't work" },
  { value: 'misleading', label: 'Misleading or inaccurate info' },
  { value: 'malicious', label: 'Malicious or unsafe behavior' },
  { value: 'dead_link', label: 'Dead link / repo gone' },
  { value: 'other', label: 'Something else' },
];

/**
 * Low-friction "something's wrong here" flag — no login required (the visitor
 * most motivated to report is usually mid-frustration with something broken),
 * Turnstile-gated. Never shown as a public count anywhere: reports are purely
 * an admin triage signal, not a public/negative badge on the listing.
 */
export function ReportListingButton({ serverId }: { serverId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('broken_install');
  const [details, setDetails] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const close = () => {
    setIsOpen(false);
    // Reset after the close animation-free unmount so a re-open starts fresh.
    setTimeout(() => {
      setReason('broken_install');
      setDetails('');
      setToken(null);
      setSubmitted(false);
    }, 200);
  };

  const handleSubmit = async () => {
    if (!token) {
      toast.error('Please complete the verification challenge.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/mcp/${serverId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, details, 'cf-turnstile-response': token }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not submit report');
      setSubmitted(true);
    } catch (err: any) {
      toast.error('Could not submit report', { description: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div className="share-modal-overlay" onClick={close}>
      <div
        className="share-modal-content"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0.5rem',
            display: 'flex',
            borderRadius: '50%',
          }}
        >
          <X size={20} />
        </button>

        <div className="share-modal-scroll">
          {submitted ? (
            <>
              <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5rem', color: 'var(--text-primary)', paddingRight: '2.5rem' }}>
                Thanks for the report
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Our team will take a look. This doesn&rsquo;t change anything about the listing publicly on its own — it goes into our review queue.
              </p>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.35rem', marginBottom: '0.5rem', color: 'var(--text-primary)', paddingRight: '2.5rem' }}>
                Report a problem
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                Let us know if something&rsquo;s broken, wrong, or unsafe about this listing.
              </p>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                What&rsquo;s wrong?
              </label>
              <select
                className="form-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', marginBottom: '1rem' }}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Details <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(optional)</span>
              </label>
              <textarea
                className="form-input"
                rows={3}
                maxLength={500}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Anything that would help us look into it"
                style={{ width: '100%', marginBottom: '0.5rem', resize: 'vertical' }}
              />

              <TurnstileWidget onSuccess={setToken} onExpire={() => setToken(null)} compact />

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !token}
                style={{
                  width: '100%',
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent-color)',
                  color: 'var(--bg-color)',
                  fontWeight: 600,
                  cursor: submitting || !token ? 'not-allowed' : 'pointer',
                  opacity: submitting || !token ? 0.6 : 1,
                }}
              >
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mcp-action-btn"
        title="Report a problem with this listing"
        aria-label="Report a problem with this listing"
      >
        <Flag size={18} style={{ color: 'var(--text-secondary)' }} />
        <span className="mcp-action-btn-label">Report</span>
      </button>

      {isOpen && createPortal(modalContent, document.body)}
    </>
  );
}
