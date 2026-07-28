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

    window.webMCP = {
      name: 'AllMCPs Web Client Provider',
      version: '1.0.0',
      tools: [
        {
          name: 'search_servers',
          description: 'Search the AllMCPs directory for MCP servers in real-time.',
          execute: async ({ query = '', category = '', limit = 10 }: { query?: string; category?: string; limit?: number }) => {
            const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&limit=${limit}`);
            return await res.json();
          },
        },
        {
          name: 'get_server_config',
          description: 'Get Claude Desktop configuration snippet and details for an MCP server by ID.',
          execute: async ({ id }: { id: string }) => {
            const res = await fetch(`/api/v1/servers/${encodeURIComponent(id)}`);
            return await res.json();
          },
        },
        {
          name: 'list_categories',
          description: 'Get all active MCP server categories.',
          execute: async () => {
            const res = await fetch('/api/v1/search?limit=100');
            const data = (await res.json()) as any;
            const categories = Array.from(new Set((data.servers || []).map((s: any) => s.category)));
            return { categories };
          },
        },
      ],
    };

    window.dispatchEvent(new CustomEvent('webMCPReady', { detail: window.webMCP }));
  }, []);

  return null;
}
