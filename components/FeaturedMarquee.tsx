'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, TrendingUp } from 'lucide-react';
import { useImpressionTracker, ImpressionBeacon } from './ImpressionTracker';
import { parseServerName } from '../lib/displayName';
import { getCategoryMeta } from '../lib/categories';

type Server = {
  id: string;
  name: string;
  category: string;
};

export function FeaturedMarquee({ servers }: { servers: Server[] }) {
  const { trackImpression } = useImpressionTracker();
  if (!servers || servers.length === 0) return null;

  // If we don't have enough servers to scroll seamlessly, duplicate them
  const displayServers = [...servers, ...servers, ...servers].slice(0, 24);

  const MarqueeItems = ({ isDuplicate = false }: { isDuplicate?: boolean }) => (
    <>
      {displayServers.map((server, i) => {
        const catMeta = getCategoryMeta(server.category);
        return (
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
                  gap: '0.6rem', 
                  padding: '0.45rem 1rem', 
                  borderRadius: '100px',
                  whiteSpace: 'nowrap',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = catMeta.color;
                  e.currentTarget.style.background = catMeta.bgTint;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  trackImpression(server.id, 'homepage_marquee');
                }}
                onMouseLeave={(e) => { 
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; 
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span 
                  style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: catMeta.color, 
                    boxShadow: `0 0 8px ${catMeta.color}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {parseServerName(server.name).displayName}
                </span>
                <span 
                  style={{ 
                    color: catMeta.color, 
                    fontSize: '0.725rem',
                    fontWeight: 500,
                    opacity: 0.9,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span aria-hidden="true">{catMeta.emoji}</span>
                  {catMeta.label}
                </span>
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
                  padding: '0.45rem 1rem',
                  borderRadius: '100px',
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.15), rgba(0, 123, 255, 0.15))',
                  borderColor: 'rgba(0, 229, 255, 0.4)',
                  color: '#00E5FF',
                  fontWeight: 700,
                  fontSize: '0.825rem',
                  boxShadow: '0 0 12px rgba(0, 229, 255, 0.15)',
                  transition: 'transform 0.2s, border-color 0.2s',
                }}
              >
                <Sparkles size={13} style={{ color: '#00E5FF' }} />
                <span>+ Submit MCP</span>
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </>
  );

  return (
    <div style={{ margin: '1.75rem 0 2.5rem 0' }}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '0.5rem', 
          marginBottom: '0.75rem',
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)',
        }}
      >
        <TrendingUp size={14} style={{ color: 'var(--accent-color)' }} />
        <span>Featured & Trending MCP Servers</span>
      </div>

      <div className="marquee-container" style={{ margin: 0, padding: '0.5rem 0' }}>
        <div className="marquee-content">
          <MarqueeItems />
        </div>
        <div className="marquee-content" aria-hidden="true">
          <MarqueeItems isDuplicate />
        </div>
      </div>
    </div>
  );
}

