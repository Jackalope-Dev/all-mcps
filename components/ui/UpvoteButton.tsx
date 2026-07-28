'use client';

import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

export function UpvoteButton({ serverId, initialCount }: { serverId: string; initialCount: number }) {
  const [upvotes, setUpvotes] = useState(initialCount || 0);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Check if the user has already upvoted this server
    const upvoted = localStorage.getItem(`upvote_${serverId}`);
    if (upvoted) {
      setHasUpvoted(true);
    }
  }, [serverId]);

  const handleUpvote = async () => {
    if (hasUpvoted) return;

    // Optimistic UI update
    setUpvotes(prev => prev + 1);
    setHasUpvoted(true);
    localStorage.setItem(`upvote_${serverId}`, 'true');

    try {
      await fetch(`/api/mcp/${serverId}/metric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric: 'upvote' }),
      });
    } catch (e) {
      console.error("Failed to upvote:", e);
      // Revert on failure
      setUpvotes(prev => prev - 1);
      setHasUpvoted(false);
      localStorage.removeItem(`upvote_${serverId}`);
    }
  };

  return (
    <button
      onClick={handleUpvote}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={hasUpvoted}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: hasUpvoted ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
        border: `1px solid ${hasUpvoted ? 'rgba(236, 72, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
        borderRadius: '100px',
        padding: '0.5rem 1rem',
        color: hasUpvoted ? '#ec4899' : (isHovered ? 'white' : 'var(--text-secondary)'),
        fontSize: '0.875rem',
        fontWeight: hasUpvoted ? 600 : 500,
        cursor: hasUpvoted ? 'default' : 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: hasUpvoted ? '0 0 10px rgba(236, 72, 153, 0.2)' : 'none',
      }}
    >
      <Heart 
        size={16} 
        fill={hasUpvoted ? '#ec4899' : (isHovered ? 'rgba(255,255,255,0.2)' : 'transparent')} 
        color={hasUpvoted ? '#ec4899' : 'currentColor'}
        style={{ transition: 'all 0.2s ease' }}
      />
      {upvotes} {upvotes === 1 ? 'Upvote' : 'Upvotes'}
    </button>
  );
}
