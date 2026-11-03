import { describe, expect, it } from 'vitest';
import {
  acquisitionForLopebase,
  buildAcquisitionReport,
  type ConversionRow,
} from './conversions';

let nextId = 1;
const row = (over: Partial<ConversionRow>): ConversionRow => ({
  id: nextId++,
  kind: 'submission',
  serverId: null,
  adId: null,
  sku: null,
  amountCents: 0,
  channel: 'direct',
  refHost: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  landingPath: '/',
  firstSeenAt: null,
  heardFrom: null,
  stripeSessionId: null,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  ...over,
});

describe('buildAcquisitionReport', () => {
  const rows = [
    row({
      serverId: 'a',
      channel: 'github',
      refHost: 'github.com',
      landingPath: '/submit',
      heardFrom: 'github',
    }),
    row({
      kind: 'purchase',
      serverId: 'a',
      sku: 'featured_7d',
      amountCents: 4900,
      channel: 'github',
      refHost: 'github.com',
      landingPath: '/submit',
      heardFrom: 'github',
      createdAt: new Date('2026-11-02T00:00:00Z'),
    }),
    row({
      kind: 'ad_purchase',
      adId: 'ad1',
      sku: 'sponsor_ad',
      amountCents: 10000,
      channel: 'search',
      refHost: 'google.com',
      utmCampaign: 'launch',
      landingPath: '/advertise',
    }),
    row({ channel: 'unknown', landingPath: null }),
  ];
  const report = buildAcquisitionReport(rows, 30);

  it('totals submissions separately from paid orders and revenue', () => {
    expect(report.totals).toMatchObject({
      submissions: 2,
      purchases: 2,
      revenueCents: 14900,
    });
  });

  it('ranks buckets by revenue first', () => {
    expect(report.byChannel.map((b) => b.key)).toEqual([
      'search',
      'github',
      'unknown',
    ]);
    expect(report.byChannel[1]).toMatchObject({
      submissions: 1,
      purchases: 1,
      revenueCents: 4900,
    });
  });

  it('labels sources by UTM source, else referrer, else channel', () => {
    expect(report.bySource.map((b) => b.key)).toEqual([
      'google.com',
      'github.com',
      'unknown',
    ]);
  });

  it('only counts paid rows per product and skips missing campaigns', () => {
    expect(report.bySku.map((b) => b.key)).toEqual([
      'sponsor_ad',
      'featured_7d',
    ]);
    expect(report.byCampaign.map((b) => b.key)).toEqual(['launch']);
    expect(report.byLanding.find((b) => b.key === '(unknown)')).toBeTruthy();
  });

  it('lists recent conversions newest first', () => {
    expect(report.recent[0]).toMatchObject({
      kind: 'purchase',
      source: 'github.com',
      amountCents: 4900,
    });
  });
});

describe('acquisitionForLopebase', () => {
  it('emits the standard resource fields and 28d stats', () => {
    const result = acquisitionForLopebase([
      row({ channel: 'github', refHost: 'github.com', landingPath: '/submit' }),
      row({
        kind: 'purchase',
        amountCents: 4900,
        channel: 'github',
        refHost: 'github.com',
        landingPath: '/submit',
      }),
      row({ channel: 'direct', landingPath: '/' }),
    ]);
    expect(result.sources[0]).toEqual({
      id: 'github|github.com',
      channel: 'github',
      source: 'github.com',
      conversions: 2,
      paid_conversions: 1,
      revenue_usd: 49,
    });
    expect(result.landingPages.map((p) => p.path)).toEqual(['/submit', '/']);
    expect(result.stats).toEqual({
      conversions_28d: 3,
      paid_conversions_28d: 1,
      revenue_28d_usd: 49,
    });
  });
});
