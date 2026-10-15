import type { Metadata } from 'next';
import { PageShell } from '../../../components/PageShell';
import { AdvertiseStudioClient } from './AdvertiseStudioClient';

export const metadata: Metadata = {
  title: 'Ad Creation Studio — Sponsor AllMCPs',
  description:
    'Create, preview, and launch your sponsored advertisement on AllMCPs with live multi-format preview and weighted CPM bidding.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdvertiseCreatePage({
  searchParams,
}: {
  searchParams: Promise<{
    tier?: string;
    placement?: string;
    canceled?: string;
    variant?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <PageShell variant="default">
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <header className="acct-page-head">
          <h1 className="text-page-title">Create a sponsor campaign</h1>
          <p className="text-lead">
            Write your ad, preview it in every placement, then pick your
            impression volume and delivery speed.
          </p>
        </header>
        <AdvertiseStudioClient
          initialTier={params.tier}
          initialPlacement={params.placement}
          initialVariant={params.variant}
          canceled={params.canceled === '1'}
        />
      </div>
    </PageShell>
  );
}
