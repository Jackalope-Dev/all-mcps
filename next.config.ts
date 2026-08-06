import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: true,
  },
  // @cf-wasm/photon's /workerd entrypoint does a raw ESM `.wasm` import that only
  // Cloudflare's own esbuild-based Worker bundler understands (not Next's webpack
  // compile step, which runs first). Leaving it external skips webpack bundling
  // for it entirely, so the wasm import passes through untouched to that later stage.
  serverExternalPackages: ['@cf-wasm/photon'],
};

export default nextConfig;
