/**
 * Registry status of a listing's install package — the stale sweep's two hard
 * signals: deprecated, or gone. Only a definite answer counts: a timeout, rate
 * limit or 5xx returns `unknown` and changes nothing (same rule as the
 * auto-promote liveness check, where only 404/410 mean gone).
 */

export type RegistryStatus =
  | { kind: 'ok' }
  | { kind: 'deprecated'; message: string }
  | { kind: 'missing' }
  | { kind: 'unknown' };

export function registryFor(
  installCommand: string | null | undefined,
): 'npm' | 'pypi' | null {
  const cmd = (installCommand || '').toLowerCase();
  if (cmd === 'npx' || cmd === 'bunx' || cmd === 'npm') return 'npm';
  if (cmd === 'uvx' || cmd === 'pip' || cmd === 'pipx' || cmd === 'pip3')
    return 'pypi';
  return null;
}

/** Strip a trailing @version / ==version, keeping a leading @scope. */
export function bareName(pkg: string): string {
  return pkg
    .trim()
    .replace(/(?<=.)@[^/@\s]*$/, '')
    .replace(/==.*$/, '');
}

/** npm packument → status. Deprecation is per version; the dist-tag `latest` is what users get. */
export function npmStatusFromDoc(doc: unknown): RegistryStatus {
  const d = doc as {
    'dist-tags'?: { latest?: string };
    versions?: Record<string, { deprecated?: unknown }>;
    time?: { unpublished?: unknown };
  };
  if (d?.time?.unpublished) return { kind: 'missing' };
  const latest = d?.['dist-tags']?.latest;
  const dep = latest ? d.versions?.[latest]?.deprecated : undefined;
  if (typeof dep === 'string' && dep.trim())
    return { kind: 'deprecated', message: dep.trim().slice(0, 300) };
  return { kind: 'ok' };
}

/** PyPI JSON → status. A yanked latest release is PyPI's deprecation. */
export function pypiStatusFromDoc(doc: unknown): RegistryStatus {
  const d = doc as {
    info?: { yanked?: boolean; yanked_reason?: string | null };
  };
  if (d?.info?.yanked) {
    return {
      kind: 'deprecated',
      message: (d.info.yanked_reason || 'Latest release yanked').slice(0, 300),
    };
  }
  return { kind: 'ok' };
}

export async function checkRegistry(
  installCommand: string | null | undefined,
  installPackage: string | null | undefined,
): Promise<RegistryStatus> {
  const registry = registryFor(installCommand);
  const raw = (installPackage || '').trim();
  if (!registry || !raw || raw.includes('://') || /\s/.test(raw))
    return { kind: 'unknown' };
  const name = bareName(raw);
  const url =
    registry === 'npm'
      ? `https://registry.npmjs.org/${name.replace('/', '%2F')}`
      : `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AllMCPs-Stale-Sweep' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404 || res.status === 410) return { kind: 'missing' };
    if (!res.ok) return { kind: 'unknown' };
    const doc = await res.json();
    return registry === 'npm' ? npmStatusFromDoc(doc) : pypiStatusFromDoc(doc);
  } catch {
    return { kind: 'unknown' };
  }
}
