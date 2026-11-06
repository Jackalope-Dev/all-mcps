// Pre-push gate (lefthook.yml). A fast check of what this push can break; CI
// runs the full `bun run verify` (lint ratchet, all tests, knip, build) on every
// push to main and every pull request.

/** This repo's checks: [name, command(s)], skipped when the command is falsy.
 * LINTABLE and TYPES (file patterns) are defined in the shared part below. */
function checks({ changed, biome, vitest }) {
  return [
    ['lint', changed(LINTABLE) && biome()],
    ['typecheck', changed(TYPES) && 'bun run typecheck'],
    ['tests', changed(TYPES) && vitest()],
  ];
}

// ---- Shared below this line: the same in every Jackalope Digital repo. ----
//
// Only what the pushed commits can break is checked: lint on the changed files,
// the typecheck, and the tests that import a changed file (`vitest --changed`).
// Commits that touch no code skip the checks. Skip once: `git push --no-verify`.
//
// One push's checks run at a time on this machine. Parallel sessions pushing in
// several repos at once otherwise saturate the disk; a later push waits here.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

const env = { ...process.env };
// Git exports these to hooks; in a linked worktree they point checks at the wrong repository.
for (const key of Object.keys(env))
  if (
    /^GIT_(DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|PREFIX)$/.test(
      key,
    )
  )
    delete env[key];

function git(...args) {
  const res = spawnSync('git', args, {
    encoding: 'utf8',
    env,
    windowsHide: true,
  });
  return res.status === 0 ? res.stdout.trim() : null;
}

const root = git('rev-parse', '--show-toplevel');
const main =
  git('symbolic-ref', '--short', 'refs/remotes/origin/HEAD') ?? 'origin/main';
// PRE_PUSH_BASE checks the changes since another commit, e.g. to run this by hand.
const base = process.env.PRE_PUSH_BASE
  ? git('rev-parse', process.env.PRE_PUSH_BASE)
  : git('merge-base', 'HEAD', main);
// null when the base is unknown: every check then runs on everything.
const files =
  base === null
    ? null
    : (git('diff', '--name-only', '--diff-filter=ACMR', base, 'HEAD') ?? '')
        .split('\n')
        .filter(Boolean);

const LINTABLE = /\.((c|m)?[jt]sx?|jsonc?|css)$/;
const TYPES = /(\.(c|m)?[jt]sx?|(^|\/)(package|tsconfig[^/]*)\.json)$/;

/** Whether a changed file (optionally under `dir`) matches `pattern`. */
function changed(pattern, dir = '') {
  const prefix = dir ? `${dir}/` : '';
  return (
    files === null || files.some((f) => f.startsWith(prefix) && pattern.test(f))
  );
}

/** A package's binary, from `dir`'s node_modules or the nearest one above it. */
function bin(dir, path) {
  for (let at = join(root, dir); ; at = dirname(at)) {
    const file = join(at, 'node_modules', path);
    if (existsSync(file)) return file;
    if (at === root || dirname(at) === at) return null;
  }
}

/** Biome on the changed files under `dir`, run from `dir` so its biome.json applies. */
function biome(dir = '') {
  const biomeBin = bin(dir, '@biomejs/biome/bin/biome');
  const flags =
    'check --diagnostic-level=error --no-errors-on-unmatched --files-ignore-unknown=true';
  if (files === null) return { cwd: dir, cmd: `node "${biomeBin}" ${flags} .` };
  const prefix = dir ? `${dir}/` : '';
  const mine = files
    .filter((f) => f.startsWith(prefix) && LINTABLE.test(f))
    .map((f) => f.slice(prefix.length));
  return batches(mine).map((list) => ({
    cwd: dir,
    cmd: `node "${biomeBin}" ${flags} ${list}`,
  }));
}

/** Vitest on the tests that import a changed file, with at most 4 workers. */
function vitest(dir = '') {
  const since = base === null ? '' : ` --changed ${base}`;
  const vitestBin = bin(dir, 'vitest/vitest.mjs');
  return {
    cwd: dir,
    cmd: `node "${vitestBin}" run${since} --maxWorkers=4 --passWithNoTests`,
  };
}

/** Quoted file arguments, split to stay under the Windows command-line limit. */
function batches(list) {
  const out = [];
  let line = '';
  for (const f of list) {
    const arg = `"${f}"`;
    if (line && line.length + arg.length > 6000) {
      out.push(line);
      line = '';
    }
    line += (line ? ' ' : '') + arg;
  }
  if (line) out.push(line);
  return out;
}

const LOCK = join(tmpdir(), 'jackalope-digital-pre-push.lock');
const STALE_MS = 30 * 60 * 1000;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

async function lock() {
  let waiting = false;
  for (;;) {
    try {
      mkdirSync(LOCK);
      writeFileSync(
        join(LOCK, 'owner.json'),
        JSON.stringify({ pid: process.pid, repo: root, at: Date.now() }),
      );
      return;
    } catch {
      let owner = null;
      let age = 0;
      try {
        owner = JSON.parse(readFileSync(join(LOCK, 'owner.json'), 'utf8'));
        age = Date.now() - owner.at;
      } catch {
        try {
          age = Date.now() - statSync(LOCK).mtimeMs;
        } catch {
          continue; // Released between the two calls.
        }
      }
      // A crashed push leaves the lock behind: take it once its owner is gone.
      if (
        (owner && !alive(owner.pid)) ||
        age > STALE_MS ||
        (!owner && age > 10_000)
      ) {
        rmSync(LOCK, { recursive: true, force: true });
        continue;
      }
      if (!waiting)
        console.log(
          `pre-push: waiting for another push's checks (${owner?.repo ?? 'starting'})`,
        );
      waiting = true;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

function unlock() {
  try {
    if (
      JSON.parse(readFileSync(join(LOCK, 'owner.json'), 'utf8')).pid ===
      process.pid
    )
      rmSync(LOCK, { recursive: true, force: true });
  } catch {}
}

const todo = checks({ changed, biome, vitest, files, base }).filter(
  ([, run]) => run && [run].flat().length,
);
if (todo.length === 0) {
  console.log('pre-push: no code changed, nothing to check');
  process.exit(0);
}
console.log(
  files === null
    ? `pre-push: no merge base with ${main}, checking everything`
    : `pre-push: ${files.length} files changed since ${main}`,
);
process.on('exit', unlock);
process.on('SIGINT', () => process.exit(130));
await lock();
for (const [name, run] of todo) {
  const started = performance.now();
  for (const step of [run].flat()) {
    const { cwd = '', cmd } = typeof step === 'string' ? { cmd: step } : step;
    const res = spawnSync(cmd, {
      cwd: join(root, cwd),
      env,
      shell: true,
      stdio: 'inherit',
      windowsHide: true,
    });
    if (res.status !== 0) {
      console.error(
        `pre-push: ${name} failed${cwd ? ` in ${relative(root, join(root, cwd))}` : ''}`,
      );
      process.exit(res.status ?? 1);
    }
  }
  console.log(
    `pre-push: ${name} passed in ${((performance.now() - started) / 1000).toFixed(1)}s`,
  );
}
