import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import memoryQueue from '@opennextjs/cloudflare/overrides/queue/memory-queue';

// R2-backed ISR cache (binding: NEXT_INC_CACHE_R2_BUCKET, see wrangler.jsonc) so
// revalidate-based pages (e.g. app/mcp/[id], app/best/[topic], app/clients/[client],
// app/categories/[slug]) actually persist across requests instead of every request
// past the generateStaticParams set re-rendering from scratch. tagCache is left as
// the default ("dummy") — this codebase never calls revalidateTag/revalidatePath, so
// there's nothing for a real tag cache to do.
//
// A real queue is required alongside the R2 cache. The default ("dummy") throws
// on every stale hit, and "direct" (used here until 2026-10) revalidates with a
// plain global fetch() to https://allmcps.com/..., which never re-enters this
// Worker — so stale pages were served forever (listings showed missing logos,
// nofollow on links that had earned dofollow, week-old health checks).
// memoryQueue sends the revalidation HEAD through the WORKER_SELF_REFERENCE
// service binding (see wrangler.jsonc), de-duped per isolate.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: memoryQueue,
});
