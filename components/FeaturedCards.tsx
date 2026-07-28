'use client';

import React from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { SafeMarkdown } from './ui/SafeMarkdown';

type Server = {
  id: string;
  name: string;
  description: string;
  category: string;
};

// Generate a random gradient based on the string
function getGradient(str: string) {
  const colors = [
    'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    'linear-gradient(135deg, #10b981, #047857)',
    'linear-gradient(135deg, #f59e0b, #b45309)',
    'linear-gradient(135deg, #8b5cf6, #5b21b6)',
    'linear-gradient(135deg, #ec4899, #be185d)',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function FeaturedCards({ servers }: { servers: Server[] }) {
  if (!servers || servers.length === 0) return null;

  return (
    <section className="container animate-fade-in delay-2" style={{ marginBottom: '4rem' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ display: 'inline-block', width: '24px', height: '24px', background: 'linear-gradient(135deg, var(--accent-color), #007BFF)', borderRadius: '6px' }}></span>
        Featured Servers
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {servers.slice(0, 3).map((server) => (
          <Card key={server.id} href={`/mcp/${server.id}`} hoverable style={{ padding: '2rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', border: '1px solid rgba(0, 229, 255, 0.2)', background: 'linear-gradient(to bottom right, rgba(0, 229, 255, 0.05), transparent)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #00E5FF, #007BFF)' }}></div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: getGradient(server.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                {server.name.charAt(0)}
              </div>
              <Badge variant="success" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.1), rgba(0,123,255,0.1))', color: '#00E5FF', borderColor: 'rgba(0,229,255,0.2)' }}>★ Featured</Badge>
            </div>
            
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', fontWeight: 700 }}>{server.name}</h3>
            <div style={{ fontSize: '0.875rem', marginBottom: '1.5rem', flexGrow: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--text-secondary)' }}>
              <SafeMarkdown content={server.description || 'No description provided.'} isInline />
            </div>
            <div style={{ display: 'flex' }}>
              <Badge variant="category">{server.category}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
