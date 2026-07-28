'use client';

import { useEffect, useRef } from 'react';

export function ViewTracker({ serverId }: { serverId: string }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    // Fire and forget view increment
    fetch(`/api/mcp/${serverId}/metric`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric: 'view' }),
    }).catch((e) => console.error("Failed to track view:", e));
  }, [serverId]);

  return null;
}
