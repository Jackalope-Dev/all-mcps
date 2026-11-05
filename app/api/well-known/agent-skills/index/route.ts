import { NextResponse } from 'next/server';

// sha256 is of the served SKILL.md bytes; route.test.ts fails if a file
// changes without its digest being updated here.
export async function GET() {
  const index = {
    $schema: 'https://agentskills.io/schema/v0.2.0/index.json',
    skills: [
      {
        name: 'mcp-search',
        type: 'search',
        description:
          'Search and discover MCP servers across categories, tech stacks, and capabilities',
        url: 'https://allmcps.com/.well-known/agent-skills/mcp-search/SKILL.md',
        sha256:
          '6a285a6e42ae7b628423602c98277953ad8e4e7943b3692156b390331ec7d90a',
      },
      {
        name: 'mcp-registry',
        type: 'registry',
        description:
          'Query details and configuration schemas for individual MCP servers',
        url: 'https://allmcps.com/.well-known/agent-skills/mcp-registry/SKILL.md',
        sha256:
          '5f3283c09f5cb6d9041dfe25d267f49de93cf6fb68ecefacf4fbb8c797c51fac',
      },
      {
        name: 'mcp-monetization',
        type: 'monetization',
        description:
          'Boost MCP server listings and buy sponsor ads, paying by Stripe checkout or autonomously over x402',
        url: 'https://allmcps.com/.well-known/agent-skills/mcp-monetization/SKILL.md',
        sha256:
          '165141d593b0ecc24235dcf6b4b41edc605b28575fc17be7613dcacec21c7505',
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
