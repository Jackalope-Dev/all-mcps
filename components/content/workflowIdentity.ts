import {
  BarChart3,
  BookOpen,
  Boxes,
  Bug,
  ClipboardList,
  Code2,
  Container,
  CreditCard,
  Database,
  DatabaseZap,
  FlaskConical,
  Gauge,
  GitPullRequest,
  Globe,
  Layers,
  type LucideIcon,
  Megaphone,
  PenTool,
  ScrollText,
  SearchCheck,
  ShieldCheck,
  Siren,
  Sparkles,
  Telescope,
  TrendingUp,
  Workflow,
  Wrench,
} from 'lucide-react';
import type { Hue } from '../../lib/palette';

/**
 * Icon + hue for each agent workflow in lib/prompts.ts. One place, so the
 * /prompts hub card, the featured card and the detail header always agree.
 * Every workflow gets its own glyph; hues repeat across the library but are
 * spread so neighbouring cards in the same category differ.
 */
const WORKFLOW_IDENTITY: Record<string, { icon: LucideIcon; hue: Hue }> = {
  'fullstack-developer': { icon: Code2, hue: 'blue' },
  'github-pr-review': { icon: GitPullRequest, hue: 'indigo' },
  'sentry-error-triage': { icon: Bug, hue: 'red' },
  'ci-failure-debugger': { icon: Wrench, hue: 'amber' },
  'security-code-review': { icon: ShieldCheck, hue: 'green' },
  'playwright-e2e-testing': { icon: FlaskConical, hue: 'teal' },
  'figma-to-code': { icon: PenTool, hue: 'pink' },
  'web-performance-audit': { icon: Gauge, hue: 'orange' },
  'supabase-schema-migrations': { icon: DatabaseZap, hue: 'green' },
  'postgres-performance-tuning': { icon: Database, hue: 'blue' },
  'dbt-pipeline-debugger': { icon: Workflow, hue: 'orange' },
  'product-analytics-report': { icon: TrendingUp, hue: 'violet' },
  'incident-response': { icon: Siren, hue: 'red' },
  'kubernetes-troubleshooter': { icon: Boxes, hue: 'blue' },
  'terraform-plan-review': { icon: Layers, hue: 'violet' },
  'market-research': { icon: Globe, hue: 'teal' },
  'team-knowledge-qa': { icon: BookOpen, hue: 'amber' },
  'technical-seo-audit': { icon: SearchCheck, hue: 'green' },
  'seo-content-refresh': { icon: ScrollText, hue: 'cyan' },
  'release-notes-writer': { icon: Megaphone, hue: 'indigo' },
  'stripe-revenue-report': { icon: CreditCard, hue: 'cyan' },
  'research-agent': { icon: Telescope, hue: 'violet' },
  'devops-engineer': { icon: Container, hue: 'orange' },
  'data-analyst': { icon: BarChart3, hue: 'teal' },
  'product-ops': { icon: ClipboardList, hue: 'pink' },
};

export function workflowIdentity(slug: string): {
  icon: LucideIcon;
  hue: Hue;
} {
  return WORKFLOW_IDENTITY[slug] ?? { icon: Sparkles, hue: 'indigo' };
}
