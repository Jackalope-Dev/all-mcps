import type { Server } from './servers';

const MAX_DESCRIPTION = 160;
const MAX_SUMMARY = 100;

type MetaInput = Partial<
  Pick<
    Server,
    | 'aiSummary'
    | 'description'
    | 'tools'
    | 'toolsSource'
    | 'installKind'
    | 'remoteEndpointUrl'
    | 'githubStars'
    | 'vulnScannedAt'
    | 'vulnCriticalCount'
    | 'vulnHighCount'
    | 'vulnMediumCount'
    | 'vulnLowCount'
  >
>;

function formatCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

/**
 * Facts about this listing, most distinctive first. Every page used to end
 * with the same stock sentence, which reads as templated catalog copy across
 * thousands of URLs; these come from the listing's own data instead.
 */
function listingFacts(s: MetaInput): string[] {
  const facts: string[] = [];

  const toolCount = s.tools?.length ?? 0;
  if (toolCount > 0) {
    const noun = toolCount === 1 ? 'tool' : 'tools';
    facts.push(
      s.toolsSource === 'introspected'
        ? `${toolCount} ${noun} verified live`
        : `${toolCount} ${noun}`,
    );
  }

  if (s.vulnScannedAt) {
    const severe = (s.vulnCriticalCount ?? 0) + (s.vulnHighCount ?? 0);
    const total = severe + (s.vulnMediumCount ?? 0) + (s.vulnLowCount ?? 0);
    if (severe > 0) {
      facts.push(
        `${severe} high-severity ${severe === 1 ? 'advisory' : 'advisories'}`,
      );
    } else if (total === 0) {
      facts.push('no known vulnerabilities');
    }
  }

  if (s.remoteEndpointUrl || s.installKind === 'remote') {
    facts.push('remote server');
  } else if (s.installKind === 'stdio') {
    facts.push('runs locally');
  }

  const stars = s.githubStars ?? 0;
  if (stars >= 25) facts.push(`${formatCount(stars)} GitHub stars`);

  return facts;
}

export function buildListingMetaDescription(s: MetaInput): string {
  // Prefer the LLM-written one-liner — the raw description is often scraped
  // chrome that duplicates the upstream repo's snippet.
  let summary = (s.aiSummary?.trim() || s.description || '')
    .trim()
    .replace(/\.+$/, '');
  if (summary.length > MAX_SUMMARY) {
    summary = `${summary.slice(0, MAX_SUMMARY - 3).trimEnd()}…`;
  }
  const lead = summary ? `${summary}${summary.endsWith('…') ? '' : '.'}` : '';

  // Drop trailing facts until it fits, rather than cutting mid-word.
  const facts = listingFacts(s);
  while (facts.length > 0) {
    const tail = facts.join(', ');
    const candidate = `${lead} ${tail.charAt(0).toUpperCase()}${tail.slice(1)}.`;
    if (candidate.trim().length <= MAX_DESCRIPTION) return candidate.trim();
    facts.pop();
  }
  return lead;
}
