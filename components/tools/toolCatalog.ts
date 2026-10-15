import {
  Award,
  Braces,
  Calculator,
  Code2,
  FileCheck2,
  FileCog,
  GitCompareArrows,
  Layers,
  type LucideIcon,
  ScanSearch,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import type { Hue } from '../../lib/palette';

/**
 * Single source of truth for the developer tools: the /tools hub grid, its
 * ItemList JSON-LD, and the "Related tools" rail on every tool page all read
 * from here so names, blurbs, and grouping never drift apart.
 */
type ToolGroupId = 'configure' | 'test' | 'build';

interface ToolEntry {
  href: string;
  name: string;
  /** One line: what the tool does for you. */
  blurb: string;
  icon: LucideIcon;
  group: ToolGroupId;
}

export const TOOL_GROUPS: Array<{
  id: ToolGroupId;
  label: string;
  description: string;
  /** Identity hue shared by every tool in the group (hub, nav, tool pages). */
  hue: Hue;
}> = [
  {
    id: 'configure',
    hue: 'blue',
    label: 'Configure',
    description:
      'Pick servers and get a working client config without hand-editing JSON.',
  },
  {
    id: 'test',
    hue: 'violet',
    label: 'Test & debug',
    description:
      'Talk to a live server, inspect what it returns, and measure what it costs.',
  },
  {
    id: 'build',
    hue: 'orange',
    label: 'Build & ship',
    description:
      'Turn an existing API into an MCP server and promote it once it is listed.',
  },
];

export const TOOL_CATALOG: ToolEntry[] = [
  {
    href: '/stack',
    name: 'Stack Builder',
    blurb:
      'Combine several servers into one config for Claude, Cursor, Cline, or Windsurf.',
    icon: Layers,
    group: 'configure',
  },
  {
    href: '/tools/config-generator',
    name: 'Config Generator',
    blurb:
      'Build a ready-to-paste client config from directory servers or your own.',
    icon: FileCog,
    group: 'configure',
  },
  {
    href: '/tools/config-validator',
    name: 'Config Validator',
    blurb:
      'Catch syntax errors, missing fields, and path mistakes before you restart.',
    icon: FileCheck2,
    group: 'configure',
  },
  {
    href: '/tools/config-auditor',
    name: 'Config Auditor & Merger',
    blurb:
      'Find leftover API-key placeholders and merge directory servers in one click.',
    icon: ShieldCheck,
    group: 'configure',
  },
  {
    href: '/compare',
    name: 'Server Comparison',
    blurb:
      'Compare 2–4 servers side by side on tools, install, stars, and security.',
    icon: GitCompareArrows,
    group: 'configure',
  },
  {
    href: '/tools/playground',
    name: 'MCP Playground',
    blurb:
      'Send initialize, tools/list, and tools/call to a remote endpoint and read the reply.',
    icon: Terminal,
    group: 'test',
  },
  {
    href: '/tools/protocol-inspector',
    name: 'Protocol Inspector',
    blurb:
      'Connect to a live server or validate a JSON-RPC payload against the spec.',
    icon: ScanSearch,
    group: 'test',
  },
  {
    href: '/tools/token-calculator',
    name: 'Token Calculator',
    blurb:
      'See how much of your context window your servers’ tool schemas eat each turn.',
    icon: Calculator,
    group: 'test',
  },
  {
    href: '/tools/openapi-to-mcp',
    name: 'OpenAPI to MCP',
    blurb:
      'Generate a TypeScript or Python MCP server from an OpenAPI 3 or Swagger spec.',
    icon: Code2,
    group: 'build',
  },
  {
    href: '/badge-generator',
    name: 'Badge Generator',
    blurb:
      'Embed a live AllMCPs badge in your README that links back to your listing.',
    icon: Award,
    group: 'build',
  },
];

/** Icon for a tool page header, by href. Falls back to a neutral glyph. */
export function toolEntry(href: string): ToolEntry | undefined {
  return TOOL_CATALOG.find((t) => t.href === href);
}

/** The group hue for a tool, by href (cyan for anything outside the catalog). */
export function toolHue(href: string): Hue {
  const group = toolEntry(href)?.group;
  return TOOL_GROUPS.find((g) => g.id === group)?.hue ?? 'cyan';
}

export const FALLBACK_TOOL_ICON: LucideIcon = Braces;
