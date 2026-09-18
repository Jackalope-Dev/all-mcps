/**
 * Jev judgments for closed-set listing fields: website/logo among candidates,
 * install command among regex hits, auth and pricing. Fail-soft — null means
 * keep the deterministic path.
 */

import { DIRECTORY_CATEGORIES } from './categories';
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
import { askJev, confidentChoice, type JevChoiceQuestion } from './typesafe';

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

function hintLabel(hint: NonNullable<ParsedInstallHint>): string {
  if (isRemoteHint(hint)) return `remote ${hint.url}`;
  const pkg = hint.package || hint.args[hint.args.length - 1] || hint.command;
  return `${hint.command} ${pkg}`;
}

export async function pickInstallCommand(
  listing: ListingSignalInput,
): Promise<NonNullable<ParsedInstallHint> | null> {
  const text = `${listing.description || ''}\n${listing.readme || ''}`;
  const candidates = collectInstallCandidates(text);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const criteria: Record<string, string | null> = {
    none: 'None of these run THIS server',
  };
  const byKey = new Map<string, NonNullable<ParsedInstallHint>>();
  candidates.forEach((hint, i) => {
    const key = `c${i}`;
    byKey.set(key, hint);
    criteria[key] = hintLabel(hint);
  });

  const res = await askJev(
    {
      name: listing.name ?? '',
      url: listing.url ?? '',
      candidates: candidates.map(hintLabel),
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
