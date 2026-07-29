# DNS for AI Discovery (DNS-AID) Deployment Guide

This document specifies DNS-AID records published for `allmcps.com` to enable DNS-based agent discovery per `draft-mozleywilliams-dnsop-dnsaid` and RFC 9460.

## Record Format & Structure

DNS-AID utilizes ServiceMode `SVCB` or `HTTPS` records under subdomains prefixed with `_agents`:

- **Index Entrypoint**: `_index._agents.allmcps.com`
- **Agent-to-Agent (A2A) Entrypoint**: `_a2a._agents.allmcps.com`
- **MCP Discovery Entrypoint**: `_mcp._agents.allmcps.com`

## Standard Record Definitions

```dns
_index._agents.allmcps.com. IN HTTPS 1 . alpn="h2,h3" port="443" uri="https://allmcps.com/.well-known/agent-skills/index.json"
_a2a._agents.allmcps.com.   IN HTTPS 1 . alpn="h2,h3" port="443" uri="https://allmcps.com/.well-known/api-catalog"
_mcp._agents.allmcps.com.   IN HTTPS 1 . alpn="h2,h3" port="443" uri="https://allmcps.com/.well-known/mcp/server-card.json"
```

## DNSSEC Requirement

The zone containing `_agents.allmcps.com` must be signed with DNSSEC so validating resolvers receive authenticated `AD` flags when resolving discovery records.
