import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// R2-backed ISR cache (binding: NEXT_INC_CACHE_R2_BUCKET, see wrangler.jsonc) so
// revalidate-based pages (e.g. app/mcp/[id], app/best/[topic], app/clients/[client],
// app/categories/[slug]) actually persist across requests instead of every request
// past the generateStaticParams set re-rendering from scratch. tagCache is left as
// the default ("dummy") — this codebase never calls revalidateTag/revalidatePath, so
// there's nothing for a real tag cache to do.
//
// queue: "direct" is required alongside the R2 cache — without it, `queue`
// silently defaults to "dummy", whose .send() unconditionally throws ("Dummy
// queue is not implemented"). Confirmed in practice: every stale-page hit
// site-wide was hitting that throw (logged as "Failed to revalidate stale
// page"), meaning R2-cached pages never actually refreshed in the background
// once first cached. "direct" uses the WORKER_SELF_REFERENCE service binding
// (see wrangler.jsonc) to self-trigger regeneration — OpenNext's own docs
// call it "not recommended" only at very high scale/traffic; fine here.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: "direct",
});
