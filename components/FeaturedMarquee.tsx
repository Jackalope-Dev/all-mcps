'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useImpressionTracker, ImpressionBeacon } from './ImpressionTracker';
import { parseServerName } from '../lib/displayName';

type Server = {
  id: string;
  name: string;
  category: string;
};

export function FeaturedMarquee({ servers }: { servers: Server[] }) {
  const { trackImpression } = useImpressionTracker();
  // If we don't have enough servers to scroll seamlessly, duplicate them
  const displayServers = [...servers, ...servers, ...servers].slice(0, 20);

  const MarqueeItems = ({ isDuplicate = false }: { isDuplicate?: boolean }) => (
    <>
      {displayServers.map((server, i) => (
        <React.Fragment key={`${server.id}-${i}`}>
          <ImpressionBeacon serverId={server.id} surface="homepage_marquee">
            <Link 
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
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-strong)';
                trackImpression(server.id, 'homepage_marquee');
              }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-color)', boxShadow: '0 0 8px var(--accent-color)' }}></span>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{parseServerName(server.name).displayName}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{server.category}</span>
            </Link>
          </ImpressionBeacon>

          {(i + 1) % 6 === 0 && (
            <Link
              href="/submit"
              tabIndex={isDuplicate ? -1 : undefined}
              aria-hidden={isDuplicate ? true : undefined}
              className="surface"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '100px',
                whiteSpace: 'nowrap',
                background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(0, 123, 255, 0.15))',
                borderColor: 'rgba(0, 229, 255, 0.4)',
                color: '#00E5FF',
                fontWeight: 700,
                fontSize: '0.875rem',
                boxShadow: '0 0 12px rgba(0, 229, 255, 0.2)',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
            >
              <Sparkles size={14} style={{ color: '#00E5FF' }} />
              <span>+ Add Your MCP Here</span>
            </Link>
          )}
        </React.Fragment>
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
