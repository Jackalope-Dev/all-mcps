---
title: "MCP Registry vs MCP Directory: What the Official Registry Is and How to Publish to It"
excerpt: "The official MCP registry, third-party directories, and in-client marketplaces are three different things doing three different jobs. Here's how they fit together, how to publish your server to the official registry with server.json, and where a curated directory listing still matters."
tags: ["MCP", "Directory", "Guides"]
faq:
  - q: "What is the official MCP registry?"
    a: "It's the canonical, community-driven metadata catalog for publicly available Model Context Protocol servers, hosted by the MCP project at registry.modelcontextprotocol.io. It stores a standardized description of each server — name, namespace, repository, and package pointers — and exposes a REST API so clients and downstream directories can discover servers programmatically. It's a metadata layer, not a code host and not a human-browsable storefront."
  - q: "Is an MCP registry the same as an MCP directory?"
    a: "No. A registry is a machine-readable source of truth optimized for programmatic discovery and publishing. A directory is a human-facing, curated catalog optimized for browsing, comparison, search, and evaluation — categories, health signals, screenshots, reviews, and install snippets. Most directories consume registry data as one of several inputs, then add editorial curation on top."
  - q: "How do I publish my server to the official MCP registry?"
    a: "Install the mcp-publisher CLI, run 'mcp-publisher init' to scaffold a server.json manifest, fill in your namespace, repository URL, and packages array (npm, PyPI, NuGet, or an OCI image), authenticate with 'mcp-publisher login' via GitHub OAuth, then run 'mcp-publisher publish'. Your namespace has to match an identity you control, which is how the registry prevents name squatting."
  - q: "If I publish to the official registry, do I still need a directory listing?"
    a: "They serve different goals. The registry gets you discoverable by clients and aggregators; a directory listing gets you discovered and evaluated by humans searching for a solution, plus SEO benefits like a dofollow backlink and a page that ranks for your server's name. Publishing to the registry and claiming a directory listing are complementary, not redundant."
---

> **TL;DR:** "MCP registry," "MCP directory," and the "MCP marketplace" built into your AI client are three distinct things. The official registry is a machine-readable metadata catalog with a REST API — the source of truth clients and aggregators read from. A directory is a curated, human-facing catalog you browse, search, and compare on. An in-client marketplace is the install surface inside Claude, VS Code, or Cursor. If you maintain a server, you want to publish to the official registry *and* claim a directory listing — they do different jobs. This post explains the differences and walks through publishing with `server.json`.

If you've searched for "MCP registry" and "MCP directory" and gotten a jumble of results that seem to describe the same thing, that's because the ecosystem uses the terms loosely. They're not the same thing, and the difference matters — both if you're trying to *find* a server and if you're trying to get *your* server found.

## Three layers, three different jobs

There are three distinct surfaces where MCP servers get listed, and they sit at different levels of the stack.

**The official registry** is the canonical metadata layer. It's a [community-driven service hosted by the MCP project](https://registry.modelcontextprotocol.io/) that stores a standardized record for each publicly available server — its name, namespace, source repository, and pointers to where its package actually lives (npm, PyPI, NuGet, or a container image). It exposes a REST API. Its entire reason to exist is programmatic discovery and publishing: it's the thing other tools *read from*, not primarily a thing humans browse.

**A directory** — like the one you're reading this on — is a curated, human-facing catalog. It exists to help a person answer "which server should I use for X?" That means categories, search, [side-by-side comparison](/blog/compare-mcp-servers-alternatives-guide), health and freshness signals, install snippets, and editorial context the raw registry record doesn't carry. A good directory *consumes* registry data as one input, then adds curation, deduplication, and evaluation signals on top.

**An in-client marketplace** is the install surface built into an AI client — the "add server" or "connectors" panel inside Claude, VS Code, Cursor, and others. This is where a user actually clicks install. Increasingly these marketplaces pull their catalog from the official registry's API, which is exactly the point of having a canonical registry: one place to publish, many places to be discovered.

The mental model that makes this click: the registry is the *database*, directories and marketplaces are the *front ends*. You publish once to the database; the front ends surface you in the places people actually look.

## Why a canonical registry exists at all

Before the official registry, every client and every directory maintained its own list, often by scraping GitHub or accepting manual submissions. The same server would show up under three slightly different names, with stale install commands in one place and a dead repo link in another. There was no authoritative answer to "what is this server's real package name and who publishes it."

The official registry fixes the *identity and metadata* problem. Namespaces are tied to something you control — a GitHub identity or a DNS domain — so nobody can squat `your-company/your-server` but you. The `server.json` schema standardizes how a server describes itself, so a client reading the API gets the same shape of data for every server. And because it's an open API, any downstream tool can build on it without re-scraping the world.

What the registry deliberately *doesn't* do is curate. It won't tell you which of four browser-automation servers is the one to use, whether a server is actively maintained, or how it compares to alternatives. That's not a gap — it's a separation of concerns. Curation is the directory's job.

## How to publish your server to the official registry

If you maintain a server, publishing to the official registry is how you become discoverable to every client and aggregator that reads its API. The flow is CLI-driven and takes a few minutes.

1. **Install the publisher CLI.** The MCP project ships `mcp-publisher`, the official tool for creating and submitting registry records.

2. **Scaffold a manifest.** Run `mcp-publisher init` to generate a starter `server.json`. This is the standardized descriptor the registry stores.

3. **Fill in `server.json`.** At minimum you'll set:
   - a **name** under a namespace you control (e.g. `io.github.yourname/your-server`),
   - a short **description**,
   - a **repository** object pointing at your source (`url` + `source`),
   - a **packages** array declaring where the runnable artifact lives — `registryType` (npm, pypi, nuget, or oci), the package name, and the version.

4. **Authenticate.** Run `mcp-publisher login`, which uses GitHub OAuth to prove you own the namespace you're claiming. This is the anti-squatting mechanism — you can only publish under identities you control.

5. **Publish.** Run `mcp-publisher publish`. Your record goes live in the registry and becomes available through the REST API for clients and directories to pick up.

A few things worth knowing before you do this. The registry stores *metadata and pointers*, not your code — your actual package still lives on npm, PyPI, or a container registry, and the registry just references it. Keep your `server.json` version in sync with your published package version, because clients use it to know what's current. And treat the description as real SEO and discovery copy, not a placeholder — for a lot of clients and aggregators, that one line is the entire pitch a user sees before deciding whether to install. (The same discipline applies inside the server itself: see [writing MCP tool descriptions that actually get picked](/blog/writing-mcp-tool-descriptions-that-work).)

## Where a directory listing still matters

If the registry is where clients discover you, why bother with a directory listing too? Because the two reach people at different moments with different intent.

The registry reaches **machines and the people already inside a client**, at the moment of install. A directory reaches **people searching the open web** — someone typing "best MCP server for Postgres" or "Notion MCP alternative" into a search engine, well before they've opened a client's add-server panel. Those are different audiences at different funnel stages, and the registry record alone doesn't rank for those queries or give a human room to evaluate you against alternatives.

A directory listing also does things a registry record structurally can't:

- **Ranks for your server's name and category** as a standalone, indexable page, so you show up when someone searches instead of only when they're already browsing a client.
- **Carries evaluation signals** — freshness, health, categorization, comparisons — that help a human choose, not just discover.
- **Gives you a [free dofollow backlink](/blog/free-dofollow-backlink-claim-mcp-listing)** to your project site when you claim and verify the listing, which the bare registry record doesn't.
- **Lets you tell the story** the `server.json` description has no room for — what problem you solve, who it's for, how you differ from the obvious alternative.

None of that competes with the registry. Publish to the registry so clients can find you; [claim a directory listing](/submit) so humans searching the web can too. If you're building a server from scratch, our [build an MCP server](/build-mcp-server) and [deploy a remote MCP server](/deploy-mcp-server) guides cover the steps that come before either kind of listing.

## Which one should you search or submit to?

To close the loop, here's the short version by intent:

- **You want to find a server to use.** Start with a directory — you get search, categories, comparison, and evaluation signals a raw registry API dump won't give you. Fall back to the registry API only if you're building tooling that needs the canonical record.
- **You're building a client or aggregator.** Read the official registry's REST API as your source of truth, then layer your own curation on top rather than re-scraping GitHub.
- **You maintain a server and want it found.** Publish to the official registry *and* claim a directory listing. The first makes you discoverable to clients; the second makes you discoverable — and evaluable — to the humans searching for exactly what you built.

The ecosystem is still consolidating around the official registry as the canonical metadata layer, which is a genuinely good thing: publish once, get surfaced everywhere. But "canonical metadata" and "the page a human lands on and decides to trust you from" are two different jobs, and they're likely to stay two different jobs for a long time.

Sources: [Official MCP Registry](https://registry.modelcontextprotocol.io/) · [modelcontextprotocol/registry on GitHub](https://github.com/modelcontextprotocol/registry) · [Publishing docs](https://github.com/modelcontextprotocol/registry/tree/main/docs)
