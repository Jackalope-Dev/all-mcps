export type EditableServerFields = {
  name: string;
  description: string;
  category: string;
  websiteUrl: string;
};

export type PendingRevision = {
  proposed: Partial<EditableServerFields>;
  submittedAt: string;
};

const EDITABLE_KEYS: (keyof EditableServerFields)[] = ['name', 'description', 'category', 'websiteUrl'];

/** Returns only the fields that actually changed vs. the live row. Empty object if nothing changed. */
export function diffEditableFields(
  current: EditableServerFields,
  submitted: EditableServerFields
): Partial<EditableServerFields> {
  const diff: Partial<EditableServerFields> = {};
  for (const key of EDITABLE_KEYS) {
    const next = (submitted[key] ?? '').trim();
    const prev = (current[key] ?? '').trim();
    if (next !== prev) {
      diff[key] = next;
    }
  }
  return diff;
}

export function serializePendingRevision(proposed: Partial<EditableServerFields>): string {
  const revision: PendingRevision = { proposed, submittedAt: new Date().toISOString() };
  return JSON.stringify(revision);
}

export function parsePendingRevision(raw: string | null | undefined): PendingRevision | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.proposed && typeof parsed.proposed === 'object') {
      return parsed as PendingRevision;
    }
  } catch {
    // fall through
  }
  return null;
}
