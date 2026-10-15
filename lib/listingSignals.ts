/**
 * Jev judgments for closed-set listing fields: website/logo among candidates,
 * install command among regex hits, auth and pricing. Fail-soft — null means
 * keep the deterministic path.
 */

import { DIRECTORY_CATEGORIES } from './categories';
import { packageBelongsElsewhere } from './packageRegistry';
import { manifestInstallCandidates } from './repoManifest';
import {
  type AuthType,
  isAuthType,
  isPricingModel,
  type PricingModel,
} from './serverEnums';
import {
  collectInstallCandidates,
  isRemoteHint,
  type ParsedInstallHint,
} from './tools/parseInstallHint';
import {
  askJev,
  confidentChoice,
  type JevChoiceQuestion,
  noulVerdict,
} from './typesafe';

const CHOICE_FLOOR = 0.75;

function optionKey(category: string): string {
  return category.replace(/^[^\p{L}]+/u, '').trim();
}

const KEY_TO_CATEGORY = new Map(
  DIRECTORY_CATEGORIES.map((c) => [optionKey(c), c] as const),
);

export type ListingSignalInput = {
  name?: string | null;
  description?: string | null;
  url?: string | null;
  readme?: string | null;
};

export type ListingFieldSignals = {
  category: string | null;
  pricingModel: PricingModel | null;
  authType: AuthType | null;
};

export async function classifyListingFields(
  listing: ListingSignalInput,
): Promise<ListingFieldSignals> {
  const empty: ListingFieldSignals = {
    category: null,
    pricingModel: null,
    authType: null,
  };
  if (!listing.name && !listing.description && !listing.readme) return empty;

  const categoryCriteria: Record<string, string | null> = Object.fromEntries(
    DIRECTORY_CATEGORIES.map((c) => [optionKey(c), null]),
  );
  const pricingCriteria: Record<string, string | null> = {
    free: 'Open source or free to use with no paid API key required',
    freemium: 'Free tier plus a paid upgrade',
    paid: 'Paid service only',
    byok: "Requires the user's own paid API key (OpenAI, GitHub, etc.)",
  };
  const authCriteria: Record<string, string | null> = {
    none: 'No credentials required',
    api_key: 'API key or token',
    oauth: 'OAuth',
    other: 'Some other auth scheme',
  };

  const res = await askJev(
    {
      name: listing.name ?? '',
      description: listing.description ?? '',
      url: listing.url ?? '',
      readme: (listing.readme ?? '').slice(0, 4000),
    },
    {
      category: {
        type: 'choice',
        instructions:
          'Which directory category best fits this Model Context Protocol (MCP) server?',
        criteria: categoryCriteria,
      } satisfies JevChoiceQuestion,
      pricing: {
        type: 'choice',
        instructions: 'What is the cost model of *using* this MCP server?',
        criteria: pricingCriteria,
      } satisfies JevChoiceQuestion,
      auth: {
        type: 'choice',
        instructions: 'What credentials does this MCP server require?',
        criteria: authCriteria,
      } satisfies JevChoiceQuestion,
    },
  );
  if (!res) return empty;

  const categoryKey = confidentChoice(res.answers.category, CHOICE_FLOOR);
  const pricingKey = confidentChoice(res.answers.pricing, CHOICE_FLOOR);
  const authKey = confidentChoice(res.answers.auth, CHOICE_FLOOR);

  return {
    category: categoryKey ? (KEY_TO_CATEGORY.get(categoryKey) ?? null) : null,
    pricingModel: pricingKey && isPricingModel(pricingKey) ? pricingKey : null,
    authType: authKey && isAuthType(authKey) ? authKey : null,
  };
}

function hintLabel(
  hint: NonNullable<ParsedInstallHint>,
  fromManifest = false,
): string {
  if (isRemoteHint(hint)) return `remote ${hint.url}`;
  const command = `${hint.command} ${hint.args.join(' ')}`.trim();
  return fromManifest
    ? `${command} (package published from this repo's manifest)`
    : command;
}

export async function pickInstallCommand(
  listing: ListingSignalInput,
): Promise<NonNullable<ParsedInstallHint> | null> {
  const text = `${listing.description || ''}\n${listing.readme || ''}`;
  const all = collectInstallCandidates(text);
  const [foreign, manifest] = await Promise.all([
    // Drop what the registry proves is some other project's package before
    // Jev sees it (see packageBelongsElsewhere).
    Promise.all(
      all.map(
        (hint) =>
          !isRemoteHint(hint) &&
          packageBelongsElsewhere(
            hint.command,
            hint.package || hint.args[hint.args.length - 1],
            listing.url,
          ),
      ),
    ),
    manifestInstallCandidates(listing.url),
  ]);
  const fromReadme = all.filter((_, i) => !foreign[i]);
  const readmePackages = new Set(
    fromReadme.map((h) =>
      isRemoteHint(h) ? h.url : h.package || h.args[h.args.length - 1],
    ),
  );
  // The repo's own published package, when the README never spelled it out.
  // After the README's so Jev-unavailable fallback keeps preferring those.
  const fromManifest = manifest.filter(
    (h) => !readmePackages.has(h.package || h.args[h.args.length - 1]),
  );
  const candidates = [...fromReadme, ...fromManifest];
  // A sole candidate still goes to Jev, which can answer "none": READMEs
  // often hold exactly one command and it's another project's (an example
  // config, a catalog entry) with no registry metadata to disprove it.
  if (candidates.length === 0) return null;

  const criteria: Record<string, string | null> = {
    none: 'None of these run THIS server',
  };
  const byKey = new Map<string, NonNullable<ParsedInstallHint>>();
  const labels = candidates.map((hint, i) =>
    hintLabel(hint, i >= fromReadme.length),
  );
  candidates.forEach((hint, i) => {
    const key = `c${i}`;
    byKey.set(key, hint);
    criteria[key] = labels[i];
  });

  const res = await askJev(
    {
      name: listing.name ?? '',
      url: listing.url ?? '',
      candidates: labels,
      readme: (listing.readme ?? listing.description ?? '').slice(0, 4000),
    },
    {
      install: {
        type: 'choice',
        instructions:
          "Which command launches THIS project's own MCP server? Not a third-party installer, inspector, or a different server mentioned as an example.",
        criteria,
      } satisfies JevChoiceQuestion,
    },
  );
  if (!res) return candidates[0];
  const picked = confidentChoice(res.answers.install, CHOICE_FLOOR);
  if (!picked || picked === 'none') return null;
  return byKey.get(picked) ?? null;
}

/**
 * Below this, Jev is confident the tools belong to a different server. Kept
 * low because a wrong "doesn't fit" throws away a real verified tool list;
 * the case it exists for is blatant (an offers-search listing showing BotHire's
 * wallet and hiring tools after its install pointed at BotHire's package).
 */
const TOOLS_FIT_FLOOR = 0.15;

/**
 * Whether tools seen in a sandbox run plausibly belong to this listing.
 * False only on a confident mismatch; null when Jev is unavailable or there
 * is nothing to compare — callers keep their current behaviour on null.
 */
export async function toolsFitListing(
  listing: ListingSignalInput,
  tools: { name: string; description?: string }[],
): Promise<boolean | null> {
  if (tools.length === 0 || !(listing.name || listing.description)) return null;
  const res = await askJev(
    {
      name: listing.name ?? '',
      description: listing.description ?? '',
      url: listing.url ?? '',
      tools: tools
        .slice(0, 40)
        .map((t) => `${t.name}: ${(t.description ?? '').slice(0, 160)}`),
    },
    {
      fits: {
        type: 'noul',
        instructions:
          "These tools were reported by running this listing's install command. They plausibly belong to the server this listing describes, rather than to a different, unrelated product.",
        criteria: {
          true: 'The tools fit what the listing says the server does',
          false: 'The tools belong to a different, unrelated server',
        },
      },
    },
  );
  return res ? noulVerdict(res.answers.fits, TOOLS_FIT_FLOOR) : null;
}

export async function pickBestWebsiteAndLogo(input: {
  readmeSnippet: string;
  ghOwner: string;
  ghRepo: string;
  candidateUrls: string[];
  candidateImages: string[];
}): Promise<{ websiteUrl?: string; logoUrl?: string } | null> {
  if (!input.candidateUrls.length && !input.candidateImages.length) return null;

  const questions: Record<string, JevChoiceQuestion> = {};
  const urlByKey = new Map<string, string>();
  const imgByKey = new Map<string, string>();

  if (input.candidateUrls.length > 0) {
    const criteria: Record<string, string | null> = {
      none: 'None of these is the official project website',
    };
    input.candidateUrls.slice(0, 8).forEach((url, i) => {
      const key = `u${i}`;
      urlByKey.set(key, url);
      criteria[key] = url;
    });
    questions.website = {
      type: 'choice',
      instructions:
        'Which URL is the official marketing or documentation website for this MCP server? Pick only from the list.',
      criteria,
    };
  }
  if (input.candidateImages.length > 0) {
    const criteria: Record<string, string | null> = {
      none: 'None of these is the project logo',
    };
    input.candidateImages.slice(0, 8).forEach((url, i) => {
      const key = `i${i}`;
      imgByKey.set(key, url);
      criteria[key] = url;
    });
    questions.logo = {
      type: 'choice',
      instructions:
        'Which image is the main project logo? Pick only from the list.',
      criteria,
    };
  }

  const res = await askJev(
    {
      repository: `${input.ghOwner}/${input.ghRepo}`,
      readme: input.readmeSnippet.slice(0, 1500),
      candidateUrls: input.candidateUrls,
      candidateImages: input.candidateImages,
    },
    questions,
  );
  if (!res) return null;

  const out: { websiteUrl?: string; logoUrl?: string } = {};
  const websiteKey = confidentChoice(res.answers.website, CHOICE_FLOOR);
  if (websiteKey && websiteKey !== 'none') {
    const url = urlByKey.get(websiteKey);
    if (url && input.candidateUrls.includes(url)) out.websiteUrl = url;
  }
  const logoKey = confidentChoice(res.answers.logo, CHOICE_FLOOR);
  if (logoKey && logoKey !== 'none') {
    const url = imgByKey.get(logoKey);
    if (url && input.candidateImages.includes(url)) out.logoUrl = url;
  }
  return Object.keys(out).length ? out : null;
}

/** @deprecated Name kept for enrich-cron call sites; implementation is Jev. */
export const pickBestWebsiteAndLogoWithLlm = pickBestWebsiteAndLogo;

export function installHintToCache(hint: NonNullable<ParsedInstallHint>): {
  installKind: 'stdio' | 'remote';
  installCommand: string | null;
  installArgs: string | null;
  installPackage: string | null;
  installConfidence: 'high' | 'medium';
} {
  if (isRemoteHint(hint)) {
    return {
      installKind: 'remote',
      installCommand: null,
      installArgs: null,
      installPackage: hint.url,
      installConfidence: 'high',
    };
  }
  return {
    installKind: 'stdio',
    installCommand: hint.command,
    installArgs:
      hint.args && hint.args.length > 0 ? JSON.stringify(hint.args) : null,
    installPackage: hint.package || hint.args[hint.args.length - 1] || null,
    installConfidence: 'high',
  };
}
