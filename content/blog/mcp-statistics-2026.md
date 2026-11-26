---
title: "MCP Statistics 2026: Growth, Auth and Failures"
description: "MCP statistics for 2026 from two datasets: server growth, how many skip authentication, tool counts, install failures and security advisories."
author: "caden-sumner"
date: 2026-11-26
slug: "mcp-statistics-2026"
tags: ["Directory & News", "Security", "mcp statistics", "remote mcp servers", "local mcp servers"]
image: "https://app.lopebase.com/api/content/images/2d85a34a-34d9-4e24-8e87-10cae2de1c53/cover-bf3670e4766fe3c2.png"
image_alt: "MCP Statistics 2026: Growth, Auth and Failures"
image_kind: "title_card"
faq: [{"q":"How many MCP servers are there in 2026?","a":"It depends on what you count. Bloomberry counted 1,412 company-operated servers on dedicated subdomains by February 2026. State of MCP, which includes open source packages and community servers, lists 32,919 as of late November 2026."},{"q":"What share of MCP servers have no authentication?","a":"Among company-operated remote servers with a known auth method, 38.7% had none. Across all indexed servers it is 59%, mostly local tools where no auth is expected (State of MCP)."},{"q":"How many tools does a typical MCP server have?","a":"For remote company servers, the median is 5 tools and the average 13.4."},{"q":"Do most MCP servers have known vulnerabilities?","a":"No. 3% of 15,363 checked install packages have a critical or high advisory on OSV.dev, counted against any version."},{"q":"How often does an MCP server fail to start?","a":"In sandbox runs with a clear result, 1,819 of 9,678 packages either never completed the handshake (1,167) or would not install (652)."}]
---

How many MCP servers exist, how many skip authentication, and how many actually start? Two independent datasets answer those questions for 2026, and they measure different parts of the ecosystem, so the useful thing is to read them together.

The short version, with each figure linked to its source:

| Question | Answer | Source |
|---|---|---|
| Company-operated remote servers, Feb 2026 | 1,412, up 232% in six months | [Bloomberry](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/) |
| Remote servers with no authentication | 38.7% of those with a known auth method | [Bloomberry](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/) |
| Median tools per remote server | 5 (average 13.4) | [Bloomberry](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/) |
| Public servers indexed, Nov 2026 | 32,919 | [State of MCP](https://allmcps.com/state-of-mcp) |
| Share running locally over stdio | 67% of servers with a known transport | [State of MCP](https://allmcps.com/state-of-mcp) |
| Install packages with a critical or high advisory | 3% (417 of 15,363), any version | [State of MCP](https://allmcps.com/state-of-mcp) |
| Sandboxed packages that started | 7,859 of 9,678 with a clear result | [Trust page](https://allmcps.com/trust) |

## What each dataset counts

The two sources barely overlap, so it matters what each one includes.

- **Company-operated servers.** Henley Wing Chiu at Bloomberry tracked MCP servers launched on dedicated subdomains such as `mcp.yourcompany.com` across about 2 million companies, starting in August 2025. These are servers a company runs for outside users. Full write-up: [I analyzed 1400 MCP servers](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/).
- **Public servers of every kind.** The AllMCPs index pulls from the official MCP Registry, community lists and direct submissions, merges duplicates and recomputes its stats every few hours. Most of it is open source packages. Methodology is on the [State of MCP](https://allmcps.com/state-of-mcp) page.

If you are deciding between running a server locally or connecting to a hosted one, that tradeoff has its own post: [remote vs local MCP servers](https://allmcps.com/blog/remote-vs-local-mcp-servers). This post sticks to what the numbers say.

## Growth: company servers tripled in six months

[Bloomberry counted](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/) 425 company-operated MCP servers at the end of August 2025 and 1,412 by February 2026, a 232% increase.

The broader index grew too. [State of MCP](https://allmcps.com/state-of-mcp) lists 32,919 servers as of late November 2026, with 2,957 added in the previous 30 days. Its monthly additions peaked in September 2026, but that reflects the index catching up on existing servers, not a launch spike, so read the trend from the last 30 days rather than the monthly chart.

## Authentication: the remote gap

The figure most worth remembering is from Bloomberry: of company servers with a determinable auth method, [38.7% required no authentication](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/). Anyone could connect, initialize a session and list every tool. Some of those open servers exposed tools named `create_transfer`, `get_kyc_status`, `get_resumes` and `create_refund`.

On the broader index, [State of MCP](https://allmcps.com/state-of-mcp) found that of 17,826 servers where auth could be determined, 59% need none, 21% use OAuth and 18% an API key. That 59% is mostly local utilities, where no auth is expected because the server runs as your own subprocess. The two figures are not in conflict: "no auth" is normal for a local file tool and a real problem for a hosted payments server.

## Size: most servers are small

Bloomberry found an [average of 13.4 tools per remote server but a median of 5](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/), with nearly half exposing 4 or fewer.

The index tells the same story from another angle: [60% of servers have fewer than 10 GitHub stars](https://allmcps.com/state-of-mcp), and only 386 have 1,000 or more. Most MCP servers are early, single-purpose projects maintained by one person or a small team.

## Hosting and launchers

For remote servers, [Bloomberry found](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/) Vercel, Railway and Render together host 9% of MCP servers, against 2.4% of the same companies' traditional API subdomains, while Azure drops from 19% of API deployments to 7% of MCP servers. Half of the companies with an MCP server had no public-facing API at all.

For local servers, [State of MCP](https://allmcps.com/state-of-mcp) shows 73% of stdio servers with a verified install command launch with `npx` and 26% with `uvx`. Of servers with a known transport, 67% are local and 33% remote.

## Reliability and advisories

Reachable is not the same as working. The AllMCPs index runs stdio packages in a sandbox, and the [trust page](https://allmcps.com/trust) reports what happened: of 9,678 runs with a clear result, 7,859 started (831 of those asked for an API key first), 1,167 installed but never completed the MCP handshake, and 652 would not install.

On security advisories, [State of MCP](https://allmcps.com/state-of-mcp) reports that 417 of 15,363 checked install packages (3%) have a critical or high advisory on OSV.dev. That counts any version, so it is a reason to pin and check rather than evidence that the current release is affected.

## What to do with these numbers

The data points at one check per risk.

1. **Remote server: try it without credentials.** Run `npx @modelcontextprotocol/inspector`, choose the Streamable HTTP transport, enter the server URL and connect with no token. If you can list tools, so can anyone. The [Inspector acceptance checklist](https://allmcps.com/blog/mcp-inspector-remote-server-checklist) covers the rest, and servers that need auth should follow the [MCP authorization spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization).
2. **Local package: pin it and check that version.** Replace `npx -y some-mcp-server` with a pinned `some-mcp-server@1.4.2`, then look the version up on [osv.dev](https://osv.dev). Our [configuration templates](https://allmcps.com/blog/mcp-server-configuration-json) show pinned configs for common clients.
3. **Either kind: start it once outside your client.** A server that fails to install or never finishes the handshake usually just shows up as missing. The [troubleshooting guide](https://allmcps.com/mcp-troubleshooting) covers the common causes.
4. **Scope credentials.** For servers that need a key or OAuth, issue the narrowest token the tools need. The [security guide](https://allmcps.com/mcp-security) goes deeper on least privilege.

## FAQ

### How many MCP servers are there in 2026?

It depends on what you count. [Bloomberry](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/) counted 1,412 company-operated servers on dedicated subdomains by February 2026. [State of MCP](https://allmcps.com/state-of-mcp), which includes open source packages and community servers, lists 32,919 as of late November 2026.

### What share of MCP servers have no authentication?

Among company-operated remote servers with a known auth method, [38.7% had none](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/). Across all indexed servers it is 59%, mostly local tools where no auth is expected ([State of MCP](https://allmcps.com/state-of-mcp)).

### How many tools does a typical MCP server have?

For remote company servers, the [median is 5 tools](https://bloomberry.com/blog/we-analyzed-1400-mcp-servers-heres-what-we-learned/) and the average 13.4.

### Do most MCP servers have known vulnerabilities?

No. [3% of 15,363 checked install packages](https://allmcps.com/state-of-mcp) have a critical or high advisory on OSV.dev, counted against any version.

### How often does an MCP server fail to start?

In sandbox runs with a clear result, [1,819 of 9,678 packages](https://allmcps.com/trust) either never completed the handshake (1,167) or would not install (652).
