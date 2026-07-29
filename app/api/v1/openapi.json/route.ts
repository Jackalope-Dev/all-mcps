import { NextResponse } from 'next/server';

export async function GET() {
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'AllMCPs Directory API',
      description: 'Public API for querying Model Context Protocol (MCP) servers listed on AllMCPs. Designed for AI agents, LLM tool callers, and developer integrations.',
      version: '1.0.0',
      contact: {
        name: 'AllMCPs Team',
        url: 'https://allmcps.com/contact',
      },
    },
    servers: [
      {
        url: 'https://allmcps.com',
        description: 'Production Edge Server',
      },
    ],
    paths: {
      '/api/v1/search': {
        get: {
          summary: 'Search and filter MCP servers',
          description: 'Query active MCP servers by keyword or category with optional limit parameters.',
          operationId: 'searchServers',
          parameters: [
            {
              name: 'q',
              in: 'query',
              description: 'Keyword search query',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'category',
              in: 'query',
              description: 'Filter by category name (e.g. Developer Tools, Databases)',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'limit',
              in: 'query',
              description: 'Maximum results to return (1-100)',
              required: false,
              schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
            },
          ],
          responses: {
            '200': {
              description: 'Successful search results',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      query: { type: 'string', nullable: true },
                      category: { type: 'string', nullable: true },
                      servers: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            description: { type: 'string' },
                            category: { type: 'string' },
                            url: { type: 'string' },
                            isOfficial: { type: 'boolean' },
                            isVerifiedActive: { type: 'boolean' },
                            upvotes: { type: 'integer' },
                            installName: { type: 'string' },
                            detailUrl: { type: 'string' },
                            markdownUrl: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/mcp/{id}/markdown': {
        get: {
          summary: 'Get MCP server details as Markdown',
          description: 'Returns structured LLM-friendly Markdown documentation for an MCP server.',
          operationId: 'getServerMarkdown',
          parameters: [
            {
              name: 'id',
              in: 'path',
              description: 'Unique server ID (e.g. sqlite-mcp-server)',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Markdown document content',
              content: {
                'text/markdown': {
                  schema: { type: 'string' },
                },
              },
            },
            '404': {
              description: 'MCP server not found',
            },
          },
        },
      },
      '/api/badge/{id}': {
        get: {
          summary: 'Generate dynamic SVG badge',
          description: 'Returns dynamic SVG badge for README embeds with dark/light themes and directory/featured styles.',
          operationId: 'getBadgeSvg',
          parameters: [
            {
              name: 'id',
              in: 'path',
              description: 'Server ID',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'style',
              in: 'query',
              description: 'Badge style layout',
              required: false,
              schema: { type: 'string', enum: ['shield', 'flat-square', 'featured', 'directory'], default: 'shield' },
            },
            {
              name: 'metric',
              in: 'query',
              description: 'Displayed data metric',
              required: false,
              schema: { type: 'string', enum: ['status', 'upvotes', 'views', 'installs'], default: 'status' },
            },
            {
              name: 'theme',
              in: 'query',
              description: 'Color theme',
              required: false,
              schema: { type: 'string', enum: ['dark', 'light'], default: 'dark' },
            },
          ],
          responses: {
            '200': {
              description: 'SVG image content',
              content: {
                'image/svg+xml': {
                  schema: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
