'use client';

import React from 'react';
import { Sparkles, Plus, ArrowRight } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { SafeMarkdown } from './ui/SafeMarkdown';
import { ImpressionBeacon } from './ImpressionTracker';

type Server = {
  id: string;
  name: string;
  description: string;
  category: string;
  isOfficial?: boolean;
  isPremium?: boolean;
};

// Brand-adjacent avatar gradients
function getGradient(str: string) {
  const colors = [
    'linear-gradient(135deg, #00e5ff, #007bff)',
    'linear-gradient(135deg, #007bff, #0f172a)',
    'linear-gradient(135deg, #22d3ee, #0369a1)',
    'linear-gradient(135deg, #38bdf8, #1e3a8a)',
    'linear-gradient(135deg, #0ea5e9, #164e63)',
    'linear-gradient(135deg, #67e8f9, #1d4ed8)',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

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
          <Card href={`/mcp/${server.id}`} hoverable style={{ padding: 'clamp(1.25rem, 4vw, 2rem)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', border: '1px solid rgba(0, 229, 255, 0.2)', background: 'linear-gradient(to bottom right, rgba(0, 229, 255, 0.05), transparent)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #00E5FF, #007BFF)' }}></div>
            
            <div className="featured-card-header">
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: getGradient(server.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                {server.name.charAt(0)}
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {(server.isPremium || server.isOfficial) && (
                  <Badge variant="official">Verified</Badge>
                )}
                <Badge variant="success" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.1), rgba(0,123,255,0.1))', color: '#00E5FF', borderColor: 'rgba(0,229,255,0.2)' }}>★ Featured</Badge>
              </div>
            </div>
            
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontWeight: 700 }}>{server.name}</h3>
            <div style={{ fontSize: '0.875rem', marginBottom: '1.5rem', flexGrow: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--text-secondary)' }}>
              <SafeMarkdown content={server.description || 'No description provided.'} isInline />
            </div>
            <div style={{ display: 'flex' }}>
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
            
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Spotlight Your MCP Server</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', flexGrow: 1, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Reach thousands of developers building AI agents with Claude &amp; Cursor. Submit your server and feature it at the top of the directory.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#00E5FF', fontSize: '0.9rem' }}>
              <span>Submit &amp; Feature Your Server</span>
              <ArrowRight size={16} />
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}
