'use client';

import { Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { trackUpvote } from '../../lib/gtag';
import { toast } from './Toast';

export function UpvoteButton({
  serverId,
  initialCount,
}: {
  serverId: string;
  initialCount: number;
}) {
  const [upvotes, setUpvotes] = useState(initialCount || 0);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Check if the user has already upvoted this server
    const upvoted = localStorage.getItem(`upvote_${serverId}`);
    if (upvoted) {
      setHasUpvoted(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/mcp/${serverId}/metric`);
        if (!res.ok) return;

        const data = (await res.json()) as { alreadyVoted?: boolean };
        if (!cancelled && data.alreadyVoted) {
          setHasUpvoted(true);
          localStorage.setItem(`upvote_${serverId}`, 'true');
        }
      } catch {
        // Best-effort convenience check; leaving the button clickable on
        // failure is fine — the POST below still enforces dedup server-side.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleUpvote = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (hasUpvoted) {
      // Optimistic UI update: Unupvote
      setUpvotes((prev) => Math.max(0, prev - 1));
      setHasUpvoted(false);
      localStorage.removeItem(`upvote_${serverId}`);

      try {
        const res = await fetch(`/api/mcp/${serverId}/metric`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric: 'unupvote' }),
        });

        if (res.status === 404) {
          // Not voted server-side; keep state as unvoted
          return;
        }

        if (!res.ok) {
          throw new Error(`Unupvote request failed with status ${res.status}`);
        }

        toast.info('Upvote removed', {
          description: 'Your upvote has been removed.',
        });
      } catch (e) {
        console.error('Failed to remove upvote:', e);
        // Revert on failure
        setUpvotes((prev) => prev + 1);
        setHasUpvoted(true);
        localStorage.setItem(`upvote_${serverId}`, 'true');
        toast.error('Could not remove upvote', {
          description: 'Something went wrong. Please try again.',
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Optimistic UI update: Upvote
      setUpvotes((prev) => prev + 1);
      setHasUpvoted(true);
      localStorage.setItem(`upvote_${serverId}`, 'true');

      try {
        const res = await fetch(`/api/mcp/${serverId}/metric`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric: 'upvote' }),
        });

        if (res.status === 409) {
          // Already voted server-side (e.g. a stale/cleared localStorage flag).
          setUpvotes((prev) => Math.max(0, prev - 1));
          toast.info('Already upvoted', {
            description: 'You have already supported this server.',
          });
          return;
        }

        if (!res.ok) {
          throw new Error(`Upvote request failed with status ${res.status}`);
        }

        trackUpvote({ serverId });

        toast.success('Upvoted', {
          description: 'Thanks for supporting this server.',
        });
      } catch (e) {
        console.error('Failed to upvote:', e);
        // Revert on failure
        setUpvotes((prev) => Math.max(0, prev - 1));
        setHasUpvoted(false);
        localStorage.removeItem(`upvote_${serverId}`);
        toast.error('Could not upvote', {
          description: 'Something went wrong. Please try again.',
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggleUpvote}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={isSubmitting}
      className={`listing-metric-pill listing-metric-pill--button listing-metric-pill--upvote ${hasUpvoted ? 'listing-metric-pill--upvoted' : ''}`}
      title={hasUpvoted ? 'Click to remove upvote' : 'Click to upvote'}
      aria-label={`${hasUpvoted ? 'Remove upvote' : 'Upvote'}. Current count: ${upvotes}`}
    >
      <Heart
        size={16}
        className="upvote-heart-icon text-white"
        fill={
          hasUpvoted
            ? '#ffffff'
            : isHovered
              ? 'rgba(255, 255, 255, 0.5)'
              : 'transparent'
        }
        style={{ transition: 'all 0.2s ease', color: '#ffffff' }}
      />
      <span>
        {upvotes} {upvotes === 1 ? 'Upvote' : 'Upvotes'}
      </span>
    </button>
  );
}
