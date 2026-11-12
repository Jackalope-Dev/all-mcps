/**
 * Install commands that run code from somewhere other than a package
 * registry or the listing's own repo. A normal MCP install is `npx -y pkg`,
 * `uvx pkg`, `docker run image` or a remote URL; anything that pipes a
 * download into a shell, decodes a payload, or fetches a script at install
 * time skips every check a registry gives users (provenance, deprecation,
 * malware takedowns) and is how most install-time compromises work.
 *
 * Findings flag a listing for a human (lib/staleness.ts 'risky-install');
 * they never remove one. Kept deliberately narrow: a false positive hides a
 * working server, so each rule matches a shape with no ordinary use in an MCP
 * client config.
 */

type InstallRiskCode =
  | 'pipe-to-shell'
  | 'shell-download'
  | 'encoded-payload'
  | 'remote-archive'
  | 'temporary-host';

export type InstallRiskFinding = { code: InstallRiskCode; label: string };

const INSTALL_RISK_LABEL: Record<InstallRiskCode, string> = {
  'pipe-to-shell': 'Pipes a download straight into a shell',
  'shell-download': 'Shell or PowerShell command that downloads code',
  'encoded-payload': 'Runs an encoded (base64) payload',
  'remote-archive': 'Installs a package from an arbitrary URL',
  'temporary-host':
    'Points at a temporary tunnel or a bare IP address instead of a real domain',
};

const SHELLS = new Set([
  'sh',
  'bash',
  'zsh',
  'dash',
  'cmd',
  'cmd.exe',
  'powershell',
  'powershell.exe',
  'pwsh',
]);

/** Hosts a package-from-URL install may legitimately come from. */
const TRUSTED_ARCHIVE_HOSTS = [
  'github.com',
  'codeload.github.com',
  'gitlab.com',
  'bitbucket.org',
  'registry.npmjs.org',
  'files.pythonhosted.org',
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isTrustedHost(host: string): boolean {
  return TRUSTED_ARCHIVE_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`),
  );
}

/**
 * Throwaway hostnames: tunnels anyone can open from a laptop in seconds
 * (trycloudflare, ngrok, localtunnel...) and DNS that maps any IP
 * (sslip.io, nip.io). Nothing at one is accountable or stays put, so a
 * package index or MCP endpoint there can change under users at any time.
 * Found in Nov 2026: a listing whose install pointed uvx at a PyPI index
 * served from a trycloudflare.com tunnel.
 */
const TEMPORARY_HOST_SUFFIXES = [
  'trycloudflare.com',
  'ngrok.io',
  'ngrok.app',
  'ngrok-free.app',
  'ngrok.dev',
  'ngrok-free.dev',
  'loca.lt',
  'localtunnel.me',
  'serveo.net',
  'localhost.run',
  'lhr.life',
  'pinggy.link',
  'pinggy.online',
  'bore.pub',
  'sslip.io',
  'nip.io',
  'xip.io',
];

/** Loopback and private ranges: "run it locally, then connect to localhost:8000" is ordinary self-hosting. */
function isLocalAddress(h: string): boolean {
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h === '::1' ||
    h === '0.0.0.0' ||
    /^(127|10)\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^(fc|fd|fe80)/i.test(h)
  );
}

function isTemporaryHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '');
  if (isLocalAddress(h)) return false;
  // A bare public IPv4 / IPv6 literal.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':')) return true;
  return TEMPORARY_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

function urlsIn(text: string): string[] {
  return text.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
}

function parseArgs(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* plain string */
  }
  return [raw];
}

export function assessInstallRisk(install: {
  installCommand?: string | null;
  installArgs?: string | string[] | null;
  installPackage?: string | null;
  /** The listing's own URL and hosted endpoint, checked for temporary hosts only. */
  url?: string | null;
  remoteEndpointUrl?: string | null;
}): InstallRiskFinding[] {
  const command = (install.installCommand || '').trim().toLowerCase();
  const args = parseArgs(install.installArgs);
  const joined = [command, ...args, install.installPackage || '']
    .join(' ')
    .toLowerCase();
  const codes = new Set<InstallRiskCode>();

  // `curl … | sh`, `wget -qO- … | bash`, `iwr … | iex`
  if (
    /\b(curl|wget|iwr|invoke-webrequest|irm|invoke-restmethod)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|iex|invoke-expression|python3?|node)\b/.test(
      joined,
    )
  ) {
    codes.add('pipe-to-shell');
  }

  const binary = command.split(/[\\/]/).pop() || command;
  if (
    SHELLS.has(binary) &&
    /\b(curl|wget|iwr|invoke-webrequest|irm|downloadstring|downloadfile|start-bitstransfer)\b|https?:\/\//.test(
      joined,
    )
  ) {
    codes.add('shell-download');
  }

  if (
    /\bbase64\s+(-d|--decode)\b|frombase64string|-encodedcommand\b|\s-enc\s/.test(
      joined,
    )
  ) {
    codes.add('encoded-payload');
  }

  // `npx https://evil.example/x.tgz`, `pip install https://…/pkg.zip`
  for (const token of [...args, install.installPackage || '']) {
    const m = /^(?:git\+)?(https?:\/\/\S+)/i.exec(token.trim());
    if (!m) continue;
    const host = hostOf(m[1]);
    if (!host) continue;
    const looksLikeArchive = /\.(tgz|tar\.gz|zip|whl|tar)(\?|#|$)/i.test(m[1]);
    const isRunner = [
      'npx',
      'bunx',
      'npm',
      'pip',
      'pip3',
      'pipx',
      'uvx',
    ].includes(binary);
    if (isRunner && looksLikeArchive && !isTrustedHost(host)) {
      codes.add('remote-archive');
    }
  }

  // A package index (`--index-url`), the package itself, the listing URL or
  // the MCP endpoint on a throwaway host. Other arguments are left alone:
  // `--api http://localhost:11434` (a local Ollama) is an ordinary config.
  const indexUrls = args.flatMap((a, i) => {
    const flag =
      /^(--(extra-)?index-url|-i|--registry|--find-links|-f)(=(.*))?$/.exec(a);
    if (!flag) return [];
    return urlsIn(flag[4] ?? args[i + 1] ?? '');
  });
  const candidates = [
    ...indexUrls,
    ...urlsIn(install.installPackage || ''),
    ...urlsIn(install.url || ''),
    ...urlsIn(install.remoteEndpointUrl || ''),
  ];
  if (
    candidates.some((u) => {
      const host = hostOf(u);
      return host != null && isTemporaryHost(host);
    })
  ) {
    codes.add('temporary-host');
  }

  return [...codes].map((code) => ({ code, label: INSTALL_RISK_LABEL[code] }));
}
