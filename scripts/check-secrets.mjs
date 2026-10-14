// Pre-push secret scan (lefthook.yml). Runs gitleaks over the commits being
// pushed. A Node script rather than an inline multi-line `run:` block, because
// lefthook on Windows mangled that block into a shell syntax error and blocked
// every push.
import { spawnSync } from 'node:child_process';

function git(args) {
  const res = spawnSync('git', args, { encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : null;
}

const probe = spawnSync('gitleaks', ['version'], { stdio: 'ignore' });
if (probe.error) {
  console.log(
    'gitleaks not installed, skipping (brew install gitleaks / scoop install gitleaks)',
  );
  process.exit(0);
}

// No upstream (a worktree branch pushed as HEAD:main): scan everything not yet
// on the remote default branch rather than just the last commit.
const base =
  git(['rev-parse', '@{u}']) ??
  git(['rev-parse', 'origin/HEAD']) ??
  git(['rev-parse', 'HEAD~1']);
const args = ['git', '--redact', '--no-banner'];
if (base) args.push(`--log-opts=${base}..HEAD`);
args.push('.');

const scan = spawnSync('gitleaks', args, { stdio: 'inherit' });
process.exit(scan.status ?? 1);
