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
  /** Parsed FAQ pairs or raw JSON column — both accepted for cron/API callers. */
  aiFaq?: string | Array<{ q?: string; a?: string }> | null;
  tools?: string | any[] | null;
  tags?: string | string[] | null;
  license?: string | null;
  pricingModel?: string | null;
  authType?: string | null;
  compatibleClients?: string | string[] | null;
  maintenanceStatus?: string | null;
}): string {
  const parts: string[] = [
    `Name: ${server.name}`,
    `Category: ${server.category}`,
    `Description: ${server.description}`,
  ];

  if (server.aiSummary) parts.push(`Summary: ${server.aiSummary}`);
  if (server.aiOverview) parts.push(`Overview: ${server.aiOverview}`);

  if (server.tags) {
    const tags =
      typeof server.tags === 'string'
        ? safeParseJson<string[]>(server.tags, [])
        : server.tags;
    if (tags.length > 0) parts.push(`Tags: ${tags.join(', ')}`);
  }
  if (server.license) parts.push(`License: ${server.license}`);
  if (server.pricingModel) parts.push(`Pricing: ${server.pricingModel}`);
  if (server.authType) parts.push(`Auth: ${server.authType}`);
  if (server.maintenanceStatus)
    parts.push(`Maintenance: ${server.maintenanceStatus}`);
  if (server.compatibleClients) {
    const clients =
      typeof server.compatibleClients === 'string'
        ? safeParseJson<string[]>(server.compatibleClients, [])
        : server.compatibleClients;
    if (clients.length > 0)
      parts.push(`Compatible clients: ${clients.join(', ')}`);
  }

  if (server.aiUseCases) {
    const useCases =
      typeof server.aiUseCases === 'string'
        ? safeParseJson<string[]>(server.aiUseCases, [])
        : server.aiUseCases;
    if (useCases.length > 0) {
      parts.push(`Use Cases: ${useCases.join(', ')}`);
    }
  }

  if (server.aiFaq) {
    const faq =
      typeof server.aiFaq === 'string'
        ? safeParseJson<Array<{ q?: string; a?: string }>>(server.aiFaq, [])
        : server.aiFaq;
    if (Array.isArray(faq) && faq.length > 0) {
      const faqTexts = faq
        .map((item) => {
          if (!item || typeof item !== 'object') return '';
          const q = typeof item.q === 'string' ? item.q.trim() : '';
          const a = typeof item.a === 'string' ? item.a.trim() : '';
          if (q && a) return `Q: ${q} A: ${a}`;
          return q || a;
        })
        .filter(Boolean)
        .slice(0, 5);
      if (faqTexts.length > 0) {
        parts.push(`FAQ: ${faqTexts.join(' | ')}`);
      }
    }
  }

  if (server.aiFeatures) {
    const features =
      typeof server.aiFeatures === 'string'
        ? safeParseJson<string[]>(server.aiFeatures, [])
        : server.aiFeatures;
    if (features.length > 0) {
      parts.push(`Features: ${features.join(', ')}`);
    }
  }

  if (server.tools) {
    const toolsList =
      typeof server.tools === 'string'
        ? safeParseJson<Array<{ name?: string; description?: string }>>(
            server.tools,
            [],
          )
        : server.tools;
    if (Array.isArray(toolsList) && toolsList.length > 0) {
      const toolTexts = toolsList
        .map((t) =>
          t?.name
            ? `${t.name}${t.description ? `: ${t.description}` : ''}`
            : '',
        )
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
 * Cloudflare Vectorize rejects vector IDs longer than 64 bytes. Listing slugs
 * (server.id) are unbounded, so anything over the limit gets a deterministic
 * short surrogate; the real id rides in metadata.serverId and is mapped back on
 * query. Vectors already stored under a plain (short) id are unaffected.
 */
export async function toVectorId(id: string): Promise<string> {
  const bytes = new TextEncoder().encode(id);
  if (bytes.length <= 64) return id;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `h_${hex.slice(0, 60)}`;
}

/** Resolve a Vectorize match back to its listing id (surrogate-aware). */
export function resolveServerId(match: {
  id: string;
  metadata?: Record<string, unknown> | null;
}): string {
  const serverId = match.metadata?.serverId;
  return typeof serverId === 'string' && serverId ? serverId : match.id;
}

/**
 * Generate a 384-dimensional vector embedding for text using Workers AI.
 */
export async function generateEmbedding(
  text: string,
  env: CloudflareEnv,
): Promise<number[] | null> {
  if (!env?.AI) return null;
  try {
    const response: any = await (env.AI as any).run(
      '@cf/baai/bge-small-en-v1.5',
      {
        text: [text],
      },
    );

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
  topK = 50,
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
      id: resolveServerId(match),
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
  env: CloudflareEnv,
): Promise<boolean> {
  if (!env?.VECTOR_INDEX || !env?.AI) return false;

  const text = buildServerVectorText(server);
  const embedding = await generateEmbedding(text, env);
  if (!embedding) return false;

  try {
    await env.VECTOR_INDEX.upsert([
      {
        id: await toVectorId(String(server.id)),
        values: embedding,
        metadata: {
          serverId: String(server.id),
          name: String(server.name || '').slice(0, 256),
          category: String(server.category || '').slice(0, 100),
        },
      },
    ]);
    return true;
  } catch (error) {
    console.error(
      `[vectorSearch] Failed to upsert vector for server ${server.id}:`,
      error,
    );
    return false;
  }
}

/**
 * Upsert a batch of server embeddings into Cloudflare Vectorize.
 * Generates embeddings in bounded concurrent chunks and pushes all vectors in a batch upsert.
 */
export async function upsertServerEmbeddingsBatch(
  serverList: Array<
    Parameters<typeof buildServerVectorText>[0] & { id: string }
  >,
  env: CloudflareEnv,
  concurrency = 5,
): Promise<{ successfulIds: string[]; failedIds: string[] }> {
  if (!env?.VECTOR_INDEX || !env?.AI) {
    return { successfulIds: [], failedIds: serverList.map((s) => s.id) };
  }

  const successfulIds: string[] = [];
  const failedIds: string[] = [];
  const vectorsToUpsert: Array<{
    id: string;
    values: number[];
    metadata: { serverId: string; name: string; category: string };
  }> = [];

  // Generate embeddings in concurrency-limited chunks
  for (let i = 0; i < serverList.length; i += concurrency) {
    const chunk = serverList.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (server) => {
        const text = buildServerVectorText(server);
        const embedding = await generateEmbedding(text, env);
        if (embedding) {
          return {
            id: await toVectorId(String(server.id)),
            values: embedding,
            metadata: {
              serverId: String(server.id),
              name: String(server.name || '').slice(0, 256),
              category: String(server.category || '').slice(0, 100),
            },
          };
        }
        return null;
      }),
    );

    results.forEach((item, idx) => {
      if (item) {
        vectorsToUpsert.push(item);
      } else {
        failedIds.push(chunk[idx].id);
      }
    });
  }

  if (vectorsToUpsert.length === 0) {
    return { successfulIds: [], failedIds };
  }

  try {
    // Vectorize supports batch upserts up to 1,000 vectors in a single call
    await env.VECTOR_INDEX.upsert(vectorsToUpsert);
    successfulIds.push(...vectorsToUpsert.map((v) => v.metadata.serverId));
  } catch (batchError) {
    console.error(
      '[vectorSearch] Batch upsert failed, attempting individual fallbacks:',
      batchError,
    );
    // Fall back to individual upserts to isolate any problematic vector
    for (const vec of vectorsToUpsert) {
      try {
        await env.VECTOR_INDEX.upsert([vec]);
        successfulIds.push(vec.metadata.serverId);
      } catch (indError) {
        console.error(
          `[vectorSearch] Failed to upsert vector for server ${vec.metadata.serverId}:`,
          indError,
        );
        failedIds.push(vec.metadata.serverId);
      }
    }
  }

  return { successfulIds, failedIds };
}
