import { NextResponse } from 'next/server';

export async function GET() {
  const index = {
    $schema: 'https://agentskills.io/schema/v0.2.0/index.json',
    skills: [
      {
        name: 'mcp-search',
        type: 'search',
        description: 'Search and discover MCP servers across categories, tech stacks, and capabilities',
        url: 'https://allmcps.com/.well-known/agent-skills/mcp-search/SKILL.md',
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      },
      {
        name: 'mcp-registry',
        type: 'registry',
        description: 'Query details and configuration schemas for individual MCP servers',
        url: 'https://allmcps.com/.well-known/agent-skills/mcp-registry/SKILL.md',
        sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      },
    ],
  };

  return new NextResponse(JSON.stringify(index, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
