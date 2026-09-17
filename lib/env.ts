import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Universal environment variable accessor that safely falls back between
 * Cloudflare Worker bindings (ctx.env) and Node.js process.env, sanitizing quotes.
 */
export async function getEnv(name: string): Promise<string | undefined> {
  try {
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any)[name]) {
      const val = (ctx.env as any)[name];
      if (typeof val === 'string' && val.trim()) {
        return val.trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* fall back to process.env */
  }

  const val = process.env[name];
  if (typeof val === 'string' && val.trim()) {
    return val.trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}
