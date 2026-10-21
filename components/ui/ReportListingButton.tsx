'use client';

import { Flag } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

// The form + Turnstile widget only matter after a click; load them on demand
// rather than in every listing page's bundle. Hover/focus warms the chunk.
const loadDialog = () => import('./ReportListingDialog');
const ReportListingDialog = dynamic(
  () => loadDialog().then((m) => m.ReportListingDialog),
  { ssr: false },
);

/**
 * Low-friction "something's wrong here" flag — no login required (the visitor
 * most motivated to report is usually mid-frustration with something broken),
 * Turnstile-gated. Never shown as a public count anywhere: reports are purely
 * an admin triage signal, not a public/negative badge on the listing.
 */
export function ReportListingButton({ serverId }: { serverId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        onPointerEnter={loadDialog}
        onFocus={loadDialog}
        className="lst-menu-item"
        title="Report a problem with this listing"
      >
        <Flag size={15} aria-hidden="true" />
        <span>Report a problem</span>
      </button>

      {isOpen && <ReportListingDialog serverId={serverId} onClose={close} />}
    </>
  );
}
