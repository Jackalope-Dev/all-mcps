import { describe, expect, it } from 'vitest';
import {
  isModerationReason,
  MODERATION_REASON_FEEDBACK,
  MODERATION_REASON_LABEL,
  MODERATION_REASONS,
  rejectionEmail,
} from './moderationReasons';

describe('moderation reasons', () => {
  it('labels every code and gives it submitter feedback', () => {
    for (const r of MODERATION_REASONS) {
      expect(MODERATION_REASON_LABEL[r]).toBeTruthy();
      expect(MODERATION_REASON_FEEDBACK[r].length).toBeGreaterThan(40);
    }
  });

  it('recognises stored codes only', () => {
    expect(isModerationReason('brochure')).toBe(true);
    expect(isModerationReason('Brochure')).toBe(false);
    expect(isModerationReason(null)).toBe(false);
  });

  it('combines picked reasons into one email and drops a redundant Other', () => {
    const e = rejectionEmail(['broken', 'incomplete', 'other']);
    expect(e.feedback).toBe(
      `${MODERATION_REASON_FEEDBACK.broken}\n\n${MODERATION_REASON_FEEDBACK.incomplete}`,
    );
    expect(e.canResubmit).toBe(true);
  });

  it('only invites a resubmission when every reason is fixable', () => {
    expect(rejectionEmail(['incomplete', 'spam']).canResubmit).toBe(false);
    expect(rejectionEmail(['adult']).canResubmit).toBe(false);
    expect(rejectionEmail([])).toEqual({ feedback: null, canResubmit: true });
  });
});
