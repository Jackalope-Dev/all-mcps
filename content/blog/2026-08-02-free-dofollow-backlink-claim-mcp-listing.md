---
title: "How to get a free dofollow backlink for your MCP server"
excerpt: "Claim your listing, verify your product site, and place a dofollow AllMCPs badge — reciprocal SEO that helps your product and the directory."
tags: ["SEO", "Directory"]
faq:
  - q: "Is the AllMCPs website backlink really free?"
    a: "Yes. Free listings can earn a dofollow website link by verifying the site and placing a dofollow AllMCPs badge. Premium listings get dofollow without a badge."
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

Claiming is how you prove ownership and unlock listing edits, logos, and website verification.

## The free dofollow path (reciprocal badge)

AllMCPs website links on free listings are **nofollow by default**. That is deliberate: we only grant dofollow when there is a clear, verified relationship.

You can upgrade the website link to **dofollow for free** by:

1. **Claiming** the listing (sign in and complete ownership proof).
2. **Attaching and verifying** your product website (badge on the site or DNS TXT).
3. **Placing the AllMCPs badge** on that website **without** a `nofollow` attribute.

We recheck the badge periodically. If it disappears or becomes nofollow, the listing reverts to nofollow. That keeps the graph honest.

Premium listings get dofollow on the website link **without** requiring a badge — useful when you want instant SEO value and richer analytics (which LLMs hit your listing, impression surfaces, search discovery).

## Why this is good for directory quality

Reciprocal, verified links do more than help individual DR scores:

- They surface **real product sites**, not empty GitHub-only stubs.
- They reward maintainers who care about discovery and documentation.
- They give AllMCPs a healthier outbound graph — dofollow only where trust is proven.

If you are submitting a new server, use the submit form with a clear description and website. After approval, watch for the listing-approved email (and claim CTA). Completing claim + badge is usually the highest-leverage ten minutes after going live.

## Practical checklist

- [ ] Listing approved and public
- [ ] Signed in and claimed ownership
- [ ] Product `websiteUrl` set and verified
- [ ] AllMCPs badge embedded on the site (dofollow)
- [ ] Optional: Premium if you want analytics + guaranteed dofollow

## Install accuracy matters too

A listing that ranks well but installs with a broken `npx` package name still loses users. Prefer documented install commands in your README (`npx`, `uvx`, or a remote MCP URL). AllMCPs extracts those hints over time so copy-paste configs stay closer to reality.

## Next steps

1. Find your server on [Browse](/browse) or search.
2. Open **Claim listing** on the detail page.
3. Generate a badge from the [badge generator](/badge-generator) or your listing embed tools.
4. If you want analytics and instant dofollow, see [Pricing](/pricing).

Questions? [Contact us](/contact) — we want the directory to stay genuinely useful for builders and for the agents that install their tools.
