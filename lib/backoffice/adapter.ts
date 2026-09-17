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

import type { AuditStore } from './kit/adapter';
import { bearerAuth, createAdminAdapter } from './kit/adapter';
import type { Capability } from './kit/contract';
import type { Repo } from './repo';

export const BACKOFFICE_BASE_PATH = '/api/backoffice';

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
