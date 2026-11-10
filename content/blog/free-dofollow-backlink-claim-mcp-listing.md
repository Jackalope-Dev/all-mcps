---
title: "How to get a free dofollow backlink for your MCP server"
description: "Place a dofollow AllMCPs badge on your product site and your listing's website link turns dofollow — reciprocal SEO that helps your product and the directory."
date: 2026-08-02
slug: "free-dofollow-backlink-claim-mcp-listing"
tags: ["Directory & News"]
faq:
  - q: "Is the AllMCPs website backlink really free?"
    a: "Yes. Any listing earns a dofollow website link while its website carries a dofollow AllMCPs badge. Payment never buys one: a Premium listing without the badge gets a rel=\"sponsored\" website link."
  - q: "Why does the badge need to be dofollow?"
    a: "We only pass link equity when you link back without nofollow. Our health checks re-verify the badge stays live and dofollow."
  - q: "Where do I claim my listing?"
    a: "Open your server page on AllMCPs and use Claim listing, or go to /mcp/{id}/claim after signing in."
---

If you ship a Model Context Protocol (MCP) server, discovery is half the product. Developers need to find you, trust you, and install you in Claude, Cursor, or whatever client they use. AllMCPs is built for that — and once your listing is live, there is a free SEO path that helps *you* while making the directory more useful for everyone.

A directory listing isn't the only place your server should live. Publishing to the [official MCP registry](/blog/mcp-registry-vs-directory-publish-official-registry) makes you discoverable to clients and aggregators programmatically, while a claimed directory listing makes you discoverable — and evaluable — to humans searching the open web. They're complementary; this post covers the directory half.

## What you get when you list

After your submission is approved, your MCP appears in browse, search, category pages, and agent-facing APIs (`/api/v1/search`, markdown negotiation, `llms.txt`). You also get:

- A public listing URL (`/mcp/your-server`)
- Install snippets for major clients
- Optional badges for your README or docs
- The ability to **claim** the listing and manage it over time

Claiming is how you prove ownership and unlock listing edits, logos, and changing the website URL. A claimed listing shows "Verified owner", and its repository link is dofollow.

## The free dofollow path (reciprocal badge)

AllMCPs website links are **nofollow by default**. That is deliberate: we only grant dofollow when there is a clear, verified relationship.

You can upgrade the website link to **dofollow for free**:

1. **Check the website on your listing.** The badge has to be on the site your listing links to. If the listing shows the wrong site or none, **claim** it (sign in and prove ownership through your GitHub README, a site meta tag, or DNS TXT) and attach your product website on the same claim page. Only owners can change it.
2. **Place the AllMCPs badge** on that website, linking to your listing page, **without** `nofollow`, `ugc` or `sponsored` on the link.
3. **Wait for the next health check.** Our checker visits the listing's website on a rolling schedule; once it finds the badge, the website link turns dofollow. No claim is needed for this step if the website on your listing is already right.

We recheck the badge periodically. If it disappears or becomes nofollow, the listing reverts to nofollow. That keeps the graph honest.

Premium doesn't change this. Payment never buys a dofollow link: a Premium listing's website link is marked `rel="sponsored"` until the badge is live, as Google asks for paid links. What Premium buys is labelled featured placement and richer analytics (which LLMs hit your listing, impression surfaces, search discovery).

## Why this is good for directory quality

Reciprocal, verified links do more than help individual DR scores:

- They surface **real product sites**, not empty GitHub-only stubs.
- They reward maintainers who care about discovery and documentation.
- They give AllMCPs a healthier outbound graph — dofollow only where trust is proven.

If you are submitting a new server, use the submit form with a clear description and website. After approval, watch for the listing-approved email (and claim CTA). Completing claim + badge is usually the highest-leverage ten minutes after going live.

## Practical checklist

- [ ] Listing approved and public
- [ ] The website on your listing is your product site (claim the listing to change it)
- [ ] AllMCPs badge embedded on that site (dofollow)
- [ ] Optional: claim the listing for edits, a "Verified owner" badge and a dofollow repo link

## Install accuracy matters too

A listing that ranks well but installs with a broken `npx` package name still loses users. Prefer documented install commands in your README (`npx`, `uvx`, or a remote MCP URL). AllMCPs extracts those hints over time so copy-paste configs stay closer to reality.

## Next steps

1. Find your server on [Browse](/browse) or search, and check the website it links to.
2. If that website is wrong or missing, open **Claim listing** on the detail page.
3. Generate a badge from the [badge generator](/badge-generator) or your listing embed tools, and put it on your site.
4. If you want featured placement and analytics, see [Pricing](/pricing).

Questions? [Contact us](/contact) — we want the directory to stay genuinely useful for builders and for the agents that install their tools.
