export interface InstallHint {
  command: string;
  args: string[];
}

export interface RemoteHint {
  url: string;
}

export type ParsedInstallHint = InstallHint | RemoteHint | null;

const RUNNER_PATTERN = /\b(npx|uvx|bunx)\s+(-y\s+)?([@a-zA-Z0-9._/-]+)/;
const PIP_PATTERN = /\bpip install\s+([a-zA-Z0-9._-]+)/;
const URL_PATTERN = /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/;

/** Hosts that show up in descriptions as badges/repo links, not as the server's own remote endpoint. */
const NON_ENDPOINT_HOSTS = ['glama.ai', 'github.com', 'npmjs.com', 'pypi.org'];

/**
 * Best-effort extraction of an install command from a directory server's free-text
 * description. Returns null when nothing recognizable is found — callers must treat
 * that as "ask the user," never fall back to a guess.
 */
export function parseInstallHint(description: string): ParsedInstallHint {
  if (!description) return null;

  const runnerMatch = description.match(RUNNER_PATTERN);
  if (runnerMatch) {
    const [, runner, , pkg] = runnerMatch;
    const args = runner === 'npx' ? ['-y', pkg] : [pkg];
    return { command: runner, args };
  }

  const pipMatch = description.match(PIP_PATTERN);
  if (pipMatch) {
    return { command: 'pip', args: ['install', pipMatch[1]] };
  }

  const urlMatch = description.match(URL_PATTERN);
  if (urlMatch) {
    const candidate = urlMatch[0].replace(/[).,]+$/, '');
    const isNonEndpoint = NON_ENDPOINT_HOSTS.some((host) => candidate.includes(host));
    if (!isNonEndpoint) {
      return { url: candidate };
    }
  }

  return null;
}

export function isRemoteHint(hint: ParsedInstallHint): hint is RemoteHint {
  return !!hint && 'url' in hint;
}
