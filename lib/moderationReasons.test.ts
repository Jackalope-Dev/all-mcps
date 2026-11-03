import { describe, expect, it } from 'vitest';
import {
  isModerationReason,
  MODERATION_REASON_FEEDBACK,
  MODERATION_REASON_LABEL,
  MODERATION_REASONS,
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
});
