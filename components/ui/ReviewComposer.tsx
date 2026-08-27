'use client';

import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SignInGate } from './SignInGate';
import { toast } from './Toast';
import { TurnstileWidget } from './TurnstileWidget';

type MineResponse = {
  signedIn: boolean;
  review: {
    rating: number;
    comment: string | null;
    commentStatus: string;
  } | null;
};

/**
 * Login-gated star rating + optional written comment for a listing. Self-fetches
 * its own sign-in state client-side (never a server auth() call — see
 * app/mcp/[id]/page.tsx's comment on why that page must stay ISR-cacheable),
 * same pattern as OwnerZone/is-owner.
 */
export function ReviewComposer({ serverId }: { serverId: string }) {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [existingCommentStatus, setExistingCommentStatus] = useState<
    string | null
  >(null);
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<{
    commentStatus: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/mcp/${serverId}/reviews/mine`)
      .then((res) => res.json() as Promise<MineResponse>)
      .then((data) => {
        if (cancelled) return;
        setSignedIn(data.signedIn);
        if (data.review) {
          setRating(data.review.rating);
          setComment(data.review.comment || '');
          setExistingCommentStatus(data.review.commentStatus);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const signInHref = `/login?callbackUrl=${encodeURIComponent(`/mcp/${serverId}#reviews`)}`;

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error('Pick a star rating first.');
      return;
    }
    if (!token) {
      toast.error('Please complete the verification challenge.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/mcp/${serverId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment,
          'cf-turnstile-response': token,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        commentStatus?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Could not submit review');
      setExistingCommentStatus(data.commentStatus || 'none');
      setJustSubmitted({ commentStatus: data.commentStatus || 'none' });
      toast.success('Thanks for your review!');
    } catch (err: any) {
      toast.error('Could not submit review', { description: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  if (!signedIn) {
    return (
      <SignInGate href={signInHref} message="Sign in to write a review." />
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <div
      style={{
        padding: '1.25rem',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        background: 'var(--bg-muted)',
      }}
    >
      <h3
        style={{
          fontSize: '0.95rem',
          margin: '0 0 0.75rem',
          color: 'var(--text-primary)',
        }}
      >
        {existingCommentStatus !== null || rating > 0
          ? 'Update your review'
          : 'Write a review'}
      </h3>

      <div style={{ display: 'flex', gap: 4, marginBottom: '0.9rem' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
            }}
          >
            <Star
              size={26}
              fill={n <= displayRating ? '#fbbf24' : 'none'}
              color={n <= displayRating ? '#fbbf24' : 'var(--border-strong)'}
            />
          </button>
        ))}
      </div>

      <textarea
        className="form-input"
        rows={3}
        maxLength={2000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional — share what worked or didn't (goes through a quick review before it's shown publicly)"
        style={{ width: '100%', marginBottom: '0.75rem', resize: 'vertical' }}
      />

      <TurnstileWidget
        onSuccess={setToken}
        onExpire={() => setToken(null)}
        compact
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !token || rating < 1}
        style={{
          marginTop: '0.75rem',
          padding: '0.65rem 1.25rem',
          borderRadius: 8,
          border: 'none',
          background: 'var(--accent-color)',
          color: 'var(--bg-color)',
          fontWeight: 600,
          cursor:
            submitting || !token || rating < 1 ? 'not-allowed' : 'pointer',
          opacity: submitting || !token || rating < 1 ? 0.6 : 1,
        }}
      >
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>

      {justSubmitted && (
        <p
          style={{
            marginTop: '0.75rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          Your rating is live now.
          {justSubmitted.commentStatus === 'pending' &&
            ' Your comment is awaiting a quick review before it shows up publicly.'}
        </p>
      )}
    </div>
  );
}
