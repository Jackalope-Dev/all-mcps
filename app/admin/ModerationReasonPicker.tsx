'use client';

import { useId } from 'react';
import {
  MODERATION_REASON_LABEL,
  MODERATION_REASONS,
  type ModerationReason,
} from '../../lib/moderationReasons';

/**
 * Reason codes for a reject or unpublish (lib/moderationReasons.ts). Several
 * can be picked; "Other" asks for a short note. Stored for gate tuning, never
 * shown to the submitter.
 */
export function ModerationReasonPicker({
  value,
  onChange,
  note,
  onNoteChange,
}: {
  value: ModerationReason[];
  onChange: (next: ModerationReason[]) => void;
  note: string;
  onNoteChange: (next: string) => void;
}) {
  const noteId = useId();
  const toggle = (r: ModerationReason) =>
    onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);

  return (
    <div className="adm-field adm-reason-picker">
      <span>Reason (for tracking, not sent)</span>
      <fieldset className="adm-chip-row" aria-label="Rejection reasons">
        {MODERATION_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            className="btn adm-btn-xs adm-toggle"
            aria-pressed={value.includes(r)}
            onClick={() => toggle(r)}
          >
            {MODERATION_REASON_LABEL[r]}
          </button>
        ))}
      </fieldset>
      {value.includes('other') && (
        <input
          id={noteId}
          className="form-input"
          aria-label="Other reason"
          maxLength={500}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="What was wrong with it?"
        />
      )}
    </div>
  );
}

/** Ready to submit: at least one reason, and a note when "Other" is picked. */
export function reasonsComplete(
  reasons: ModerationReason[],
  note: string,
): boolean {
  return (
    reasons.length > 0 && (!reasons.includes('other') || note.trim() !== '')
  );
}
