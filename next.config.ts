import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import type { NextConfig } from 'next';

initOpenNextCloudflareForDev();

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
