# Security Policy

## Reporting a vulnerability

Please **don't open a public GitHub issue** for a security vulnerability.

Report it privately through
[GitHub Security Advisories](https://github.com/Jackalope-Dev/all-mcps/security/advisories/new),
or by email to **security@allmcps.com**.

Include enough detail to reproduce it: the affected endpoint or page, the
request you sent, what you expected, and what actually happened. A proof of
concept helps, but please don't run automated scanners against
`allmcps.com` or test anything that degrades the service for other users.

You can expect an acknowledgement within a few days. We'll keep you posted as
we work on a fix, and we're glad to credit you in the advisory unless you'd
rather stay anonymous.

## Scope

In scope:

- The `allmcps.com` web application and its API routes.
- The AllMCPs MCP server (`mcp-server/`).
- Anything in this repository.

Out of scope:

- The third-party MCP servers listed in the directory. They're independent
  projects — report issues to their own maintainers. If a listing points at
  something actively malicious, tell us and we'll pull it.
- Findings from automated scanners with no demonstrated impact.
- Missing hardening headers or best practices with no exploitable consequence.
- Denial of service, volumetric testing, social engineering, and physical
  attacks.

## A note on running MCP servers

Installing an MCP server means running third-party code with whatever access
you grant it. A listing in this directory is not a security audit, and a
Verified badge only means the owner proved control of the linked repository or
site. Review what a server does before you connect it to an agent that can act
on your behalf.
