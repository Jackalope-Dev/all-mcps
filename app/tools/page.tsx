import { ArrowRight, Dices } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type React from 'react';
import { serializeJsonLd } from '@/lib/jsonLd';
import { TOOL_CATALOG, TOOL_GROUPS } from '../../components/tools/toolCatalog';

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
        numberOfItems: TOOL_CATALOG.length,
        itemListElement: TOOL_CATALOG.map((tool, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://allmcps.com${tool.href}`,
          name: tool.name,
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
    <main className="tl-page tl-hub">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="tl-container">
        <header className="tl-hub-head animate-in">
          <h1 className="tl-hub-title">Free MCP developer tools</h1>
          <p className="tl-hub-lead">
            Browser-based utilities for building, inspecting, validating, and
            optimizing Model Context Protocol (MCP) servers and client
            configurations. Free, no sign-in, and the config tools never send
            your JSON anywhere.
          </p>
        </header>

        {TOOL_GROUPS.map((group, gi) => {
          const tools = TOOL_CATALOG.filter((t) => t.group === group.id);
          return (
            <section
              key={group.id}
              className={`tl-hub-group animate-in hue-${group.hue}`}
              style={{ '--i': gi + 1 } as React.CSSProperties}
              aria-labelledby={`tl-group-${group.id}`}
            >
              <div className="tl-hub-group-head">
                <h2 id={`tl-group-${group.id}`} className="tl-hub-group-title">
                  <span className="tl-hub-group-dot" aria-hidden="true" />
                  {group.label}
                </h2>
                <p className="tl-hub-group-desc">{group.description}</p>
              </div>
              <ul className="tl-hub-grid">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <li key={tool.href}>
                      <Link href={tool.href} className="tl-card spotlight">
                        <span className="tl-card-icon" aria-hidden="true">
                          <Icon size={20} strokeWidth={1.75} />
                        </span>
                        <span className="tl-card-name">{tool.name}</span>
                        <span className="tl-card-blurb">{tool.blurb}</span>
                        <span className="tl-card-foot">
                          <span>Free · no sign-in</span>
                          <ArrowRight
                            size={15}
                            className="tl-card-arrow"
                            aria-hidden="true"
                          />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <aside className="tl-hub-lucky">
          <span
            className="tl-hub-lucky-icon tint-tile hue-pink"
            aria-hidden="true"
          >
            <Dices size={18} strokeWidth={1.75} />
          </span>
          <p>
            <strong>Not sure where to start?</strong> Spin up a random server
            from the directory and see what MCP can do.
          </p>
          <Link href="/lucky" className="btn btn-secondary btn-sm">
            I&apos;m feeling lucky
          </Link>
        </aside>
      </div>
    </main>
  );
}
