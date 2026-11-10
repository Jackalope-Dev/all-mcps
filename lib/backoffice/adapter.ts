/**
 * AllMcps back-office adapter (ADR 0006, jackalope-digital-hub).
 *
 * Exposes a read-mostly slice of AllMcps to the Jackalope back office:
 *   - users    (read)
 *   - servers  (read)
 *   - reports  (read) + resolve_report action
 *
 * Mounted at /api/backoffice/* by app/api/backoffice/[[...path]]/route.ts.
 * Authenticated by a dedicated BACKOFFICE_ADMIN_TOKEN (separate from
 * ADMIN_SECRET / the NextAuth admin session — independently rotatable, minimal
 * blast radius). Every mutation writes an admin_audit row.
 */

import { OFFICIAL_SOURCES } from '../featuredStatus';
import type { AuditStore } from './kit/adapter';
import { bearerAuth, createAdminAdapter } from './kit/adapter';
import type { Capability } from './kit/contract';
import type { Repo } from './repo';

const BACKOFFICE_BASE_PATH = '/api/backoffice';

/** Capabilities the back-office service token holds against AllMcps. */
const TOKEN_CAPABILITIES: Capability[] = [
  'users.read',
  'system.read',
  'content.read',
  'content.review',
];

export interface BackofficeAdapterDeps {
  repo: Repo;
  audit: AuditStore;
  token: string;
}

export function createBackofficeAdapter({
  repo,
  audit,
  token,
}: BackofficeAdapterDeps) {
  return createAdminAdapter({
    connectorId: 'allmcps',
    basePath: BACKOFFICE_BASE_PATH,
    authenticate: bearerAuth({ token, capabilities: TOKEN_CAPABILITIES }),
    audit,

    async health() {
      return { ok: true, detail: 'allmcps' };
    },

    async overview() {
      const s = await repo.stats();
      const attentionItems: { title: string; severity: 'warn' }[] = [];
      if (s.openReports > 0) {
        attentionItems.push({
          title: `${s.openReports} open report${s.openReports === 1 ? '' : 's'}`,
          severity: 'warn',
        });
      }
      return {
        attentionItems,
        stats: {
          users: s.users,
          servers: s.servers,
          openReports: s.openReports,
        },
      };
    },

    resources: [
      {
        name: 'users',
        label: 'Users',
        readCapability: 'users.read',
        fields: [
          { name: 'id', label: 'ID', type: 'string', inList: true },
          { name: 'email', label: 'Email', type: 'string', inList: true },
          { name: 'name', label: 'Name', type: 'string', inList: true },
          { name: 'role', label: 'Role', type: 'string', inList: true },
          {
            name: 'emailVerified',
            label: 'Verified',
            type: 'date',
            inList: true,
          },
          { name: 'image', label: 'Image', type: 'string' },
        ],
        list: (q) =>
          repo.users.list({
            search: q.search,
            limit: q.limit ?? 25,
            filters: q.filters,
          }),
        get: (id) => repo.users.get(id),
      },
      {
        name: 'servers',
        label: 'Listings',
        readCapability: 'system.read',
        fields: [
          { name: 'id', label: 'ID', type: 'string', inList: true },
          { name: 'name', label: 'Name', type: 'string', inList: true },
          { name: 'category', label: 'Category', type: 'string', inList: true },
          {
            name: 'premiumStatus',
            label: 'Premium',
            type: 'string',
            inList: true,
          },
          {
            name: 'isOfficial',
            label: 'Official',
            type: 'boolean',
            inList: true,
          },
          {
            name: 'ownerVerified',
            label: 'Verified owner',
            type: 'boolean',
            inList: true,
          },
          { name: 'officialSource', label: 'Official source', type: 'string' },
          {
            name: 'officialEvidenceUrl',
            label: 'Official evidence',
            type: 'string',
          },
          {
            name: 'officialReviewedAt',
            label: 'Official reviewed',
            type: 'date',
          },
          { name: 'createdAt', label: 'Added', type: 'date', inList: true },
          { name: 'url', label: 'URL', type: 'string' },
          { name: 'description', label: 'Description', type: 'string' },
          { name: 'ownerUserId', label: 'Owner', type: 'string' },
        ],
        list: (q) =>
          repo.servers.list({
            search: q.search,
            limit: q.limit ?? 25,
            filters: q.filters,
          }),
        get: (id) => repo.servers.get(id),
      },
      {
        name: 'reports',
        label: 'Reports',
        readCapability: 'content.review',
        fields: [
          { name: 'id', label: 'ID', type: 'string', inList: true },
          { name: 'serverId', label: 'Listing', type: 'string', inList: true },
          { name: 'reason', label: 'Reason', type: 'string', inList: true },
          { name: 'status', label: 'Status', type: 'string', inList: true },
          { name: 'createdAt', label: 'Filed', type: 'date', inList: true },
          { name: 'details', label: 'Details', type: 'string' },
          { name: 'reviewedAt', label: 'Reviewed', type: 'date' },
        ],
        list: (q) =>
          repo.reports.list({
            search: q.search,
            limit: q.limit ?? 25,
            filters: q.filters,
          }),
        get: (id) => repo.reports.get(id),
      },
    ],

    actions: [
      {
        // Official = published by the company behind the product. A claim
        // never sets it (that is ownerVerified); granting needs evidence.
        name: 'set_official',
        label: 'Set Official (vendor-published)',
        capability: 'content.review',
        params: [
          {
            name: 'serverId',
            label: 'Listing',
            type: 'resourceRef',
            resource: 'servers',
            required: true,
          },
          {
            name: 'official',
            label: 'Official',
            type: 'boolean',
            required: true,
          },
          {
            name: 'source',
            label: 'Evidence type',
            type: 'enum',
            enumValues: [...OFFICIAL_SOURCES],
          },
          { name: 'evidenceUrl', label: 'Evidence URL', type: 'string' },
        ],
        async run(params) {
          const id = String(params.serverId);
          const before = await repo.servers.get(id);
          if (!before) throw new Error(`listing ${id} not found`);
          const official = params.official === true;
          const source = String(params.source ?? '');
          const evidenceUrl = String(params.evidenceUrl ?? '');
          if (official) {
            if (!(OFFICIAL_SOURCES as readonly string[]).includes(source))
              throw new Error(
                `source must be one of ${OFFICIAL_SOURCES.join(', ')}`,
              );
            if (!/^https?:\/\/\S+$/.test(evidenceUrl))
              throw new Error('evidenceUrl must be an http(s) URL');
          }
          const after = await repo.servers.setOfficial(
            id,
            official
              ? { official: true, source, evidenceUrl }
              : { official: false },
          );
          return {
            ok: true,
            summary: `listing ${id} → ${official ? `official (${source})` : 'not official'}`,
            audit: { targetType: 'server', targetId: id, before, after },
          };
        },
      },
      {
        name: 'resolve_report',
        label: 'Resolve report',
        capability: 'content.review',
        params: [
          {
            name: 'reportId',
            label: 'Report',
            type: 'resourceRef',
            resource: 'reports',
            required: true,
          },
          {
            name: 'status',
            label: 'Outcome',
            type: 'enum',
            enumValues: ['reviewed', 'dismissed'],
            required: true,
          },
        ],
        async run(params) {
          const id = String(params.reportId);
          const before = await repo.reports.get(id);
          const after = await repo.reports.setStatus(
            id,
            params.status === 'dismissed' ? 'dismissed' : 'reviewed',
          );
          return {
            ok: true,
            summary: `report ${id} → ${after.status}`,
            audit: { targetType: 'report', targetId: id, before, after },
          };
        },
      },
    ],
  });
}
