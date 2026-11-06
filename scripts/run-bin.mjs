// Runs a package's bin, found the way Node resolves an import: from the current
// folder up. In a worktree with no node_modules of its own (scripts/worktree.mjs)
// that finds the main checkout's copy, where a hard-coded node_modules/... path
// fails and npx can pick up an unrelated global install instead.
//   node scripts/run-bin.mjs @biomejs/biome/bin/biome check --write ...
// Canonical copy: jackalope-digital-hub/templates/scripts/run-bin.mjs
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const [spec, ...args] = process.argv.slice(2);
if (!spec) {
  console.error(
    'Usage: node scripts/run-bin.mjs <package>/<bin path> [args...]',
  );
  process.exit(1);
}
const bin = createRequire(join(process.cwd(), 'package.json')).resolve(spec);
const r = spawnSync(process.execPath, [bin, ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);
