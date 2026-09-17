'use client';

import { useEffect } from 'react';
import { DIRECTORY_CATEGORIES } from '../lib/categories';
import {
  AUTH_TYPES,
  COMPATIBLE_CLIENT_SLUGS,
  MAINTENANCE_STATUSES,
  PRICING_MODELS,
  TAG_LIMITS,
} from '../lib/serverEnums';

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
        description:
          'Search the AllMCPs directory for MCP servers in real-time.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Search keywords or tech stack (e.g. postgres, github)',
            },
            category: { type: 'string', description: 'Category filter' },
            limit: {
              type: 'number',
              description: 'Max number of results to return (default: 10)',
            },
          },
        },
        execute: async ({
          query = '',
          category = '',
          limit = 10,
        }: {
          query?: string;
          category?: string;
          limit?: number;
        }) => {
          const res = await fetch(
            `/api/v1/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&limit=${limit}`,
          );
          return await res.json();
        },
      },
      {
        name: 'get_server_config',
        description:
          'Get Claude Desktop configuration snippet and details for an MCP server by ID.',
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
        description:
          'Get every category AllMCPs accepts, with the exact string to pass as "category" when submitting.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const res = await fetch('/api/v1/categories');
          return await res.json();
        },
      },
      {
        name: 'get_boost_pricing',
        description:
          'Get pricing, tiers, and features for boosting an MCP server.',
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
        description:
          'Initiate a server boost order, returning a checkout link and x402 invoice.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The unique server ID' },
            sku: {
              type: 'string',
              description:
                'Tier (featured_7d, category_sponsor_7d, premium_monthly, priority_review)',
            },
            email: { type: 'string', description: 'Optional email' },
          },
          required: ['id'],
        },
        execute: async ({
          id,
          sku = 'featured_7d',
          email,
        }: {
          id: string;
          sku?: string;
          email?: string;
        }) => {
          const res = await fetch('/api/v1/boost/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverId: id, sku, email }),
          });
          return await res.json();
        },
      },
      {
        name: 'submit_mcp_server',
        description:
          'Programmatically submit a new MCP server repository to AllMCPs.com for indexing. Fill in whichever optional enrichment fields you can confidently determine to produce a fully flushed-out listing; omit anything uncertain.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Server name' },
            url: { type: 'string', description: 'Repository URL' },
            description: { type: 'string', description: 'Server description' },
            category: {
              type: 'string',
              enum: DIRECTORY_CATEGORIES,
              description:
                'Best-matching category — must be one of the exact enum values',
            },
            email: { type: 'string', description: 'Submitter email' },
            websiteUrl: {
              type: 'string',
              description: 'Optional official website URL',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              maxItems: TAG_LIMITS.maxTags,
              description: `Up to ${TAG_LIMITS.maxTags} short lowercase keywords`,
            },
            pricingModel: {
              type: 'string',
              enum: [...PRICING_MODELS],
              description: 'How this server is priced',
            },
            pricingNotes: {
              type: 'string',
              description: 'Short free-text pricing detail',
            },
            authType: {
              type: 'string',
              enum: [...AUTH_TYPES],
              description: 'Authentication the server requires',
            },
            license: {
              type: 'string',
              description: 'SPDX license identifier, e.g. "MIT"',
            },
            compatibleClients: {
              type: 'array',
              items: { type: 'string', enum: [...COMPATIBLE_CLIENT_SLUGS] },
              description: 'MCP clients this server is confirmed to work with',
            },
            maintenanceStatus: {
              type: 'string',
              enum: [...MAINTENANCE_STATUSES],
              description: 'Repository maintenance status',
            },
            supportUrl: {
              type: 'string',
              description: 'Optional issues/discussions/docs URL',
            },
            suggestedInstallCommand: {
              type: 'string',
              description: 'Command to run the server, e.g. "npx"',
            },
            suggestedInstallArgs: {
              type: 'array',
              items: { type: 'string' },
              description: 'Args for the install command',
            },
          },
          required: ['name', 'url', 'email'],
        },
        execute: async (payload: Record<string, unknown>) => {
          const res = await fetch('/api/v1/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          return await res.json();
        },
      },
      {
        name: 'verify_mcp_claim',
        description:
          'Verify ownership and claim an MCP server listing by checking GitHub README badge, website badge, or DNS TXT record.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The server ID' },
            method: {
              type: 'string',
              description: 'Verification method (github, website_badge, dns)',
            },
            websiteUrl: { type: 'string', description: 'Optional website URL' },
          },
          required: ['id'],
        },
        execute: async (payload: {
          id: string;
          method?: string;
          websiteUrl?: string;
        }) => {
          const res = await fetch('/api/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          return await res.json();
        },
      },
    ];

    const nav = navigator as any;
    if (nav?.modelContext?.provideContext) {
      try {
        nav.modelContext.provideContext({ tools });
      } catch (err) {
        console.warn('WebMCP provideContext warning:', err);
      }
    }

    window.webMCP = {
      name: 'AllMCPs Web Client Provider',
      version: '1.4.0',
      tools,
    };

    window.dispatchEvent(
      new CustomEvent('webMCPReady', { detail: window.webMCP }),
    );
  }, []);

  return null;
}
