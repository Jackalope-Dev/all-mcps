/**
 * Supply-chain vulnerability signal — OSV.dev (https://osv.dev), free, no API
 * key. Deliberately a "directional signal," not a security audit: see
 * app/api/cron/vuln-scan/route.ts and components/ui/VulnSignalCard.tsx for
 * why the presentation stays calm/informational rather than alarmist.
 */

export type OsvEcosystem = 'npm' | 'PyPI';

/** Maps a listing's install runner to the OSV ecosystem it should be queried under. Null = not (yet) mappable — never scanned, never penalized. */
export function mapToOsvEcosystem(
  server: { installCommand?: string | null; installPackage?: string | null }
): { ecosystem: OsvEcosystem; name: string } | null {
  const pkg = (server.installPackage || '').trim();
  if (!pkg) return null;

  const cmd = (server.installCommand || '').trim().toLowerCase();
  // Strip a trailing @version/==version suffix, occasionally present from
  // README-parsed installPackage values.
  const name = pkg.replace(/(@|==)[^/\s]+$/, '').trim();
  if (!name || name.includes('://')) return null;

  if (cmd === 'npx' || cmd === 'bunx' || cmd === 'npm') {
    return { ecosystem: 'npm', name };
  }
  if (cmd === 'uvx' || cmd === 'pip' || cmd === 'pip3' || cmd === 'python' || cmd === 'python3') {
    return { ecosystem: 'PyPI', name };
  }
  return null;
}

type OsvSeverityField = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | string | undefined;

/**
 * Reads the GHSA-convention `database_specific.severity` field most OSV
 * records carry. Missing/unparseable severity defaults to 'low', never to
 * 'high'/'critical' — ambiguous data must never read as alarming.
 */
export function classifySeverity(vuln: { database_specific?: { severity?: OsvSeverityField } }): 'critical' | 'high' | 'medium' | 'low' {
  const raw = (vuln.database_specific?.severity || '').toUpperCase();
  if (raw === 'CRITICAL') return 'critical';
  if (raw === 'HIGH') return 'high';
  if (raw === 'MODERATE') return 'medium';
  return 'low';
}

export type OsvBatchQueryResult = { vulns?: { id: string; modified?: string }[] };

/** One request for the whole batch — OSV's querybatch endpoint accepts many package queries at once. */
export async function osvQueryBatch(
  queries: { ecosystem: OsvEcosystem; name: string }[]
): Promise<OsvBatchQueryResult[]> {
  const res = await fetch('https://api.osv.dev/v1/querybatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'AllMCPs-VulnScan' },
    body: JSON.stringify({
      queries: queries.map((q) => ({ package: { name: q.name, ecosystem: q.ecosystem } })),
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`OSV querybatch failed: ${res.status}`);
  const body = (await res.json()) as { results?: OsvBatchQueryResult[] };
  return body.results || [];
}

/** Severity detail for one advisory id. Returns 'low' (never throws) on any fetch/parse failure — ambiguous data stays calm, per classifySeverity. */
export async function osvGetSeverity(id: string): Promise<'critical' | 'high' | 'medium' | 'low'> {
  try {
    const res = await fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, {
      headers: { 'User-Agent': 'AllMCPs-VulnScan' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 'low';
    const vuln = (await res.json()) as { database_specific?: { severity?: OsvSeverityField } };
    return classifySeverity(vuln);
  } catch {
    return 'low';
  }
}
