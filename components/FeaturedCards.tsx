'use client';

import React from 'react';
import { Sparkles, Plus, ArrowRight } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { SafeMarkdown } from './ui/SafeMarkdown';
import { ServerAvatar } from './ui/ServerAvatar';
import { ImpressionBeacon } from './ImpressionTracker';
import { parseServerName } from '../lib/displayName';

type Server = {
  id: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string | null;
  isOfficial?: boolean;
  isPremium?: boolean;
};

export function FeaturedCards({ servers }: { servers: Server[] }) {
  const displayServers = (servers || []).slice(0, 2);
  const showUpsellCard = true; // Always reserve 1 slot for an open featured slot upsell if room permits up to 3 total slots

  return (
    <section className="container animate-fade-in delay-2" style={{ marginBottom: '4rem' }}>
      <h2 className="text-section" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Sparkles size={24} style={{ color: 'var(--accent-color)' }} />
        Featured Servers
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem' }}>
        {displayServers.map((server) => (
          <ImpressionBeacon key={server.id} serverId={server.id} surface="homepage_featured">
          <Card href={`/mcp/${server.id}`} hoverable style={{ padding: 'clamp(1.25rem, 4vw, 2rem)', display: 'flex', flexDirection: 'column', minHeight: '320px', maxHeight: '320px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(0, 229, 255, 0.2)', background: 'linear-gradient(to bottom right, rgba(0, 229, 255, 0.05), transparent)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #00E5FF, #007BFF)' }}></div>

            <div className="featured-card-header">
              <ServerAvatar name={server.name} logoUrl={server.logoUrl} size={56} />
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {(server.isPremium || server.isOfficial) && (
                  <Badge variant="official">Verified</Badge>
                )}
                <Badge variant="success" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.1), rgba(0,123,255,0.1))', color: '#00E5FF', borderColor: 'rgba(0,229,255,0.2)' }}>★ Featured</Badge>
              </div>
            </div>

            {(() => {
              const { displayName, org } = parseServerName(server.name);
              return (
                <div style={{ minHeight: '3.2rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3
                    style={{
                      fontSize: '1.35rem',
                      fontWeight: 700,
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displayName}
                  </h3>
                  {org && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {org}
                    </div>
                  )}
                </div>
              );
            })()}
            <div style={{ fontSize: '0.875rem', height: '3.9rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              <SafeMarkdown content={server.description || 'No description provided.'} isInline />
            </div>
            <div style={{ display: 'flex', marginTop: 'auto', paddingTop: '0.5rem' }}>
              <Badge variant="category">{server.category}</Badge>
            </div>
          </Card>
          </ImpressionBeacon>
        ))}

        {showUpsellCard && (
          <Card
            href="/submit"
            hoverable
            style={{
              padding: 'clamp(1.25rem, 4vw, 2rem)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '320px',
              maxHeight: '320px',
              position: 'relative',
              overflow: 'hidden',
              border: '1px dashed rgba(0, 229, 255, 0.4)',
              background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(0, 123, 255, 0.04) 100%)',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #00E5FF, #38bdf8)' }}></div>
            
            <div className="featured-card-header">
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(0, 123, 255, 0.2))', border: '1px solid rgba(0, 229, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={28} style={{ color: '#00E5FF' }} />
              </div>
              <Badge variant="success" style={{ background: 'rgba(0, 229, 255, 0.15)', color: '#00E5FF', borderColor: 'rgba(0, 229, 255, 0.4)' }}>★ Open Slot</Badge>
            </div>
            
            <div style={{ minHeight: '3.2rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h3 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Spotlight Your MCP Server</h3>
            </div>
            <p style={{ fontSize: '0.875rem', height: '3.9rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem' }}>
              Reach thousands of developers building AI agents with Claude &amp; Cursor. Submit your server and feature it at the top of the directory.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#00E5FF', fontSize: '0.9rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
              <span>Submit &amp; Feature Your Server</span>
              <ArrowRight size={16} />
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}
