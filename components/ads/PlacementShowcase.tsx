'use client';

import { FileText, LayoutGrid, PanelRight, Rows3 } from 'lucide-react';
import { useState } from 'react';
import type { SponsorAd } from '@/lib/ads';
import {
  PlacementContextPreview,
  type PlacementFrameType,
} from './PlacementContextPreview';

interface FormatDef {
  id: PlacementFrameType;
  icon: typeof LayoutGrid;
  tabLabel: string;
  title: string;
  description: string;
  previewAd: Partial<SponsorAd>;
}

const FORMATS: FormatDef[] = [
  {
    id: 'directory_inline',
    icon: LayoutGrid,
    tabLabel: 'Directory Card',
    title: 'Directory Native Card',
    description:
      'Inlined seamlessly inside directory search and browse views every ~12 listings.',
    previewAd: {
      title: 'Example AI Cloud',
      description:
        'Deploy serverless LLM backends and MCP tools in under 60 seconds.',
      ctaText: 'Start Free',
      targetUrl: 'https://example.com',
      logoUrl:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
    },
  },
  {
    id: 'detail_sidebar',
    icon: PanelRight,
    tabLabel: 'Detail Sidebar',
    title: 'Listing Detail Sidebar',
    description:
      'Dedicated placement alongside install guides, JSON configs, and tool inspectors.',
    previewAd: {
      title: 'Example VectorDB',
      description: 'Lightning-fast vector search for agents and MCP tools.',
      ctaText: 'Try It Free',
      targetUrl: 'https://example.com',
      logoUrl:
        'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=100&auto=format&fit=crop&q=80',
    },
  },
  {
    id: 'header_banner',
    icon: Rows3,
    tabLabel: 'Category Banner',
    title: 'Category Header Banner',
    description:
      'Top-of-page spotlight above category directories like Developer Tools, Cloud Platforms, and Databases.',
    previewAd: {
      title: 'Example Agent Suite',
      description:
        'Build, monitor, and deploy complex multi-agent workflows with automated evaluation.',
      ctaText: 'Explore Platform',
      targetUrl: 'https://example.com',
      logoUrl:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
    },
  },
  {
    id: 'blog_guide',
    icon: FileText,
    tabLabel: 'Blog Banner',
    title: 'Blog & Guide In-Article Banner',
    description:
      'Embedded in long-form guides, client setups (Cursor, Claude, Windsurf), and technical tutorials.',
    previewAd: {
      title: 'Example AgentOps',
      description:
        'Full-stack observability and cost tracking for autonomous LLM agents.',
      ctaText: 'Explore Docs',
      targetUrl: 'https://example.com',
      logoUrl:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
    },
  },
];

export function PlacementShowcase() {
  const [activeId, setActiveId] = useState<PlacementFrameType>(FORMATS[0].id);
  const active = FORMATS.find((f) => f.id === activeId) ?? FORMATS[0];

  return (
    <div>
      <div
        className="directory-segmented"
        style={{
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          width: 'fit-content',
          flexWrap: 'wrap',
        }}
        role="tablist"
        aria-label="Ad placement formats"
      >
        {FORMATS.map((format) => {
          const Icon = format.icon;
          const isActive = format.id === activeId;
          return (
            <button
              key={format.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`directory-segmented-btn ${isActive ? 'is-active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={() => setActiveId(format.id)}
            >
              <Icon size={14} /> {format.tabLabel}
            </button>
          );
        })}
      </div>

      <div
        className="surface"
        style={{
          borderRadius: '16px',
          padding: '1.75rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '1.15rem',
              fontWeight: 700,
              lineHeight: 1.25,
            }}
          >
            {active.title}
          </h3>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              margin: '0.35rem 0 0',
              lineHeight: 1.45,
            }}
          >
            {active.description}
          </p>
        </div>
        <PlacementContextPreview
          placement={active.id}
          previewAd={active.previewAd}
        />
      </div>
    </div>
  );
}
