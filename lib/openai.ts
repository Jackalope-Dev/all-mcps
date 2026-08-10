/**
 * Lightweight OpenAI Chat Completions client for Worker/Node.
 *
 * Budget is hard-capped at the OpenAI account level — any 4xx (especially 429
 * rate limit / insufficient_quota, 402/403 billing) must fail soft so product
 * flows never 500 because the LLM is unavailable. Callers always get a
 * discriminated result and keep a deterministic fallback path.
 */

import { getEnv } from './env';

export type OpenAIChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type OpenAIChatSuccess = {
  ok: true;
  content: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export type OpenAIChatFailure = {
  ok: false;
  /** Machine-readable reason for branching / metrics */
  reason:
    | 'not_configured'
    | 'budget_or_rate_limit'
    | 'auth'
    | 'invalid_request'
    | 'timeout'
    | 'upstream'
    | 'empty';
  status?: number;
  message: string;
  /** True when the caller should not immediately retry (quota, auth, bad request). */
  retryable: boolean;
};

export type OpenAIChatResult = OpenAIChatSuccess | OpenAIChatFailure;

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-5.6-luna';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * GPT-5-family models (confirmed against gpt-5.6-luna in practice: every call
 * failed until this was added) reject the legacy `max_tokens` param — they
 * require `max_completion_tokens` — and only accept the default temperature,
 * erroring on any explicit value. Older families (4.1-mini, 4o, etc.) are the
 * reverse: they expect `max_tokens` and support custom temperature.
 */
const GPT5_FAMILY_RE = /^gpt-5/i;

/** Status codes that mean "stop spending / don't hammer" rather than transient blips. */
function classifyHttpStatus(status: number): Pick<OpenAIChatFailure, 'reason' | 'retryable'> {
  if (status === 401 || status === 403) {
    return { reason: 'auth', retryable: false };
  }
  // 402 Payment Required, 429 rate/quota — treat as budget wall
  if (status === 402 || status === 429) {
    return { reason: 'budget_or_rate_limit', retryable: false };
  }
  if (status === 400 || status === 404 || status === 422) {
    return { reason: 'invalid_request', retryable: false };
  }
  // 408/5xx — transient
  return { reason: 'upstream', retryable: status >= 500 || status === 408 };
}

function messageLooksLikeQuota(bodyText: string): boolean {
  const lower = bodyText.toLowerCase();
  return (
    lower.includes('insufficient_quota') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('billing') ||
    lower.includes('budget') ||
    lower.includes('rate_limit') ||
    lower.includes('rate limit')
  );
}

/**
 * Resolve OpenAI API key from Worker secrets or process.env.
 * Accepts OPEN_AI_API_KEY (project convention) or OPENAI_API_KEY.
 */
export async function getOpenAIApiKey(): Promise<string | undefined> {
  return (
    (await getEnv('OPEN_AI_API_KEY')) ||
    (await getEnv('OPENAI_API_KEY')) ||
    undefined
  );
}

export type ChatCompletionOptions = {
  messages: OpenAIChatMessage[];
  /** Any OpenAI chat model id the account can access. Defaults to gpt-5.6-luna. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Abort after this many ms. Default 20s. */
  timeoutMs?: number;
  /** JSON mode when the model supports it. */
  json?: boolean;
};

/**
 * Call OpenAI chat completions. Never throws for API/budget errors — only for
 * programmer mistakes (e.g. empty messages). Safe to call from request handlers
 * and crons without try/catch for spend failures.
 */
export async function chatCompletion(options: ChatCompletionOptions): Promise<OpenAIChatResult> {
  if (!options.messages?.length) {
    return {
      ok: false,
      reason: 'invalid_request',
      message: 'messages required',
      retryable: false,
    };
  }

  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    return {
      ok: false,
      reason: 'not_configured',
      message: 'OPEN_AI_API_KEY / OPENAI_API_KEY not configured',
      retryable: false,
    };
  }

  const model = options.model || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const isGpt5Family = GPT5_FAMILY_RE.test(model);
  const maxTokens = options.maxTokens ?? 1024;

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        ...(isGpt5Family
          ? { max_completion_tokens: maxTokens }
          : { temperature: options.temperature ?? 0.2, max_tokens: maxTokens }),
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const classified = classifyHttpStatus(res.status);
      // Some quota failures arrive as 400/403 with a quota-shaped body
      const quotaShaped = messageLooksLikeQuota(rawText);
      const reason = quotaShaped ? 'budget_or_rate_limit' : classified.reason;
      const errMsg =
        (data && (data.error?.message || data.message)) ||
        rawText.slice(0, 280) ||
        `OpenAI HTTP ${res.status}`;

      console.warn('openai.chat_completion_failed', {
        status: res.status,
        reason,
        model,
      });

      return {
        ok: false,
        reason,
        status: res.status,
        message: errMsg,
        retryable: quotaShaped ? false : classified.retryable,
      };
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return {
        ok: false,
        reason: 'empty',
        status: res.status,
        message: 'OpenAI returned an empty completion',
        retryable: true,
      };
    }

    return {
      ok: true,
      content: content.trim(),
      model: data?.model || model,
      usage: data?.usage,
    };
  } catch (e: any) {
    const name = e?.name || '';
    const isTimeout = name === 'TimeoutError' || name === 'AbortError';
    console.warn('openai.chat_completion_error', { name, isTimeout, model });
    return {
      ok: false,
      reason: isTimeout ? 'timeout' : 'upstream',
      message: isTimeout ? 'OpenAI request timed out' : e?.message || 'OpenAI request failed',
      retryable: true,
    };
  }
}

/**
 * Convenience: ask for a short JSON object. Returns null on any soft failure
 * (budget, timeout, bad JSON) so callers stay simple.
 */
export async function chatJson<T = Record<string, unknown>>(
  options: Omit<ChatCompletionOptions, 'json'>
): Promise<{ ok: true; data: T; model: string } | OpenAIChatFailure> {
  const result = await chatCompletion({ ...options, json: true });
  if (!result.ok) return result;
  try {
    const data = JSON.parse(result.content) as T;
    return { ok: true, data, model: result.model };
  } catch {
    return {
      ok: false,
      reason: 'empty',
      message: 'OpenAI returned non-JSON content',
      retryable: true,
    };
  }
}
