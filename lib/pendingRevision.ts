/**
 * Owner-edit pending revision: owners propose field changes; admins approve
 * them onto the live row. Values may be strings or string arrays (tags,
 * compatibleClients, suggestedInstallArgs).
 */

export type EditableFieldValue = string | string[];

export type EditableServerFields = {
  name: string;
  description: string;
  category: string;
  websiteUrl: string;
  tags: string[];
  pricingModel: string;
  pricingNotes: string;
  authType: string;
  license: string;
  compatibleClients: string[];
  maintenanceStatus: string;
  supportUrl: string;
  suggestedInstallCommand: string;
  suggestedInstallArgs: string[];
};

export type PendingRevision = {
  proposed: Partial<EditableServerFields>;
  submittedAt: string;
};

export const EDITABLE_KEYS: (keyof EditableServerFields)[] = [
  'name',
  'description',
  'category',
  'websiteUrl',
  'tags',
  'pricingModel',
  'pricingNotes',
  'authType',
  'license',
  'compatibleClients',
  'maintenanceStatus',
  'supportUrl',
  'suggestedInstallCommand',
  'suggestedInstallArgs',
];

const ARRAY_KEYS = new Set<keyof EditableServerFields>([
  'tags',
  'compatibleClients',
  'suggestedInstallArgs',
]);

function normalizeForCompare(key: keyof EditableServerFields, value: EditableFieldValue | null | undefined): string {
  if (ARRAY_KEYS.has(key)) {
    const arr = Array.isArray(value) ? value.map(String) : [];
    return JSON.stringify([...arr].map((s) => s.trim()).filter(Boolean).sort());
  }
  return String(value ?? '').trim();
}

function normalizeStored(
  key: keyof EditableServerFields,
  value: EditableFieldValue | null | undefined
): EditableFieldValue {
  if (ARRAY_KEYS.has(key)) {
    if (!Array.isArray(value)) return [];
    return value.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(value ?? '').trim();
}

/** Returns only the fields that actually changed vs. the live row. Empty object if nothing changed. */
export function diffEditableFields(
  current: Partial<EditableServerFields>,
  submitted: Partial<EditableServerFields>
): Partial<EditableServerFields> {
  const diff: Partial<EditableServerFields> = {};
  for (const key of EDITABLE_KEYS) {
    if (!(key in submitted) && !(key in current)) continue;
    // Only include keys that were submitted (owner form always sends full shape).
    if (!(key in submitted)) continue;
    const nextRaw = submitted[key];
    const prevRaw = current[key];
    if (normalizeForCompare(key, nextRaw as EditableFieldValue) !== normalizeForCompare(key, prevRaw as EditableFieldValue)) {
      (diff as Record<string, EditableFieldValue>)[key] = normalizeStored(key, nextRaw as EditableFieldValue);
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

/**
 * Apply a proposed revision onto a DB update payload: string fields as-is,
 * array fields JSON-stringified for text columns.
 */
export function pendingRevisionToDbPatch(
  proposed: Partial<EditableServerFields>
): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(proposed) as [keyof EditableServerFields, EditableFieldValue][]) {
    if (!EDITABLE_KEYS.includes(key)) continue;
    if (ARRAY_KEYS.has(key)) {
      const arr = Array.isArray(value) ? value : [];
      patch[key] = arr.length > 0 ? JSON.stringify(arr) : null;
    } else {
      const s = String(value ?? '').trim();
      patch[key] = s.length > 0 ? s : null;
    }
  }
  return patch;
}
