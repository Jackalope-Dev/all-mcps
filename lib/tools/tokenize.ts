import { encode } from 'gpt-tokenizer';

/** Approximate token count using a GPT-4-class tokenizer. Callers must present this as an estimate, not an exact count for every model. */
export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/** Accepts a raw tools/list JSON-RPC response, a {tools:[...]} object, or a bare array of tool schemas. */
export function extractTools(parsed: unknown): ToolSchema[] {
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (t): t is ToolSchema =>
        !!t &&
        typeof t === 'object' &&
        typeof (t as Record<string, unknown>).name === 'string',
    );
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.tools)) return extractTools(obj.tools);
    if (obj.result && typeof obj.result === 'object') {
      return extractTools((obj.result as Record<string, unknown>).tools);
    }
  }
  return [];
}

export interface ToolTokenBreakdown {
  name: string;
  tokens: number;
}

export function computeToolTokens(tools: ToolSchema[]): {
  breakdown: ToolTokenBreakdown[];
  total: number;
} {
  const breakdown = tools.map((tool) => {
    const serialized = JSON.stringify({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || {},
    });
    return { name: tool.name, tokens: countTokens(serialized) };
  });
  const total = breakdown.reduce((sum, t) => sum + t.tokens, 0);
  return { breakdown, total };
}
