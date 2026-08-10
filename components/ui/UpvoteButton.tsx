'use client';

import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { toast } from './Toast';
import { trackUpvote } from '../../lib/gtag';

export function UpvoteButton({ serverId, initialCount }: { serverId: string; initialCount: number }) {
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

  const handleUpvote = async () => {
    if (hasUpvoted) return;

    // Optimistic UI update
    setUpvotes(prev => prev + 1);
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
        // Keep hasUpvoted true, but undo the optimistic +1 since this click
        // didn't register a new vote.
        setUpvotes((prev) => prev - 1);
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
      setUpvotes((prev) => prev - 1);
      setHasUpvoted(false);
      localStorage.removeItem(`upvote_${serverId}`);
      toast.error('Could not upvote', {
        description: 'Something went wrong. Please try again.',
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleUpvote}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={hasUpvoted}
      className={`listing-metric-pill listing-metric-pill--button listing-metric-pill--upvote ${hasUpvoted ? 'listing-metric-pill--upvoted' : ''}`}
      title={hasUpvoted ? 'Upvoted' : 'Click to upvote'}
      aria-label={`${hasUpvoted ? 'Upvoted' : 'Upvote'}. Current count: ${upvotes}`}
    >
      <Heart 
        size={16} 
        className="upvote-heart-icon text-white"
        fill={hasUpvoted ? '#ffffff' : (isHovered ? 'rgba(255, 255, 255, 0.5)' : 'transparent')} 
        style={{ transition: 'all 0.2s ease', color: '#ffffff' }}
      />
      <span>{upvotes} {upvotes === 1 ? 'Upvote' : 'Upvotes'}</span>
    </button>
  );
}
