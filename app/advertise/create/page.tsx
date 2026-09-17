import type { Metadata } from 'next';
import { PageHeader, PageShell } from '../../../components/PageShell';
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
        <PageHeader
          title="Sponsor Campaign Studio"
          description={
            <>
              Design your ad creative with real-time multi-format previews,
              customize your impression credit volume, and choose your CPM
              bidding priority.
            </>
          }
        />
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
