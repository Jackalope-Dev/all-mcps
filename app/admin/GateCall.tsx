import { Sparkles } from 'lucide-react';
import type { PendingRecommendation } from '../../lib/autoDecision';
import type { CalibrationNote } from '../../lib/gateCalibration';

export type GateCallData = PendingRecommendation & {
  calibration: CalibrationNote | null;
};

type Verdict = 'approve' | 'needs_review' | 'reject';

const VERDICT_STYLE: Record<Verdict, { label: string; hue: string }> = {
  approve: { label: 'Jev: approve', hue: 'hue-green' },
  needs_review: { label: 'Jev: look closer', hue: 'hue-amber' },
  reject: { label: 'Jev: reject', hue: 'hue-red' },
};

/**
 * The gate's call on a pending listing, read against the admin's own past
 * decisions. A hold the admin nearly always settles one way says so ("Your
 * call · leaning reject"), since one "Your call" label covered both a group
 * the admin rejected 92% of the time and groups approved ~80% of the time.
 */
function label(r: GateCallData): { text: string; hue: string } {
  if (r.decision === 'approve')
    return { text: 'Recommend: approve', hue: 'hue-green' };
  if (r.decision === 'reject')
    return { text: 'Recommend: reject', hue: 'hue-red' };
  if (r.calibration?.lean === 'approve')
    return { text: 'Your call · leaning approve', hue: 'hue-green' };
  if (r.calibration?.lean === 'reject')
    return { text: 'Your call · leaning reject', hue: 'hue-red' };
  return { text: 'Your call', hue: 'hue-amber' };
}

export function GateCall({
  recommendation,
  triageVerdict,
  triageReason,
}: {
  recommendation: GateCallData | null;
  triageVerdict: string | null;
  triageReason: string | null;
}) {
  const v =
    triageVerdict && triageVerdict in VERDICT_STYLE
      ? VERDICT_STYLE[triageVerdict as Verdict]
      : null;
  const l = recommendation ? label(recommendation) : null;
  return (
    <>
      {recommendation && l && (
        <div className="adm-verdict">
          <span className={`adm-tag ${l.hue}`}>{l.text}</span>
          <span className="adm-muted">
            {recommendation.reasons.join(' · ')}
            {recommendation.calibration
              ? ` — ${recommendation.calibration.text}`
              : ''}
          </span>
        </div>
      )}
      {recommendation?.flagReason && (
        <div className="adm-verdict">
          <span className="adm-tag hue-red">Flagged</span>
          <span className="adm-muted">{recommendation.flagReason}</span>
        </div>
      )}
      {v ? (
        <div className="adm-verdict">
          <span className={`adm-tag ${v.hue}`}>
            <Sparkles size={12} aria-hidden="true" />
            {v.label}
          </span>
          <span className="adm-muted">{triageReason}</span>
        </div>
      ) : null}
    </>
  );
}
