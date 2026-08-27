/**
 * Single source of truth for the small fixed-choice fields submitters/owners can
 * set on a listing (pricing model, auth requirement, maintenance status) plus the
 * freeform-tag and compatible-clients normalizers. Used by both Zod validation
 * (submit/dashboard-edit routes) and form UI (SubmitForm, DashboardClient),
 * mirroring how DIRECTORY_CATEGORIES (lib/categories.ts) and MCP_CLIENTS
 * (lib/clients.ts) are the shared source for their respective fields.
 */
import { MCP_CLIENTS } from './clients';

export const PRICING_MODELS = ['free', 'freemium', 'paid', 'byok'] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];
export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  free: 'Free',
  freemium: 'Freemium',
  paid: 'Paid',
  byok: 'Bring your own API key (usage-based cost)',
};

export const AUTH_TYPES = ['none', 'api_key', 'oauth', 'other'] as const;
export type AuthType = (typeof AUTH_TYPES)[number];
export const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  none: 'No auth required',
  api_key: 'API key',
  oauth: 'OAuth',
  other: 'Other',
};

export const MAINTENANCE_STATUSES = [
  'active',
  'stable',
  'experimental',
  'archived',
] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];
export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  active: 'Actively maintained',
  stable: 'Stable',
  experimental: 'Experimental',
  archived: 'Archived',
};

export function isPricingModel(v: unknown): v is PricingModel {
  return (
    typeof v === 'string' && (PRICING_MODELS as readonly string[]).includes(v)
  );
}
export function isAuthType(v: unknown): v is AuthType {
  return typeof v === 'string' && (AUTH_TYPES as readonly string[]).includes(v);
}
export function isMaintenanceStatus(v: unknown): v is MaintenanceStatus {
  return (
    typeof v === 'string' &&
    (MAINTENANCE_STATUSES as readonly string[]).includes(v)
  );
}

export const TAG_LIMITS = { maxTags: 5, maxTagLength: 30 } as const;

/** Trim/lowercase/dedupe/cap freeform tags. Silently drops anything malformed rather than rejecting the submission. */
export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().toLowerCase().slice(0, TAG_LIMITS.maxTagLength);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= TAG_LIMITS.maxTags) break;
  }
  return out;
}

/** Client slugs a listing can claim compatibility with — reuses MCP_CLIENTS (lib/clients.ts) rather than a second list. */
export const COMPATIBLE_CLIENT_SLUGS = MCP_CLIENTS.map((c) => c.slug);

export function normalizeCompatibleClients(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const valid = new Set(COMPATIBLE_CLIENT_SLUGS);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const slug = raw.trim().toLowerCase();
    if (!valid.has(slug) || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}
