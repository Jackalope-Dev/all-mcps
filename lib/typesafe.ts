/**
 * TypeSafe (Jev) System One client — fast structured decisions.
 *
 * Jev answers typed questions (choice / score / noul) and returns values plus
 * probabilities, rather than prose we would have to parse. It is used here for
 * the decisions this codebase previously made with first-match-wins regexes or
 * an LLM: which category a listing belongs to, whether a repo really implements
 * an MCP server, whether two listings are the same project.
 *
 * Every call in this module is **best-effort and never throws**. A missing key,
 * a timeout, a 429, a malformed body — all resolve to `null`, and every caller
 * is required to fall back to the deterministic behaviour it had before. That
 * is the whole contract: Jev may improve an answer, it may never be the reason
 * an ingest run or a cron fails.
 *
 * Multiple questions ride in one request. The API answers them together at
 * roughly the cost of one, so callers should batch related questions about the
 * same subject rather than issuing a call per question.
 */

import { getEnv } from './env';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';

/** Observed p50 is ~150ms; this is a ceiling for a hung connection, not a target. */
const TIMEOUT_MS = 8000;
/** 429/529 are the documented retryable statuses. Two retries, then give up and fall back. */
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 250;

export type JevChoiceQuestion = {
  type: 'choice';
  instructions: string;
  /** Option key -> optional description. Keys come back verbatim in `choice`. */
  criteria: Record<string, string | null>;
};

export type JevNoulQuestion = {
  type: 'noul';
  instructions: string;
  criteria?: { true?: string; false?: string };
};

export type JevScoreQuestion = {
  type: 'score';
  instructions: string;
  /** Ordered levels, lowest first. */
  criteria: string[];
};

export type JevQuestion =
  | JevChoiceQuestion
  | JevNoulQuestion
  | JevScoreQuestion;

export type JevAnswer = {
  type: 'choice' | 'noul' | 'score';
  /** choice only — the winning option key. */
  choice?: string;
  /** noul only — truth probability, 0..1. */
  noul?: number;
  /** score only — position across the criteria levels. */
  score?: number;
  /** choice/score only — how sure the model is, 0..1. */
  confidence?: number;
  probabilities?: Record<string, number>;
  legend?: Record<string, string>;
};

export type JevResponse = {
  model: string;
  answers: Record<string, JevAnswer>;
  usage?: { input_tokens: number; output_tokens: number };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when a key is configured, so callers can skip building a request body. */
export async function isJevConfigured(): Promise<boolean> {
  const key = await getEnv('TYPESAFE_API_KEY');
  return typeof key === 'string' && key.length > 0;
}

/**
 * Ask Jev one or more questions about a single subject.
 *
 * Returns `null` for every failure mode — unset key, timeout, HTTP error,
 * unparseable body. Callers must treat `null` as "use the old behaviour".
 */
export async function askJev(
  state: unknown,
  questions: Record<string, JevQuestion>,
): Promise<JevResponse | null> {
  const key = await getEnv('TYPESAFE_API_KEY');
  if (!key) return null;
  if (Object.keys(questions).length === 0) return null;

  const body = JSON.stringify({ model: MODEL, state, questions });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      });

      if (res.ok) {
        const json = (await res.json()) as JevResponse;
        if (!json || typeof json !== 'object' || !json.answers) {
          console.error('[jev] response had no answers object');
          return null;
        }
        return json;
      }

      // 429/529 are worth another go; everything else is ours to fix, not retry.
      if (res.status !== 429 && res.status !== 529) {
        console.error(
          `[jev] HTTP ${res.status} — falling back to deterministic behaviour`,
        );
        return null;
      }
      if (attempt === MAX_RETRIES) {
        console.error(`[jev] HTTP ${res.status} after ${attempt + 1} attempts`);
        return null;
      }
      await sleep(RETRY_BASE_MS * 2 ** attempt);
    } catch (e: unknown) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      if (attempt === MAX_RETRIES) {
        console.error(
          `[jev] ${aborted ? `timed out after ${TIMEOUT_MS}ms` : 'request failed'}:`,
          e,
        );
        return null;
      }
      await sleep(RETRY_BASE_MS * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

/**
 * A choice answer, but only when the model is sure enough to act on it.
 *
 * Confidence on this API tracks genuine ambiguity closely — an unmistakable
 * listing comes back at 0.96+, a vague one at 0.3 — so a threshold is the
 * difference between "replaced a regex" and "shuffled listings at random".
 */
export function confidentChoice(
  answer: JevAnswer | undefined,
  minConfidence: number,
): string | null {
  if (!answer || answer.type !== 'choice') return null;
  if (typeof answer.choice !== 'string' || !answer.choice) return null;
  if (typeof answer.confidence !== 'number') return null;
  return answer.confidence >= minConfidence ? answer.choice : null;
}

/** A noul answer above/below a probability threshold, or null when unusable. */
export function noulVerdict(
  answer: JevAnswer | undefined,
  trueAtOrAbove: number,
): boolean | null {
  if (!answer || answer.type !== 'noul') return null;
  if (typeof answer.noul !== 'number') return null;
  return answer.noul >= trueAtOrAbove;
}
