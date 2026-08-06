'use client';

import React from 'react';
import { Sparkles, Plus, ArrowRight } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { SafeMarkdown } from './ui/SafeMarkdown';
import { ServerAvatar } from './ui/ServerAvatar';
import { ImpressionBeacon } from './ImpressionTracker';
import { parseServerName } from '../lib/displayName';
import { getCategoryMeta } from '../lib/categories';

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
    <section className="container animate-fade-in delay-2" style={{ marginBottom: '2.5rem' }}>
      <h2 className="text-section" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Sparkles size={24} style={{ color: 'var(--accent-color)' }} />
        Featured Servers
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem' }}>
        {displayServers.map((server) => (
          <ImpressionBeacon key={server.id} serverId={server.id} surface="homepage_featured">
          <Card href={`/mcp/${server.id}`} hoverable className="directory-card-featured" style={{ padding: 'clamp(1.25rem, 4vw, 2rem)', display: 'flex', flexDirection: 'column', minHeight: '310px', maxHeight: '310px', position: 'relative', overflow: 'hidden' }}>
            <div className="featured-card-header">
              <ServerAvatar name={server.name} logoUrl={server.logoUrl} category={server.category} size={56} />
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {(server.isPremium || server.isOfficial) && (
                  <Badge variant="official">Verified</Badge>
                )}
                <Badge variant="success" className="badge-featured">★ Featured</Badge>
              </div>
            </div>

            {(() => {
              const { displayName, org } = parseServerName(server.name);
              return (
                <div style={{ minHeight: '2.8rem', marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
            <div style={{ fontSize: '0.875rem', height: '5.25rem', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
              <SafeMarkdown content={server.description || 'No description provided.'} isInline />
            </div>
            <div style={{ display: 'flex', marginTop: 'auto', paddingTop: '0.5rem' }}>
              {(() => {
                const catMeta = getCategoryMeta(server.category);
                return (
                  <Badge 
                    variant="category"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <span aria-hidden="true">{catMeta.emoji}</span>
                    {catMeta.label}
                  </Badge>
                );
              })()}
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
              minHeight: '310px',
              maxHeight: '310px',
              position: 'relative',
              overflow: 'hidden',
              border: '1px dashed var(--accent-color)',
              background: 'var(--brand-gradient-soft)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div className="featured-card-header">
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={28} style={{ color: 'var(--accent-color)' }} />
              </div>
              <Badge variant="success" className="badge-featured">★ Add Server</Badge>
            </div>
            
            <div style={{ minHeight: '2.8rem', marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h3 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Submit Your MCP Server</h3>
            </div>
            <p style={{ fontSize: '0.875rem', height: '5.25rem', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem' }}>
              List your server in the directory so developers building with Claude, Cursor, and AI agents can discover and install your integration.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--accent-color)', fontSize: '0.9rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
              <span>Submit Server</span>
              <ArrowRight size={16} />
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}
