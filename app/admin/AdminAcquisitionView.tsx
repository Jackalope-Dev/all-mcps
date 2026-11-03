'use client';

import {
  Compass,
  FileInput,
  Link2,
  type LucideIcon,
  Megaphone,
  MessageSquareQuote,
  Package,
  Receipt,
  Route,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { formatUsdAmount } from '@/lib/ads';
import { HEARD_FROM_OPTIONS } from '@/lib/attribution';
import type { AcquisitionBucket, AcquisitionReport } from '@/lib/conversions';
import { AdminCardHead, AdminSkeletonList } from './AdminUi';

const RANGES = [7, 30, 90, 365] as const;

const CHANNEL_LABELS: Record<string, string> = {
  paid: 'Paid ads',
  search: 'Search',
  ai: 'AI assistants',
  social: 'Social & communities',
  github: 'GitHub',
  directory: 'Other directories',
  email: 'Email',
  referral: 'Other websites',
  direct: 'Direct',
  unknown: 'Unknown (no consent / cookie)',
};

const HEARD_LABELS: Record<string, string> = Object.fromEntries(
  HEARD_FROM_OPTIONS.map((o) => [o.value, o.label]),
);

const KIND_LABELS: Record<string, string> = {
  submission: 'Submission',
  purchase: 'Listing upgrade',
  ad_purchase: 'Ad campaign',
};

function BucketTable({
  rows,
  label,
  format = (k) => k,
  empty,
  limit = 15,
}: {
  rows: AcquisitionBucket[];
  label: string;
  format?: (key: string) => string;
  empty: string;
  limit?: number;
}) {
  if (rows.length === 0) return <p className="adm-card-empty">{empty}</p>;
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th>{label}</th>
            <th>Submissions</th>
            <th>Paid</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r) => (
            <tr key={r.key}>
              <td>{format(r.key)}</td>
              <td className="adm-num">{r.submissions.toLocaleString()}</td>
              <td className="adm-num">{r.purchases.toLocaleString()}</td>
              <td className="adm-num adm-num--accent">
                {formatUsdAmount(r.revenueCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({
  icon,
  hue,
  title,
  sub,
  children,
}: {
  icon: LucideIcon;
  hue: string;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <div className="adm-card">
      <AdminCardHead icon={icon} hue={hue} title={title} />
      <p className="adm-card-sub">{sub}</p>
      {children}
    </div>
  );
}

/**
 * Where submissions and paying customers come from: channel, referrer / UTM
 * source, landing page, campaign and the self-reported submit-form answer.
 * Backed by the `conversions` table (lib/conversions.ts).
 */
export function AdminAcquisitionView() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<AcquisitionReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    fetch(`/api/admin/acquisition?days=${days}`)
      .then((res) =>
        res.ok
          ? (res.json() as Promise<AcquisitionReport>)
          : Promise.reject(res.status),
      )
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const totals = data?.totals;

  return (
    <div className="adm-stack">
      <div className="adm-chip-row scroll-x fade-x">
        {RANGES.map((d) => (
          <button
            key={d}
            type="button"
            className="chip"
            aria-pressed={days === d}
            onClick={() => setDays(d)}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {failed && (
        <p className="adm-card-empty">Acquisition data could not be loaded.</p>
      )}
      {!data && !failed && <AdminSkeletonList rows={4} />}

      {data && totals && (
        <>
          <ul className="adm-tiles">
            <li className="adm-tile">
              <div className="adm-tile-label">Submissions</div>
              <div className="adm-tile-value">
                {totals.submissions.toLocaleString()}
              </div>
            </li>
            <li className="adm-tile">
              <div className="adm-tile-label">Paid orders</div>
              <div className="adm-tile-value">
                {totals.purchases.toLocaleString()}
              </div>
            </li>
            <li className="adm-tile">
              <div className="adm-tile-label">Revenue</div>
              <div className="adm-tile-value">
                {formatUsdAmount(totals.revenueCents)}
              </div>
            </li>
            <li className="adm-tile">
              <div className="adm-tile-label">Avg order</div>
              <div className="adm-tile-value">
                {totals.purchases
                  ? formatUsdAmount(
                      Math.round(totals.revenueCents / totals.purchases),
                    )
                  : '-'}
              </div>
            </li>
          </ul>

          <Card
            icon={Compass}
            hue="hue-cyan"
            title="By channel"
            sub="Where the visitor arrived from before submitting or paying, grouped into channels."
          >
            <BucketTable
              rows={data.byChannel}
              label="Channel"
              format={(k) => CHANNEL_LABELS[k] ?? k}
              empty="No conversions recorded in this range yet."
            />
          </Card>

          <div className="adm-grid-2">
            <Card
              icon={Link2}
              hue="hue-green"
              title="Top sources"
              sub="UTM source, or the referring site when there is none."
            >
              <BucketTable
                rows={data.bySource}
                label="Source"
                format={(k) => CHANNEL_LABELS[k] ?? k}
                empty="No sources yet."
              />
            </Card>
            <Card
              icon={Route}
              hue="hue-blue"
              title="Landing pages"
              sub="The first page they saw: the pages worth improving or scaling."
            >
              <BucketTable
                rows={data.byLanding}
                label="Page"
                empty="No landing pages yet."
              />
            </Card>
          </div>

          <div className="adm-grid-2">
            <Card
              icon={MessageSquareQuote}
              hue="hue-amber"
              title="How did you hear about us?"
              sub="Self-reported on the submit form; purchases inherit their listing's answer."
            >
              <BucketTable
                rows={data.byHeardFrom}
                label="Answer"
                format={(k) => HEARD_LABELS[k] ?? k}
                empty="No answers yet."
              />
            </Card>
            <Card
              icon={Megaphone}
              hue="hue-orange"
              title="Campaigns"
              sub="utm_campaign on links you share or pay for."
            >
              <BucketTable
                rows={data.byCampaign}
                label="Campaign"
                empty="No tagged campaigns yet. Add ?utm_campaign=... to links you post."
              />
            </Card>
          </div>

          <Card
            icon={Package}
            hue="hue-blue"
            title="By product"
            sub="Which paid products sell, and for how much."
          >
            <BucketTable
              rows={data.bySku}
              label="Product"
              empty="No paid orders in this range yet."
            />
          </Card>

          <Card
            icon={Receipt}
            hue="hue-green"
            title="Recent conversions"
            sub="Newest first. Listing upgrades and ads show the amount Stripe charged at checkout."
          >
            {data.recent.length === 0 ? (
              <p className="adm-card-empty">Nothing yet in this range.</p>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th>Listing / ad</th>
                      <th>Amount</th>
                      <th>Channel</th>
                      <th>Source</th>
                      <th>Landing</th>
                      <th>Heard from</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((r) => (
                      <tr key={r.id}>
                        <td className="adm-num">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          {KIND_LABELS[r.kind] ?? r.kind}
                          {r.sku && r.kind === 'purchase' ? ` (${r.sku})` : ''}
                        </td>
                        <td>
                          {r.serverId ? (
                            <a
                              href={`/mcp/${r.serverId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="adm-row-link"
                            >
                              {r.serverId}
                            </a>
                          ) : r.adId ? (
                            <a
                              href={`/advertise/campaign/${r.adId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="adm-row-link"
                            >
                              Campaign
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="adm-num">
                          {r.amountCents ? formatUsdAmount(r.amountCents) : '-'}
                        </td>
                        <td>{CHANNEL_LABELS[r.channel] ?? r.channel}</td>
                        <td>{CHANNEL_LABELS[r.source] ?? r.source}</td>
                        <td>{r.landingPath ?? '-'}</td>
                        <td>
                          {r.heardFrom
                            ? (HEARD_LABELS[r.heardFrom] ?? r.heardFrom)
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <p className="adm-note">
            <FileInput size={14} aria-hidden="true" /> Tracking covers
            conversions from when this shipped onward. Visitors who decline
            analytics cookies show as Unknown unless they answered the submit
            form question. Subscription renewals aren&rsquo;t counted, only the
            first checkout.
          </p>
        </>
      )}
    </div>
  );
}
