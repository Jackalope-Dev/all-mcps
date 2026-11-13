/**
 * Owner-edit pending revision: owners propose field changes; admins approve
 * them onto the live row. Values may be strings or string arrays (tags,
 * compatibleClients, suggestedInstallArgs).
 */

import { setupStepsEditPatch } from './setupSteps';

type EditableFieldValue = string | string[];

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
  /** Remote MCP endpoint the install buttons are generated from. Owner-editable
   * because a wrong endpoint is the one field that makes a listing actively
   * harmful — it points people's clients at the wrong host — and clearing it
   * is how an owner suppresses generated install buttons until it's right. */
  remoteEndpointUrl: string;
  suggestedInstallCommand: string;
  suggestedInstallArgs: string[];
  /** Setup steps in lib/setupSteps.ts text format (`# Label` + command per block). */
  setupSteps: string;
  setupNote: string;
  setupSourceUrl: string;
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
  'remoteEndpointUrl',
  'suggestedInstallCommand',
  'suggestedInstallArgs',
  'setupSteps',
  'setupNote',
  'setupSourceUrl',
];

const ARRAY_KEYS = new Set<keyof EditableServerFields>([
  'tags',
  'compatibleClients',
  'suggestedInstallArgs',
]);

function normalizeForCompare(
  key: keyof EditableServerFields,
  value: EditableFieldValue | null | undefined,
): string {
  if (ARRAY_KEYS.has(key)) {
    const arr = Array.isArray(value) ? value.map(String) : [];
    return JSON.stringify(
      [...arr]
        .map((s) => s.trim())
        .filter(Boolean)
        .sort(),
    );
  }
  return String(value ?? '').trim();
}

function normalizeStored(
  key: keyof EditableServerFields,
  value: EditableFieldValue | null | undefined,
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
  submitted: Partial<EditableServerFields>,
): Partial<EditableServerFields> {
  const diff: Partial<EditableServerFields> = {};
  for (const key of EDITABLE_KEYS) {
    if (!(key in submitted) && !(key in current)) continue;
    // Only include keys that were submitted (owner form always sends full shape).
    if (!(key in submitted)) continue;
    const nextRaw = submitted[key];
    const prevRaw = current[key];
    if (
      normalizeForCompare(key, nextRaw as EditableFieldValue) !==
      normalizeForCompare(key, prevRaw as EditableFieldValue)
    ) {
      (diff as Record<string, EditableFieldValue>)[key] = normalizeStored(
        key,
        nextRaw as EditableFieldValue,
      );
    }
  }
  return diff;
}

export function serializePendingRevision(
  proposed: Partial<EditableServerFields>,
): string {
  const revision: PendingRevision = {
    proposed,
    submittedAt: new Date().toISOString(),
  };
  return JSON.stringify(revision);
}

export function parsePendingRevision(
  raw: string | null | undefined,
): PendingRevision | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.proposed &&
      typeof parsed.proposed === 'object'
    ) {
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
  proposed: Partial<EditableServerFields>,
  now: Date = new Date(),
): Record<string, string | Date | null> {
  const patch: Record<string, string | Date | null> = {};
  for (const [key, value] of Object.entries(proposed) as [
    keyof EditableServerFields,
    EditableFieldValue,
  ][]) {
    if (!EDITABLE_KEYS.includes(key)) continue;
    if (ARRAY_KEYS.has(key)) {
      const arr = Array.isArray(value) ? value : [];
      patch[key] = arr.length > 0 ? JSON.stringify(arr) : null;
    } else {
      const s = String(value ?? '').trim();
      patch[key] = s.length > 0 ? s : null;
    }
  }
  // Steps are stored as JSON and owned by whoever wrote them, not as the raw
  // form text the owner typed. A note/source edited alongside comes through
  // the plain-string handling above; clearing the steps clears all three.
  if (typeof proposed.setupSteps === 'string') {
    const steps = setupStepsEditPatch(
      {
        text: proposed.setupSteps,
        note: proposed.setupNote,
        sourceUrl: proposed.setupSourceUrl,
      },
      'owner',
      now,
    );
    patch.setupSteps = steps.setupSteps;
    patch.setupSource = steps.setupSource;
    patch.setupExtractedAt = steps.setupExtractedAt;
    if (steps.setupSteps === null) {
      patch.setupNote = null;
      patch.setupSourceUrl = null;
    }
  }
  return patch;
}

/**
 * Edited fields the generated writeup (overview, "How it works", FAQ) is
 * written from or repeats: the name, the description, and how a client
 * connects. Pricing, tags, links and the like are rendered from their own
 * columns, so changing them leaves the writeup accurate.
 */
const WRITEUP_INPUT_KEYS: (keyof EditableServerFields)[] = [
  'name',
  'description',
  'remoteEndpointUrl',
  'suggestedInstallCommand',
  'suggestedInstallArgs',
  'setupSteps',
];

/**
 * Whether approving this edit leaves the generated writeup describing the old
 * listing. Compares the values the edit would store against the live row's
 * stored values, so an edit that only restates what is already live does not
 * queue a rewrite. Before this, only a description change did: an owner who
 * moved their endpoint or renamed the server kept a writeup and FAQ naming the
 * retired endpoint until the README happened to change.
 */
export function editChangesWriteupInputs(
  proposed: Partial<EditableServerFields>,
  live: Partial<Record<keyof EditableServerFields, string | null>>,
): boolean {
  const patch = pendingRevisionToDbPatch(proposed);
  return WRITEUP_INPUT_KEYS.some(
    (key) =>
      key in patch &&
      (patch[key] ?? null) !== ((live[key] ?? '').trim() || null),
  );
}
