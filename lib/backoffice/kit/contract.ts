// Vendored from jackalope-digital-hub/packages/admin-adapter/src/contract.ts
// Source commit: ca08b44. Do not edit here — sync from source (jackalope-digital-hub).

/**
 * The ADR 0006 admin-adapter contract, as types.
 *
 * This package is meant to be consumed by property repos (all-mcps, resume-skip,
 * moxie-docs) with ZERO dependency on the hub. These types are therefore
 * redeclared here rather than imported from `apps/backoffice/src/engine`. They
 * must stay in sync with that file and with `docs/decisions/0006-admin-adapter-contract.md`.
 */

export type Capability =
  | 'users.read'
  | 'users.write'
  | 'content.read'
  | 'content.review'
  | 'content.publish'
  | 'email.read'
  | 'email.send'
  | 'billing.read'
  | 'billing.write'
  | 'system.read';

export interface FieldMeta {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'enum' | 'relation';
  enumValues?: string[];
  relation?: string;
  editable?: boolean;
  inList?: boolean;
  sensitiveUnless?: Capability;
}

export interface ParamSpec {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'resourceRef';
  required?: boolean;
  enumValues?: string[];
  resource?: string;
  help?: string;
}

export interface ResourceMeta {
  name: string;
  label: string;
  readCapability: Capability;
  writeCapability?: Capability;
  fields: FieldMeta[];
}

export interface ActionMeta {
  name: string;
  label: string;
  capability: Capability;
  destructive?: boolean;
  params: ParamSpec[];
}

export interface Query {
  filters?: Record<string, unknown>;
  search?: string;
  sort?: { field: string; dir: 'asc' | 'desc' }[];
  cursor?: string;
  limit?: number;
}

export interface Page<T> {
  rows: T[];
  nextCursor?: string;
  total?: number;
}

export interface AuditEvent {
  id: string;
  connectorId: string;
  actorId: string;
  requestId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

/** What an action returns. The adapter stamps id/actorId/requestId/createdAt on
 *  the `audit` fragment and persists it. */
export interface ActionResult {
  ok: boolean;
  summary: string;
  detail?: Record<string, unknown>;
  audit: Pick<AuditEvent, 'targetType' | 'targetId'> &
    Partial<Pick<AuditEvent, 'before' | 'after'>> & { action?: string };
}

export interface AttentionItem {
  title: string;
  detail?: string;
  href?: string;
  severity?: 'info' | 'warn' | 'critical';
}

export interface Overview {
  attentionItems: AttentionItem[];
  stats: Record<string, number | string>;
}

/** Resolved per request from the service token. */
export interface AdapterContext {
  actorId: string;
  requestId: string;
  capabilities: Capability[];
}
