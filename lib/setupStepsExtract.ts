/**
 * Picks a listing's setup steps out of its README or docs page.
 *
 * The commands come from extractCommandCandidates (code blocks in the source);
 * Jev only decides which of them a user runs to set up THIS server, and what
 * each one does. It can't write or edit a command, so whatever is published is
 * verbatim from the project's own material. Jev unavailable → 'unavailable',
 * and the caller leaves the listing for a later run rather than guessing.
 */

import { fetchGithubReadme, parseGithubUrl } from './listingEnrich';
import {
  extractCommandCandidates,
  htmlToText,
  SETUP_LIMITS,
  type SetupStep,
} from './setupSteps';
import { askJev, confidentChoice, type JevQuestion } from './typesafe';
import { isSafeSubmissionUrl, safeFetch } from './urlSafety';

/** Jev's truth probability for "this command is a setup step for this server". */
const STEP_FLOOR = 0.7;
/** Below this the role is a guess, and the step goes unlabeled. */
const ROLE_FLOOR = 0.45;

const ROLES = {
  install: 'Installs the server, its CLI, or the app that provides it',
  sign_in: 'Signs in, or stores an API key or token',
  configure: 'Sets configuration the server needs (not a client config)',
  connect: 'Adds the server to an MCP client (Claude Code, Codex, an editor)',
  run: 'Starts the MCP server process',
  verify: 'Checks that the setup works',
} as const;
type Role = keyof typeof ROLES;

/** A step whose role is one of these makes the list usable on its own. */
const ESSENTIAL_ROLES = new Set<Role>(['install', 'connect', 'run']);

/** `<client> mcp add` → the client's name, for a "Add to …" label. */
const CLIENT_NAMES: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  grok: 'Grok CLI',
  goose: 'Goose',
  opencode: 'OpenCode',
  amp: 'Amp',
  code: 'VS Code',
  'code-insiders': 'VS Code Insiders',
  cursor: 'Cursor',
};

export function stepLabel(role: Role | null, command: string): string | null {
  switch (role) {
    case 'install':
      return 'Install';
    case 'sign_in':
      return 'Sign in';
    case 'configure':
      return 'Configure';
    case 'run':
      return 'Start the server';
    case 'verify':
      return 'Check the setup';
    case 'connect': {
      const client = CLIENT_NAMES[command.trim().split(/\s+/)[0] ?? ''];
      return client ? `Add to ${client}` : 'Add to your MCP client';
    }
    default:
      return null;
  }
}

export type SetupSource = { text: string; url: string };

export type PickOutcome =
  | { status: 'ok'; steps: SetupStep[] }
  | { status: 'none' }
  | { status: 'unavailable' };

/** Whether a candidate command reads as setup for this listing (Jev answers). */
export async function pickSetupSteps(listing: {
  name: string;
  url: string;
  description: string;
  source: SetupSource;
}): Promise<PickOutcome> {
  const candidates = extractCommandCandidates(listing.source.text);
  if (candidates.length === 0) return { status: 'none' };

  const isHtml = /<(?:html|body|main|article|pre)\b/i.test(listing.source.text);
  const context = (
    isHtml ? htmlToText(listing.source.text) : listing.source.text
  ).slice(0, 3000);

  const questions: Record<string, JevQuestion> = {};
  candidates.forEach((_, i) => {
    questions[`step_${i}`] = {
      type: 'noul',
      instructions:
        `Command c${i} is one a user runs to install, sign in to, configure, start, or connect THIS project's own MCP server ` +
        "(including the CLI or app that provides it; building from source counts when that is how users install it). Not: a command for a different project, a contributor's dev/test/lint step, an example of calling the server's tools, or an uninstall.",
      criteria: {
        true: 'A setup step for this server',
        false: 'Not a setup step for this server',
      },
    };
    questions[`role_${i}`] = {
      type: 'choice',
      instructions: `What does command c${i} do?`,
      criteria: { ...ROLES },
    };
  });

  const res = await askJev(
    {
      name: listing.name,
      url: listing.url,
      description: listing.description.slice(0, 500),
      source: listing.source.url,
      page: context,
      commands: candidates.map((c, i) => `c${i}: ${c.slice(0, 400)}`),
    },
    questions,
  );
  if (!res) return { status: 'unavailable' };

  const steps: SetupStep[] = [];
  let essential = false;
  candidates.forEach((command, i) => {
    const step = res.answers[`step_${i}`];
    if (step?.type !== 'noul' || typeof step.noul !== 'number') return;
    if (step.noul < STEP_FLOOR) return;
    const role = confidentChoice(
      res.answers[`role_${i}`],
      ROLE_FLOOR,
    ) as Role | null;
    const knownRole = role && role in ROLES ? role : null;
    if (knownRole && ESSENTIAL_ROLES.has(knownRole)) essential = true;
    steps.push({ label: stepLabel(knownRole, command), command });
  });
  if (!essential || steps.length === 0) return { status: 'none' };
  return { status: 'ok', steps: steps.slice(0, SETUP_LIMITS.maxSteps) };
}

const DOCS_MAX_BYTES = 600_000;
const DOCS_TIMEOUT_MS = 10_000;

/** A public docs page's HTML, or null (non-HTML, blocked host, error, too big). */
async function fetchDocsPage(url: string): Promise<string | null> {
  if (!isSafeSubmissionUrl(url)) return null;
  try {
    const res = await safeFetch(url, {
      headers: {
        'User-Agent': 'AllMCPsBot/1.0 (+https://allmcps.com/about)',
        Accept: 'text/html,text/plain;q=0.9',
      },
      signal: AbortSignal.timeout(DOCS_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!/text\/(?:html|plain|markdown)/i.test(type)) return null;
    const text = await res.text();
    return text.length > DOCS_MAX_BYTES ? text.slice(0, DOCS_MAX_BYTES) : text;
  } catch {
    return null;
  }
}

function isRepoHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /(^|\.)(github\.com|gitlab\.com|bitbucket\.org)$/.test(host);
  } catch {
    return false;
  }
}

/**
 * Where a listing's setup steps live: the GitHub README, else the first
 * non-repo page among url / websiteUrl / supportUrl that has command blocks.
 */
export async function fetchSetupSource(
  listing: {
    url: string;
    websiteUrl?: string | null;
    supportUrl?: string | null;
  },
  githubToken?: string | null,
): Promise<SetupSource | null> {
  const gh = parseGithubUrl(listing.url);
  if (gh) {
    const readme = await fetchGithubReadme(gh.owner, gh.repo, githubToken, gh);
    if (readme && extractCommandCandidates(readme).length > 0) {
      return { text: readme, url: listing.url };
    }
  }
  const pages = [listing.url, listing.supportUrl, listing.websiteUrl]
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .filter((u) => !isRepoHost(u));
  for (const page of [...new Set(pages)].slice(0, 2)) {
    const html = await fetchDocsPage(page);
    if (html && extractCommandCandidates(html).length > 0) {
      return { text: html, url: page };
    }
  }
  return null;
}
