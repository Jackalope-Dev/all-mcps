import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Code2,
  FileJson,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type React from 'react';
import { PageHeader, PageShell } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Free MCP Developer Tools — Generators & Validators',
  description:
    'Free browser-based MCP tools: convert OpenAPI specs to server code, inspect JSON-RPC payloads, validate client configs, and calculate token overhead.',
  alternates: { canonical: 'https://allmcps.com/tools' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Free MCP Developer Tools — Generators & Validators | AllMCPs',
    description:
      'Free browser-based tools for Model Context Protocol: OpenAPI code generator, JSON-RPC protocol inspector, config validator, and token cost calculator.',
    url: 'https://allmcps.com/tools',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free MCP Developer Tools — Generators & Validators | AllMCPs',
    description:
      'Free browser-based tools for Model Context Protocol: OpenAPI code generator, JSON-RPC protocol inspector, config validator, and token cost calculator.',
  },
};

const TOOLS = [
  {
    href: '/stack',
    icon: FileJson,
    title: 'MCP Stack Builder',
    kicker: 'Stack Builder',
    bentoSize: 'hero' as const,
    accent: '#00e5ff',
    lightAccent: '#0284c7',
    description:
      'Select your favorite MCP tools and export a single unified claude_desktop_config.json or Cursor setup in seconds with interactive live previews.',
    actionLabel: 'Build Your Stack',
  },
  {
    href: '/compare',
    icon: ShieldCheck,
    title: 'Side-by-Side Server Comparison',
    kicker: 'Comparison',
    bentoSize: 'standard' as const,
    accent: '#c084fc',
    lightAccent: '#7e22ce',
    description:
      'Compare 2 to 4 MCP servers side-by-side on tool capabilities, installation requirements, GitHub stars, and security posture.',
    actionLabel: 'Compare Servers',
  },
  {
    href: '/tools/openapi-to-mcp',
    icon: Code2,
    title: 'OpenAPI to MCP Generator',
    kicker: 'Code Generator',
    bentoSize: 'standard' as const,
    accent: '#34d399',
    lightAccent: '#047857',
    description:
      'Convert OpenAPI 3.0/3.1 or Swagger specs into runnable TypeScript SDK or Python FastMCP server code automatically.',
    actionLabel: 'Generate Code',
  },
  {
    href: '/tools/protocol-inspector',
    icon: ShieldCheck,
    title: 'Protocol Inspector & Debugger',
    kicker: 'Protocol Debugger',
    bentoSize: 'wide' as const,
    accent: '#fbbf24',
    lightAccent: '#b45309',
    description:
      'Inspect raw JSON-RPC 2.0 payloads, validate schema compliance, catch protocol errors, and preview live AI client rendering.',
    actionLabel: 'Inspect Payloads',
  },
  {
    href: '/tools/config-generator',
    icon: FileJson,
    title: 'Config Generator',
    kicker: 'Configuration',
    bentoSize: 'standard' as const,
    accent: '#38bdf8',
    lightAccent: '#0369a1',
    description:
      'Build a ready-to-paste claude_desktop_config.json (or Cursor/VS Code/Windsurf equivalent) from directory servers or custom setups.',
    actionLabel: 'Generate Config',
  },
  {
    href: '/tools/config-auditor',
    icon: CheckCircle2,
    title: 'Config Auditor & Merger',
    kicker: 'Security & Audit',
    bentoSize: 'wide' as const,
    accent: '#fb7185',
    lightAccent: '#be123c',
    description:
      'Audit your MCP client JSON configs for unreplaced API key placeholders, syntax issues, and merge directory servers in 1 click.',
    actionLabel: 'Audit Configs',
  },
  {
    href: '/tools/playground',
    icon: ShieldCheck,
    title: 'Interactive MCP Playground',
    kicker: 'Live Testing',
    bentoSize: 'standard' as const,
    accent: '#818cf8',
    lightAccent: '#4338ca',
    description:
      'Test remote JSON-RPC 2.0 MCP endpoints in your browser — execute initialize, tools/list, and tools/call requests with live logging.',
    actionLabel: 'Open Playground',
  },
  {
    href: '/tools/config-validator',
    icon: CheckCircle2,
    title: 'Config Validator',
    kicker: 'Schema Validator',
    bentoSize: 'standard' as const,
    accent: '#2dd4bf',
    lightAccent: '#0f766e',
    description:
      'Paste your MCP config JSON and catch syntax errors, missing fields, and path issues before restarting your client.',
    actionLabel: 'Validate JSON',
  },
  {
    href: '/tools/token-calculator',
    icon: Calculator,
    title: 'Token Cost Calculator',
    kicker: 'Context Budget',
    bentoSize: 'standard' as const,
    accent: '#f472b6',
    lightAccent: '#db2777',
    description:
      "Estimate how much of your model's context window your installed MCP servers' tool schemas consume on every turn.",
    actionLabel: 'Calculate Overhead',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      name: 'Free MCP Developer Tools',
      description:
        'Browser-based utilities for building, inspecting, validating, and optimizing Model Context Protocol servers and client configurations.',
      url: 'https://allmcps.com/tools',
      isPartOf: {
        '@type': 'WebSite',
        name: 'AllMCPs',
        url: 'https://allmcps.com',
      },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: TOOLS.length,
        itemListElement: TOOLS.map((tool, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://allmcps.com${tool.href}`,
          name: tool.title,
        })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://allmcps.com',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Tools',
          item: 'https://allmcps.com/tools',
        },
      ],
    },
  ],
};

export default function ToolsHubPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageShell variant="default">
        <PageHeader
          title="Free MCP Developer Tools"
          description="Browser-based utilities for building, inspecting, validating, and optimizing Model Context Protocol (MCP) servers and client configurations. 100% private — nothing leaves your browser."
        />

        <div className="tools-bento-grid">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const bentoClass = `tool-bento-card--${tool.bentoSize}`;

            return (
              <Link
                key={tool.href}
                href={tool.href}
                className={`tool-bento-card surface grid-crosshair grid-crosshair-tl grid-crosshair-br ${bentoClass}`}
                style={
                  {
                    '--tool-accent': tool.accent,
                    '--tool-light-accent': tool.lightAccent,
                  } as React.CSSProperties
                }
              >
                <div>
                  <div className="tool-bento-header">
                    <div className="tool-bento-icon">
                      <Icon size={20} />
                    </div>
                    <div className="tool-bento-kicker">
                      <span className="tool-bento-dot" />
                      <span>{tool.kicker}</span>
                    </div>
                  </div>

                  <h2 className="tool-bento-title">{tool.title}</h2>
                  <p className="tool-bento-desc">{tool.description}</p>
                </div>

                <div className="tool-bento-footer">
                  <span className="tool-bento-cta">
                    <span>{tool.actionLabel}</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </PageShell>
    </>
  );
}
