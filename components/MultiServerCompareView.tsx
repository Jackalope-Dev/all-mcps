'use client';

import {
  ArrowRight,
  BadgeCheck,
  ExternalLink,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { type CSSProperties, type ReactNode, useMemo, useState } from 'react';
import { CompareSelector } from '@/components/CompareSelector';
import { CopyBlock } from '@/components/ui/CopyBlock';
import { ServerAvatar } from '@/components/ui/ServerAvatar';
import {
  categoryHueClass,
  categorySlug,
  getCategoryMeta,
} from '@/lib/categories';
import type { ComparePickServer } from '@/lib/comparePick';
import { parseServerName } from '@/lib/displayName';
import { isVerifiedListing } from '@/lib/featuredStatus';
import {
  formatCommitAge,
  formatCompactNumber,
  publicViewCount,
} from '@/lib/format';
import {
  isUnverifiedInstall,
  resolveInstallConfig,
  runtimeLabel,
  transportLabel,
} from '@/lib/installConfig';
import { statusHueClass } from '@/lib/palette';
import { computeQualityScore, tierColor } from '@/lib/qualityScore';
import {
  AUTH_TYPE_LABELS,
  type AuthType,
  MAINTENANCE_STATUS_LABELS,
  type MaintenanceStatus,
  PRICING_MODEL_LABELS,
  type PricingModel,
} from '@/lib/serverEnums';
import type { Server } from '@/lib/servers';

interface MultiServerCompareViewProps {
  servers: Server[];
  /** Pool for the inline "change servers" picker. */
  pickerServers?: ComparePickServer[];
}

type Cell = { node: ReactNode; key: string; num?: number | null };
type Row = { label: string; cells: Cell[]; best?: 'max' };
type Group = { title: string; rows: Row[] };

const DASH = '—';

function text(value: string | null | undefined): Cell {
  const v = value?.trim() || '';
  return {
    node: v || <span className="cmp-na">{DASH}</span>,
    key: v.toLowerCase(),
  };
}

function num(value: number | null | undefined, suffix = ''): Cell {
  if (typeof value !== 'number') return { ...text(null), num: null };
  return {
    node: (
      <span className="tabular">
        {formatCompactNumber(value)}
        {suffix}
      </span>
    ),
    key: String(value),
    num: value,
  };
}

function comparePathFor(ids: string[]): string {
  if (ids.length === 2) {
    const [a, b] = ids;
    const [c0, c1] = a < b ? [a, b] : [b, a];
    return `/mcp/${c0}/vs/${c1}`;
  }
  return `/compare/${ids.join('-vs-')}`;
}

/**
 * /compare/[slugs]: one side-by-side table (sticky server header row, grouped
 * spec rows, differing rows marked and filterable), then a combined config
 * that only includes servers with a confirmed install command.
 */
export function MultiServerCompareView({
  servers,
  pickerServers,
}: MultiServerCompareViewProps) {
  const [onlyDiff, setOnlyDiff] = useState(false);
  const ids = servers.map((s) => s.id);

  const enriched = useMemo(
    () =>
      servers.map((s) => {
        const install = resolveInstallConfig({
          id: s.id,
          name: s.name,
          url: s.url,
          description: s.description,
          remoteEndpointUrl: s.remoteEndpointUrl,
          installKind: s.installKind,
          installCommand: s.installCommand,
          installArgs: s.installArgs,
          installPackage: s.installPackage,
          installConfidence: s.installConfidence,
          suggestedInstallCommand: s.suggestedInstallCommand,
          suggestedInstallArgs: s.suggestedInstallArgs,
        });
        return {
          server: s,
          displayName: parseServerName(s.name, s.url).displayName,
          quality: computeQualityScore(s),
          install,
          confirmed: !isUnverifiedInstall(install),
          tools: (s.tools ?? []).map((t) => t.name).filter(Boolean),
          key: s.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        };
      }),
    [servers],
  );

  const sharedTools = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of enriched)
      for (const t of new Set(e.tools)) counts.set(t, (counts.get(t) ?? 0) + 1);
    return new Set([...counts].filter(([, c]) => c > 1).map(([name]) => name));
  }, [enriched]);

  const groups = useMemo<Group[]>(() => {
    const health = (s: Server) =>
      s.isVerifiedActive
        ? { label: 'Healthy', tone: statusHueClass('ok') }
        : s.healthStatus === 'down' || s.healthStatus === 'unhealthy'
          ? { label: 'Issues detected', tone: statusHueClass('bad') }
          : { label: 'Not checked yet', tone: '' };
    return [
      {
        title: 'Trust',
        rows: [
          {
            label: 'Quality signal',
            best: 'max',
            cells: enriched.map((e) => ({
              node: (
                <span className="cmp-quality">
                  <span
                    className="cmp-quality-score tabular"
                    style={{ color: tierColor(e.quality.tier) }}
                  >
                    {e.quality.score}
                  </span>
                  <span className="cmp-muted">{e.quality.tier}</span>
                </span>
              ),
              key: String(e.quality.score),
              num: e.quality.score,
            })),
          },
          {
            label: 'Verified owner',
            cells: enriched.map((e) => {
              const v = isVerifiedListing(e.server) && !!e.server.isOfficial;
              return {
                node: v ? (
                  <span className="cmp-yes">
                    <BadgeCheck size={14} aria-hidden="true" /> Verified
                  </span>
                ) : (
                  <span className="cmp-muted">Not claimed</span>
                ),
                key: String(v),
              };
            }),
          },
          {
            label: 'Health',
            cells: enriched.map((e) => {
              const h = health(e.server);
              return {
                node: (
                  <span className={`cmp-status ${h.tone}`}>
                    <span className="lst-cat-dot" aria-hidden="true" />
                    {h.label}
                  </span>
                ),
                key: h.label.toLowerCase(),
              };
            }),
          },
        ],
      },
      {
        title: 'Install',
        rows: [
          {
            label: 'Install command',
            cells: enriched.map((e) => ({
              node: e.confirmed ? (
                <span className="cmp-yes">Confirmed</span>
              ) : (
                <span className="cmp-muted">Not confirmed yet</span>
              ),
              key: String(e.confirmed),
            })),
          },
          {
            label: 'Transport',
            cells: enriched.map((e) => text(transportLabel(e.install))),
          },
          {
            label: 'Runtime',
            cells: enriched.map((e) => text(runtimeLabel(e.install))),
          },
          {
            label: 'Auth',
            cells: enriched.map((e) =>
              text(
                e.server.authType
                  ? AUTH_TYPE_LABELS[e.server.authType as AuthType] ||
                      e.server.authType
                  : null,
              ),
            ),
          },
          {
            label: 'Pricing',
            cells: enriched.map((e) =>
              text(
                e.server.pricingModel
                  ? PRICING_MODEL_LABELS[
                      e.server.pricingModel as PricingModel
                    ] || e.server.pricingModel
                  : null,
              ),
            ),
          },
          {
            label: 'License',
            cells: enriched.map((e) => text(e.server.license)),
          },
        ],
      },
      {
        title: 'Adoption',
        rows: [
          {
            label: 'GitHub stars',
            best: 'max',
            cells: enriched.map((e) => num(e.server.githubStars)),
          },
          {
            label: 'npm downloads',
            best: 'max',
            cells: enriched.map((e) => num(e.server.npmDownloads, '/mo')),
          },
          {
            label: 'Last commit',
            cells: enriched.map((e) =>
              text(formatCommitAge(e.server.lastCommitAt)),
            ),
          },
          {
            label: 'Maintenance',
            cells: enriched.map((e) =>
              text(
                e.server.maintenanceStatus
                  ? MAINTENANCE_STATUS_LABELS[
                      e.server.maintenanceStatus as MaintenanceStatus
                    ] || e.server.maintenanceStatus
                  : null,
              ),
            ),
          },
          {
            label: 'Upvotes',
            best: 'max',
            cells: enriched.map((e) => num(e.server.upvotes ?? 0)),
          },
          {
            label: 'Views',
            best: 'max',
            cells: enriched.map((e) => num(publicViewCount(e.server))),
          },
        ],
      },
      {
        title: 'Capabilities',
        rows: [
          {
            label: 'Category',
            cells: enriched.map((e) => {
              const meta = getCategoryMeta(e.server.category);
              return {
                node: (
                  <Link
                    href={`/categories/${categorySlug(e.server.category)}`}
                    className={`tint-pill cmp-cat ${categoryHueClass(e.server.category)}`}
                  >
                    <span aria-hidden="true">{meta.emoji}</span> {meta.label}
                  </Link>
                ),
                key: meta.label,
              };
            }),
          },
          {
            label: 'Tools',
            best: 'max',
            cells: enriched.map((e) =>
              e.tools.length > 0
                ? { ...num(e.tools.length), key: String(e.tools.length) }
                : { ...text(null), num: null },
            ),
          },
          {
            label: 'Tool names',
            cells: enriched.map((e) => ({
              node:
                e.tools.length > 0 ? (
                  <span className="cmp-tools">
                    {e.tools.slice(0, 12).map((t) => (
                      <code
                        key={t}
                        className={sharedTools.has(t) ? 'is-shared' : undefined}
                        title={
                          sharedTools.has(t)
                            ? 'Also offered by another server here'
                            : undefined
                        }
                      >
                        {t}
                      </code>
                    ))}
                    {e.tools.length > 12 && (
                      <span className="cmp-muted">
                        +{e.tools.length - 12} more
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="cmp-muted">Not introspected yet</span>
                ),
              key: e.tools.slice().sort().join(','),
            })),
          },
        ],
      },
    ];
  }, [enriched, sharedTools]);

  const confirmed = enriched.filter((e) => e.confirmed);
  const combinedConfig = useMemo(() => {
    const mcpServers: Record<string, unknown> = {};
    for (const { key, install, server } of confirmed) {
      const env =
        server.aiEnvVars && server.aiEnvVars.length > 0
          ? Object.fromEntries(
              server.aiEnvVars.map((v) => [v, `YOUR_${v}_HERE`]),
            )
          : null;
      mcpServers[key] =
        install.kind === 'remote'
          ? { url: install.url }
          : {
              command: install.command,
              args: install.args,
              ...(env ? { env } : {}),
            };
    }
    return JSON.stringify({ mcpServers }, null, 2);
  }, [confirmed]);

  const cols = { '--cmp-cols': enriched.length } as CSSProperties;

  return (
    <div className="cmp-view">
      <nav aria-label="Breadcrumb">
        <ol className="crumbs">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/compare">Compare</Link>
          </li>
          <li aria-current="page">{enriched.length} servers</li>
        </ol>
      </nav>

      <header className="cmp-head">
        <h1 className="text-page-title">
          {enriched.map((e) => e.displayName).join(' vs ')}
        </h1>
        <p className="text-lead">
          {enriched.length} MCP servers side by side — trust, install, adoption
          and tools. Rows that differ are marked.
        </p>
      </header>

      <div className="cmp-controls">
        <button
          type="button"
          className="chip"
          aria-pressed={onlyDiff}
          onClick={() => setOnlyDiff((v) => !v)}
        >
          <SlidersHorizontal size={13} aria-hidden="true" />
          Only show differences
        </button>
        {pickerServers && (
          <details className="cmp-change">
            <summary className="btn btn-secondary btn-sm">
              Change servers
            </summary>
            <div className="cmp-change-body">
              <CompareSelector servers={pickerServers} initialIds={ids} />
            </div>
          </details>
        )}
      </div>

      <div className="cmp-table-wrap">
        <table className="cmp-table" style={cols}>
          <thead>
            <tr className="cmp-row cmp-row--head">
              <th className="cmp-label" scope="col">
                <span className="sr-only">Spec</span>
              </th>
              {enriched.map((e) => (
                <th key={e.server.id} className="cmp-col-head" scope="col">
                  <Link href={`/mcp/${e.server.id}`} className="cmp-col-id">
                    <ServerAvatar
                      name={e.server.name}
                      logoUrl={e.server.logoUrl}
                      category={e.server.category}
                      size={32}
                    />
                    <span className="cmp-col-name">{e.displayName}</span>
                  </Link>
                  {enriched.length > 2 && (
                    <Link
                      href={comparePathFor(
                        ids.filter((i) => i !== e.server.id),
                      )}
                      className="lst-icon-btn cmp-col-x"
                      aria-label={`Remove ${e.displayName} from comparison`}
                      title="Remove from comparison"
                    >
                      <X size={14} aria-hidden="true" />
                    </Link>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {groups.map((g) => {
            const rows = g.rows.map((r) => {
              const keys = r.cells.map((c) => c.key);
              const differs = new Set(keys).size > 1;
              let bestIdx = -1;
              if (r.best === 'max' && differs) {
                const nums = r.cells.map((c) => c.num ?? -1);
                const max = Math.max(...nums);
                if (max > 0 && nums.filter((n) => n === max).length === 1)
                  bestIdx = nums.indexOf(max);
              }
              return { ...r, differs, bestIdx };
            });
            const visible = onlyDiff ? rows.filter((r) => r.differs) : rows;
            if (visible.length === 0) return null;
            return (
              <tbody key={g.title} className="cmp-group">
                <tr className="cmp-group-title">
                  <th scope="colgroup" colSpan={enriched.length + 1}>
                    {g.title}
                  </th>
                </tr>
                {visible.map((r) => (
                  <tr
                    key={r.label}
                    className={`cmp-row${r.differs ? ' is-diff' : ''}`}
                  >
                    <th className="cmp-label" scope="row">
                      {r.label}
                    </th>
                    {r.cells.map((c, i) => (
                      <td
                        key={enriched[i].server.id}
                        className={`cmp-cell${i === r.bestIdx ? ' is-best' : ''}`}
                      >
                        {c.node}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            );
          })}

          <tbody>
            <tr className="cmp-row cmp-row--links">
              <th className="cmp-label" scope="row">
                Links
              </th>
              {enriched.map((e) => (
                <td key={e.server.id} className="cmp-cell">
                  <Link href={`/mcp/${e.server.id}`} className="link-arrow">
                    Listing <ArrowRight size={13} />
                  </Link>
                  {e.server.url && (
                    <a
                      href={e.server.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="link-arrow cmp-ext"
                    >
                      Source <ExternalLink size={12} />
                    </a>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <section className="cmp-config" aria-labelledby="cmp-config-h">
        <h2 id="cmp-config-h" className="lst-subhead">
          Install them together
        </h2>
        <p className="lst-muted-sm">
          One <code>mcpServers</code> block for Claude Desktop, Cursor, Windsurf
          or Cline. Only servers with a confirmed install command are included.
        </p>
        {confirmed.length > 0 ? (
          <CopyBlock
            code={combinedConfig}
            title="mcpServers"
            language="json"
            snippetType="compare_combined"
          />
        ) : (
          <p className="cmp-config-empty">
            None of these servers has a confirmed install command yet, so
            there&rsquo;s nothing we can safely combine. Each listing links to
            the project&rsquo;s own setup steps.
          </p>
        )}
        {confirmed.length > 0 && confirmed.length < enriched.length && (
          <p className="lst-muted-sm">
            Left out (no confirmed command):{' '}
            {enriched
              .filter((e) => !e.confirmed)
              .map((e) => e.displayName)
              .join(', ')}
            .
          </p>
        )}
      </section>
    </div>
  );
}
