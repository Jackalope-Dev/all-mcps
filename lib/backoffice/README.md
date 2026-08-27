# Back-office admin adapter

Exposes a **read-mostly** slice of AllMcps to the Jackalope Hub back office over
`GET/POST/PATCH /api/backoffice/*`. Contract: ADR 0006 in `jackalope-digital-hub`.

## What it exposes

| Resource | Access | Capability |
| --- | --- | --- |
| `users` | read | `users.read` |
| `servers` (listings) | read | `system.read` |
| `reports` | read | `content.review` |

| Action | Effect | Capability |
| --- | --- | --- |
| `resolve_report` | set a report's status to `reviewed` / `dismissed` (+ `reviewedAt`) | `content.review` |

Nothing here can create, delete, or edit users, listings, billing, or ads. Every
mutation writes an `admin_audit` row (migration `0047`).

## Safety properties

- **Fail-closed.** No `BACKOFFICE_ADMIN_TOKEN` set → the whole route 404s. A wrong
  token → 401. It is invisible and inert until deliberately configured.
- **Independent auth.** A dedicated token, not `ADMIN_SECRET` and not the NextAuth
  admin session. Rotate it without touching anything else.
- **Additive.** New route + new `admin_audit` table only. No change to existing
  routes, middleware, tables, or the existing `/api/admin/*` surface.
- The token's capability set (`lib/backoffice/adapter.ts` → `TOKEN_CAPABILITIES`)
  gates every endpoint; `x-actor-id` / `x-request-id` headers are for the audit
  trail only, never for authorization.

## Enabling it

1. Apply the migration: `npm run db:migrate:prod` (creates `admin_audit`).
2. Set the secret: `wrangler secret put BACKOFFICE_ADMIN_TOKEN` (use a long random
   value). For local dev, add `BACKOFFICE_ADMIN_TOKEN=...` to `.dev.vars`.
3. In `jackalope-digital-hub`, register the connector:
   ```ts
   // apps/backoffice/src/preset/connectors/allmcps.ts
   export const allmcps = httpConnector({
     id: "allmcps", label: "AllMcps",
     baseUrl: "https://allmcps.com/api/backoffice",
     token: process.env.ALLMCPS_ADMIN_TOKEN!,
   });
   ```

Until steps 1–2 are done, this code ships dormant and changes nothing.

## Files

| File | Purpose |
| --- | --- |
| `kit/` | Vendored from `jackalope-digital-hub/packages/admin-adapter/src`. **Do not edit** — re-sync from source. |
| `adapter.ts` | The AllMcps config: resources, actions, capabilities. |
| `repo.ts` | `Repo` interface + `drizzleRepo` (real D1 queries). Fake impl lives in the test. |
| `auditStore.ts` | `drizzleAuditStore` — writes/reads `admin_audit`. |
| `adapter.test.ts` | Runs the ADR 0006 conformance suite + AllMcps-specific checks against an in-memory repo. |
| `../../app/api/backoffice/[[...path]]/route.ts` | The mount. |
| `../../drizzle/0047_admin_audit.sql` | The table. |
