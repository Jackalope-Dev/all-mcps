'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    webMCP?: any;
  }
}

export function WebMCPProvider() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tools = [
      {
        name: 'search_servers',
        description: 'Search the AllMCPs directory for MCP servers in real-time.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keywords or tech stack (e.g. postgres, github)' },
            category: { type: 'string', description: 'Category filter' },
            limit: { type: 'number', description: 'Max number of results to return (default: 10)' },
          },
        },
        execute: async ({ query = '', category = '', limit = 10 }: { query?: string; category?: string; limit?: number }) => {
          const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&limit=${limit}`);
          return await res.json();
        },
      },
      {
        name: 'get_server_config',
        description: 'Get Claude Desktop configuration snippet and details for an MCP server by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The unique server identifier' },
          },
          required: ['id'],
        },
        execute: async ({ id }: { id: string }) => {
          const res = await fetch(`/api/v1/servers/${encodeURIComponent(id)}`);
          return await res.json();
        },
      },
      {
        name: 'list_categories',
        description: 'Get all active MCP server categories.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const res = await fetch('/api/v1/search?limit=100');
          const data = (await res.json()) as any;
          const categories = Array.from(new Set((data.servers || []).map((s: any) => s.category)));
          return { categories };
        },
      },
      {
        name: 'get_boost_pricing',
        description: 'Get pricing, tiers, and features for boosting an MCP server.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const res = await fetch('/api/v1/boost/pricing');
          return await res.json();
        },
      },
      {
        name: 'boost_mcp_server',
        description: 'Initiate a server boost order, returning a checkout link and x402 invoice.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The unique server ID' },
            sku: { type: 'string', description: 'Tier (featured_7d, premium_monthly, priority_review)' },
            email: { type: 'string', description: 'Optional email' },
          },
          required: ['id'],
        },
        execute: async ({ id, sku = 'featured_7d', email }: { id: string; sku?: string; email?: string }) => {
          const res = await fetch('/api/v1/boost/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverId: id, sku, email }),
          });
          return await res.json();
        },
      },
    ];

    // Standard WebMCP API (navigator.modelContext.provideContext)
    const nav = navigator as any;
    if (nav?.modelContext?.provideContext) {
      try {
        nav.modelContext.provideContext({ tools });
      } catch (err) {
        console.warn('WebMCP provideContext warning:', err);
      }
    }

    // Fallback/Legacy window object declaration
    window.webMCP = {
      name: 'AllMCPs Web Client Provider',
      version: '1.1.0',
      tools,
    };

    window.dispatchEvent(new CustomEvent('webMCPReady', { detail: window.webMCP }));
  }, []);

  return null;
}
