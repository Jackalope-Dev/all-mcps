import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import type { NextConfig } from 'next';

// `next build` (SSG for /mcp/[id] etc.) only needs D1 + R2 via getCloudflareContext().
// Point getPlatformProxy at a trimmed config with no `ai` / `vectorize` / service
// bindings and remoteBindings disabled outright — none of those have local
// emulation, so leaving any of them reachable makes wrangler try to establish
// a real Cloudflare connection, which stalls the build (40s+) when it
// succeeds and fails closed entirely somewhere with no interactive wrangler
// login to fall back on, like CI (confirmed 2026-09-07). `next dev` keeps the
// full wrangler.jsonc so AI/Vectorize work locally.
//
// This used to key off `process.env.NEXT_PHASE === 'phase-production-build'`,
// which never actually matched (NEXT_PHASE is unset at next.config.ts
// evaluation time on this Next.js version) — so the trimmed config was dead
// code and every build silently ran on the full wrangler.jsonc instead,
// masked locally only because of a cached wrangler login. `npm run build`
// and `npm run dev` are this repo's only two entry points (enforced by the
// Definition of Done in AGENTS.md), so npm's own `npm_lifecycle_event` is a
// reliable signal here where NEXT_PHASE isn't.
initOpenNextCloudflareForDev(
  process.env.npm_lifecycle_event === 'build'
    ? { configPath: './wrangler.build.jsonc', remoteBindings: false }
    : undefined,
);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    useTypeScriptCli: true,
    optimizePackageImports: ['lucide-react'],
  },
  // @cf-wasm/photon's /workerd entrypoint does a raw ESM `.wasm` import that only
  // Cloudflare's own esbuild-based Worker bundler understands (not Next's webpack
  // compile step, which runs first). Leaving it external skips webpack bundling
  // for it entirely, so the wasm import passes through untouched to that later stage.
  serverExternalPackages: ['@cf-wasm/photon'],
  // /sitemap.xml itself can't be a route folder (it collides with the
  // app/sitemap.ts metadata convention's reserved slot), so the sitemap index
  // route lives at /sitemap-index.xml and is rewritten to the public URL here.
  async rewrites() {
    return [
      { source: '/sitemap.xml', destination: '/sitemap-index.xml' },
      { source: '/apple-touch-icon.png', destination: '/logo-icon.png' },
      {
        source: '/apple-touch-icon-precomposed.png',
        destination: '/logo-icon.png',
      },
    ];
  },
};

export default nextConfig;
