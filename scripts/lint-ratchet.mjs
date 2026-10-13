// Biome warning ratchet: per-rule warning counts may only go down.
// `node scripts/lint-ratchet.mjs` checks against lint-baseline.json;
// `--update` rewrites the baseline (only ever lower it without sign-off).
// Canonical copy: jackalope-digital-hub/templates/scripts/lint-ratchet.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const baselinePath = 'lint-baseline.json';
const biome = 'node_modules/@biomejs/biome/bin/biome';
let out;
try {
  out = execFileSync(
    'node',
    [biome, 'lint', '--reporter=json', '--max-diagnostics=none', '.'],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );
} catch (error) {
  out = error.stdout; // biome exits non-zero on errors; `lint` reports those itself
}
const counts = {};
for (const d of JSON.parse(out).diagnostics ?? []) {
  if (d.severity !== 'warning') continue;
  counts[d.category] = (counts[d.category] ?? 0) + 1;
}
const sorted = Object.fromEntries(
  Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
);

if (process.argv.includes('--update') || !existsSync(baselinePath)) {
  writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`lint-ratchet: wrote ${baselinePath}`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const worse = [];
const better = [];
for (const rule of new Set([
  ...Object.keys(baseline),
  ...Object.keys(sorted),
])) {
  const was = baseline[rule] ?? 0;
  const now = sorted[rule] ?? 0;
  if (now > was) worse.push(`  ${rule}: ${was} -> ${now}`);
  else if (now < was) better.push(`  ${rule}: ${was} -> ${now}`);
}
if (worse.length) {
  console.error(
    `lint-ratchet: new Biome warnings. Fix them; do not raise the baseline.\n${worse.join('\n')}`,
  );
  process.exit(1);
}
if (better.length) {
  console.log(
    `lint-ratchet: fewer warnings, lock it in with --update:\n${better.join('\n')}`,
  );
}
