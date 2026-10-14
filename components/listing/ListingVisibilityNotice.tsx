import { AlertTriangle, BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import {
  parseStaleReasons,
  STALE_REASON_LABEL,
  type StaleReason,
} from '@/lib/staleness';

/**
 * Why a listing that is reachable by URL is not in search, browse or the API.
 * Shown for flagged, pending and rejected listings; removed listings keep
 * their own "appears offline" banner on the detail page.
 */
export function ListingVisibilityNotice({
  serverId,
  status,
  staleFlaggedAt,
  staleReasons,
  isOfficial,
}: {
  serverId: string;
  status: string;
  staleFlaggedAt?: string | Date | null;
  staleReasons?: string | null;
  isOfficial?: boolean | null;
}) {
  let title: string;
  let body: string;
  let reasons: StaleReason[] = [];
  if (status === 'pending') {
    title = 'Awaiting review';
    body =
      'This listing was submitted recently and has not passed our checks yet, so it is not in search, browse or the API.';
  } else if (status === 'rejected') {
    title = 'Not listed';
    body =
      'This listing did not pass review, so it is not in search, browse or the API.';
  } else if (status === 'active' && staleFlaggedAt) {
    reasons = parseStaleReasons(staleReasons).filter(
      (r) => r in STALE_REASON_LABEL,
    );
    title = 'Hidden while we check this listing';
    body =
      'Our automated checks found a problem, so this listing is out of search, browse and the API until it clears. It comes back on its own once the problem is fixed.';
  } else {
    return null;
  }

  return (
    <div role="status" className="listing-visibility-notice surface">
      <AlertTriangle
        size={20}
        className="listing-visibility-notice-icon"
        aria-hidden="true"
      />
      <div style={{ minWidth: 0 }}>
        <p className="listing-visibility-notice-title">{title}</p>
        <p className="listing-visibility-notice-body">{body}</p>
        {reasons.length > 0 && (
          <ul className="listing-visibility-notice-reasons">
            {reasons.map((r) => (
              <li key={r}>{STALE_REASON_LABEL[r]}</li>
            ))}
          </ul>
        )}
        {!isOfficial && status !== 'rejected' && (
          <Link
            href={`/mcp/${serverId}/claim`}
            className="btn btn-secondary listing-visibility-notice-cta"
          >
            <BadgeCheck size={14} aria-hidden="true" /> Own this project? Claim
            it
          </Link>
        )}
      </div>
    </div>
  );
}
