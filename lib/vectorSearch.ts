/**
 * Helper library for Cloudflare Vectorize semantic search & Workers AI embeddings.
 */

export type VectorSearchResult = {
  id: string;
  score: number;
};

/**
 * Format an MCP server listing into a rich semantic string for vector embedding.
 */
export function buildServerVectorText(server: {
  name: string;
  category: string;
  description: string;
  aiSummary?: string | null;
  aiOverview?: string | null;
  aiUseCases?: string | string[] | null;
  aiFeatures?: string | string[] | null;
  tools?: string | any[] | null;
}): string {
  const parts: string[] = [
    `Name: ${server.name}`,
    `Category: ${server.category}`,
    `Description: ${server.description}`,
  ];

  if (server.aiSummary) parts.push(`Summary: ${server.aiSummary}`);
  if (server.aiOverview) parts.push(`Overview: ${server.aiOverview}`);

  if (server.aiUseCases) {
    const useCases = typeof server.aiUseCases === 'string'
      ? safeParseJson<string[]>(server.aiUseCases, [])
      : server.aiUseCases;
    if (useCases.length > 0) {
      parts.push(`Use Cases: ${useCases.join(', ')}`);
    }
  }

  if (server.aiFeatures) {
    const features = typeof server.aiFeatures === 'string'
      ? safeParseJson<string[]>(server.aiFeatures, [])
      : server.aiFeatures;
    if (features.length > 0) {
      parts.push(`Features: ${features.join(', ')}`);
    }
  }

  if (server.tools) {
    const toolsList = typeof server.tools === 'string'
      ? safeParseJson<Array<{ name?: string; description?: string }>>(server.tools, [])
      : server.tools;
    if (Array.isArray(toolsList) && toolsList.length > 0) {
      const toolTexts = toolsList
        .map((t) => (t?.name ? `${t.name}${t.description ? `: ${t.description}` : ''}` : ''))
        .filter(Boolean)
        .slice(0, 10);
      if (toolTexts.length > 0) {
        parts.push(`Tools: ${toolTexts.join('; ')}`);
      }
    }
  }

  return parts.join('\n').slice(0, 2000);
}

function safeParseJson<T>(jsonStr: string, fallback: T): T {
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}

/**
 * Generate a 384-dimensional vector embedding for text using Workers AI.
 */
export async function generateEmbedding(
  text: string,
  env: CloudflareEnv
): Promise<number[] | null> {
  if (!env?.AI) return null;
  try {
    const response: any = await (env.AI as any).run('@cf/baai/bge-small-en-v1.5', {
      text: [text],
    });

    if (response?.data?.[0]) {
      return response.data[0];
    }
    return null;
  } catch (error) {
    console.error('[vectorSearch] Failed to generate embedding:', error);
    return null;
  }
}

/**
 * Query Vectorize index for natural language matches.
 */
export async function queryVectorIndex(
  query: string,
  env: CloudflareEnv,
  topK = 50
): Promise<VectorSearchResult[]> {
  if (!env?.VECTOR_INDEX || !env?.AI) return [];

  const embedding = await generateEmbedding(query, env);
  if (!embedding) return [];

  try {
    const results = await env.VECTOR_INDEX.query(embedding, {
      topK,
      returnMetadata: 'all',
    });

    return (results.matches || []).map((match) => ({
      id: match.id,
      score: match.score,
    }));
  } catch (error) {
    console.error('[vectorSearch] Query failed:', error);
    return [];
  }
}

/**
 * Upsert a single server's vector embedding into Cloudflare Vectorize.
 */
export async function upsertServerEmbedding(
  server: Parameters<typeof buildServerVectorText>[0] & { id: string },
  env: CloudflareEnv
): Promise<boolean> {
  if (!env?.VECTOR_INDEX || !env?.AI) return false;

  const text = buildServerVectorText(server);
  const embedding = await generateEmbedding(text, env);
  if (!embedding) return false;

  try {
    await env.VECTOR_INDEX.upsert([
      {
        id: server.id,
        values: embedding,
        metadata: {
          name: server.name,
          category: server.category,
        },
      },
    ]);
    return true;
  } catch (error) {
    console.error(`[vectorSearch] Failed to upsert vector for server ${server.id}:`, error);
    return false;
  }
}
