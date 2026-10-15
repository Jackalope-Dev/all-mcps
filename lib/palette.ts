/**
 * Accent hues for identity colouring (see the palette in
 * app/styles/foundation.css). Brand cyan is reserved for actions; these give
 * categories, jobs, tool groups and topics their own consistent colour.
 */
const HUES = [
  'blue',
  'violet',
  'teal',
  'orange',
  'pink',
  'green',
  'amber',
  'indigo',
  'red',
  'cyan',
] as const;

export type Hue = (typeof HUES)[number];

/** Stable hue for any key (category name, slug, tag) — same input, same colour. */
export function hueFor(key: string): Hue {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  }
  return HUES[Math.abs(h) % HUES.length];
}

/** Class name that sets `--tint` for the tint-* utilities. */
export function hueClass(key: string): string {
  return `hue-${hueFor(key)}`;
}

/** Semantic status colours: green = healthy/passed, amber = caution, red = failing. */
export type Status = 'ok' | 'warn' | 'bad';

const STATUS_HUE: Record<Status, Hue> = {
  ok: 'green',
  warn: 'amber',
  bad: 'red',
};

/** `hue-*` class for a status (health, security checks, validation results). */
export function statusHueClass(status: Status): string {
  return `hue-${STATUS_HUE[status]}`;
}
