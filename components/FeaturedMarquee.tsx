'use client';

import React from 'react';
import Link from 'next/link';

type Server = {
  id: string;
  name: string;
  category: string;
};

export function FeaturedMarquee({ servers }: { servers: Server[] }) {
  // If we don't have enough servers to scroll seamlessly, duplicate them
  const displayServers = [...servers, ...servers, ...servers].slice(0, 20);

  const MarqueeItems = ({ isDuplicate = false }: { isDuplicate?: boolean }) => (
    <>
      {displayServers.map((server, i) => (
        <Link 
          key={`${server.id}-${i}`} 
          href={`/mcp/${server.id}`}
          tabIndex={isDuplicate ? -1 : undefined}
          aria-hidden={isDuplicate ? true : undefined}
          className="surface"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            padding: '0.5rem 1rem', 
            borderRadius: '100px',
            whiteSpace: 'nowrap',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-color)', boxShadow: '0 0 8px var(--accent-color)' }}></span>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{server.name}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{server.category}</span>
        </Link>
      ))}
    </>
  );

  return (
    <div className="marquee-container" style={{ margin: '2rem 0 4rem 0', padding: '1rem 0' }}>
      <div className="marquee-content">
        <MarqueeItems />
      </div>
      <div className="marquee-content" aria-hidden="true">
        <MarqueeItems isDuplicate />
      </div>
    </div>
  );
}
