<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Brand & Styling Rules
When working on UI, design, or layout tasks, please refer to the [BRAND_GUIDE.md](./BRAND_GUIDE.md) to ensure consistency with our established colors, typography, and logo assets.

# Blog Posts

Blog posts live at `content/blog/YYYY-MM-DD-slug.md` — one markdown file per post. The filename's date prefix and slug are the source of truth; there's no separate `date` field in frontmatter.

Frontmatter schema:

```yaml
---
title: "Post title"
excerpt: "One-sentence summary — used in listing cards, the meta description, and the RSS feed."
tags: ["Tag One", "Tag Two"]
faq: # optional — omit if the post has no FAQ section
  - q: "Question?"
    a: "Answer."
---
```

Guidelines:
- Long-form and educational, ~800+ words minimum.
- Structure the body with `##` headings — they auto-build the table of contents. Keep heading text plain (no bold/italic/inline code inside a `##` line) since headings are converted straight to HTML for anchor linking.
- 2-5 tags; tags automatically populate the filter chips and search on `/blog`.
- The `faq` block, if present, renders as a "Frequently asked questions" section on the post and adds `FAQPage` structured data — useful for answer-engine visibility.
- Everything else (tag filters, search, RSS feed, sitemap entry, JSON-LD) is generated automatically from the file. No other file needs to change to publish a post.
- Posts are statically generated, so a new file goes live on the next build/deploy, not instantly — run `npm run build` locally to confirm it compiles before pushing.

