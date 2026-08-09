import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// R2-backed ISR cache (binding: NEXT_INC_CACHE_R2_BUCKET, see wrangler.jsonc) so
// revalidate-based pages (e.g. app/mcp/[id], app/best/[topic], app/clients/[client],
// app/categories/[slug]) actually persist across requests instead of every request
// past the generateStaticParams set re-rendering from scratch. tagCache is left as
// the default ("dummy") — this codebase never calls revalidateTag/revalidatePath, so
// there's nothing for a real tag cache to do.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
