import {
  BarChart3,
  BookOpen,
  Boxes,
  Braces,
  Calculator,
  FileCheck2,
  GitCompare,
  GraduationCap,
  Layers,
  type LucideIcon,
  MonitorSmartphone,
  Newspaper,
  PlayCircle,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { Hue } from '../lib/palette';
import { guideTopicHue } from './content/guideCatalog';
import { toolHue } from './tools/toolCatalog';

export interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  /** Identity hue for the item's icon tile (tool group / guide topic). */
  hue?: Hue;
}

export interface NavGroup {
  id: string;
  label: string;
  /** Path prefixes that mark the group's trigger as active. */
  match: readonly string[];
  items: readonly NavItem[];
  /** Optional highlighted card at the bottom of the menu. */
  footer?: NavItem;
}

/** Top-level links shown directly in the header. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/browse', label: 'Browse' },
  { href: '/categories', label: 'Categories' },
  { href: '/best', label: 'Best of' },
  { href: '/stack', label: 'Stack builder' },
];

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'tools',
    label: 'Tools',
    match: ['/tools', '/compare', '/badge-generator', '/lucky'],
    items: [
      {
        href: '/tools/config-generator',
        label: 'Config generator',
        description: 'Build client JSON for any server',
        icon: Wand2,
        hue: toolHue('/tools/config-generator'),
      },
      {
        href: '/tools/config-validator',
        label: 'Config validator',
        description: 'Catch mistakes before you restart',
        icon: FileCheck2,
        hue: toolHue('/tools/config-validator'),
      },
      {
        href: '/tools/playground',
        label: 'Playground',
        description: 'Call a live MCP server from the browser',
        icon: PlayCircle,
        hue: toolHue('/tools/playground'),
      },
      {
        href: '/tools/protocol-inspector',
        label: 'Protocol inspector',
        description: 'Read tool schemas and JSON-RPC',
        icon: ScanSearch,
        hue: toolHue('/tools/protocol-inspector'),
      },
      {
        href: '/tools/token-calculator',
        label: 'Token calculator',
        description: 'Measure tool-definition context cost',
        icon: Calculator,
        hue: toolHue('/tools/token-calculator'),
      },
      {
        href: '/tools/openapi-to-mcp',
        label: 'OpenAPI → MCP',
        description: 'Turn an API spec into a server',
        icon: Braces,
        hue: toolHue('/tools/openapi-to-mcp'),
      },
      {
        href: '/compare',
        label: 'Compare servers',
        description: 'Side-by-side on the facts',
        icon: GitCompare,
        hue: toolHue('/compare'),
      },
    ],
    footer: {
      href: '/tools',
      label: 'All developer tools',
      description: 'Free, no sign-in required',
      icon: Boxes,
    },
  },
  {
    id: 'learn',
    label: 'Learn',
    match: [
      '/guides',
      '/guide',
      '/what-is-mcp',
      '/clients',
      '/mcp-for-',
      '/blog',
      '/prompts',
      '/state-of-mcp',
      '/build-mcp-server',
      '/deploy-mcp-server',
      '/mcp-security',
      '/docs',
    ],
    items: [
      {
        href: '/what-is-mcp',
        label: 'What is MCP?',
        description: 'The protocol in five minutes',
        icon: GraduationCap,
        hue: guideTopicHue('basics'),
      },
      {
        href: '/guides',
        label: 'Guides',
        description: 'Install, build, deploy, secure',
        icon: BookOpen,
        hue: 'indigo',
      },
      {
        href: '/clients',
        label: 'Client setup',
        description: 'Claude, Cursor, Windsurf, VS Code',
        icon: MonitorSmartphone,
        hue: guideTopicHue('setup'),
      },
      {
        href: '/mcp-security',
        label: 'Security',
        description: 'What to check before installing',
        icon: ShieldCheck,
        hue: guideTopicHue('security'),
      },
      {
        href: '/prompts',
        label: 'Agent prompts',
        description: 'Copy-paste prompts that use MCP',
        icon: Sparkles,
        hue: guideTopicHue('use-cases'),
      },
      {
        href: '/state-of-mcp',
        label: 'State of MCP',
        description: 'Live ecosystem stats',
        icon: BarChart3,
        hue: guideTopicHue('data'),
      },
      {
        href: '/blog',
        label: 'Blog',
        description: 'Releases, deep dives, roundups',
        icon: Newspaper,
        hue: 'amber',
      },
    ],
    footer: {
      href: '/build-mcp-server',
      label: 'Build your own server',
      description: 'From zero to listed in an afternoon',
      icon: Layers,
      hue: guideTopicHue('build'),
    },
  },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/browse') {
    return pathname === '/browse' || pathname.startsWith('/mcp/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isGroupActive(pathname: string, group: NavGroup): boolean {
  return group.match.some((prefix) =>
    prefix.endsWith('-')
      ? pathname.startsWith(prefix)
      : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
