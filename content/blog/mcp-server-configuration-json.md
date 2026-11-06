---
title: "MCP Server Configuration JSON: Safe Templates"
description: "Copy practical MCP configuration JSON templates, adapt them to your client, and check paths, secrets, authentication, and connection behavior."
author: "caden-sumner"
date: 2026-11-06
slug: "mcp-server-configuration-json"
tags: ["Using MCP", "Security", "JSON configuration", "MCP Inspector", "authentication"]
faq: [{"q":"Is there a standard mcp.json format?","a":"No universal client configuration format is defined by MCP. Clients choose their own filenames and keys. For example, Claude Desktop uses mcpServers, while VS Code's MCP configuration uses servers."},{"q":"Can I copy the same configuration between clients?","a":"You can often reuse the executable, arguments, and endpoint. Rebuild the surrounding structure for the destination client, and verify its handling of environment variables, secret references, and authentication."},{"q":"Can I put comments in MCP configuration JSON?","a":"Strict JSON doesn't allow comments or trailing commas. Some clients support JSON with comments, but that support isn't portable. Use strict JSON when sharing templates across clients."},{"q":"Where do I configure MCP server rate limits?","a":"Usually in the server, gateway, or upstream service. A client connection file doesn't establish a server-side rate limit unless a documented client-specific feature explicitly provides one."},{"q":"Does a remote MCP server always need an API key?","a":"No. A service may use OAuth, another documented authentication mechanism, or no authentication. Follow its connection instructions rather than adding an Authorization header by default."}]
---

MCP server configuration JSON usually tells your AI client how to launch a local server or connect to a remote one. It isn't a universal configuration format: a valid file for one client can be ignored by another because the wrapper keys, transport settings, and secret handling differ.

Start with the templates below, then check the boundaries that cause most configuration mistakes: which application reads the file, where the server process runs, and which settings belong on the server rather than in your client JSON.

## Pick the right configuration shape

Choose the configuration dialect before copying individual keys. The MCP specification defines protocol messages and transports, not a shared client configuration file. See the official [MCP transport specification](https://modelcontextprotocol.io/specification/latest/basic/transports) for the protocol side of that distinction.

| Connection | Client configuration example | Required connection information | Credentials |
|---|---|---|---|
| Local stdio process | Claude Desktop's `mcpServers` object | Executable in `command`, arguments in `args` | Server-specific environment variables, if needed |
| Remote Streamable HTTP endpoint | VS Code's `servers` object | `type: "http"` and the endpoint `url` | Client-managed OAuth or a documented authentication header |

Here is a minimal local template for Claude Desktop. Replace both paths with real absolute paths:

```json
{
  "mcpServers": {
    "workspace-tools": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/workspace-tools/dist/index.js"
      ]
    }
  }
}
```

This launches an existing JavaScript server; it doesn't install dependencies, compile TypeScript, or create the entry-point file. The official [local server connection guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers) describes the Claude Desktop configuration workflow.

Don't rename `mcpServers` to `servers` unless you're also adapting the rest of the file to a client that expects it. JSON parsing successfully only proves that the document is valid JSON—not that your client understands it.

## Copy a template for your connection

### Local stdio configuration

A stdio configuration starts a child process. The client exchanges MCP messages with that process through standard input and standard output. This fits a server that runs on your development machine and uses locally available dependencies.

**Best for:** A local tool integration whose executable, files, and credentials you control.

For example, this Claude Desktop configuration supplies a server-specific environment variable:

```json
{
  "mcpServers": {
    "workspace-tools": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/workspace-tools/dist/index.js"
      ],
      "env": {
        "WORKSPACE_TOOLS_CONFIG": "/absolute/path/to/workspace-tools/settings.json"
      }
    }
  }
}
```

`WORKSPACE_TOOLS_CONFIG` is an example application-defined variable, not an MCP setting. It does nothing unless your server actually reads it. Replace it with a documented variable for your server, or remove `env` entirely.

Keep the executable and arguments separate. This is not equivalent:

```json
{
  "command": "node /absolute/path/to/server.js"
}
```

Clients generally launch a process rather than interpret a shell command line. Use `command` for the executable and `args` for its arguments. Don't assume pipes, shell variable expansion, or `~` expansion will work.

Absolute paths also reduce differences between your terminal and a desktop application's environment. A desktop client may not inherit the `PATH` established by your shell startup files. On Windows, escape backslashes in JSON strings, such as `C:\\tools\\workspace-tools\\server.js`.

The server must reserve stdout for protocol messages. Debug output belongs on stderr; otherwise a correctly configured process can still fail to communicate. This requirement comes from the [stdio transport specification](https://modelcontextprotocol.io/specification/latest/basic/transports).

### Remote Streamable HTTP configuration

A remote configuration connects to an already running endpoint. It doesn't launch the server or configure its hosting environment. This fits a shared service whose deployment and credentials are managed separately from your workstation.

**Best for:** A hosted integration or centrally operated MCP service.

For VS Code, a workspace `.vscode/mcp.json` can contain:

```json
{
  "servers": {
    "team-tools": {
      "type": "http",
      "url": "https://mcp.example.com/mcp"
    }
  }
}
```

The domain is a placeholder. Replace the full URL with the provider's documented MCP endpoint; don't assume its website homepage or REST API base URL is an MCP endpoint.

For a service that explicitly supports bearer-token authentication, VS Code supports prompted inputs:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "team-tools-token",
      "description": "Token for the team MCP service",
      "password": true
    }
  ],
  "servers": {
    "team-tools": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${input:team-tools-token}"
      }
    }
  }
}
```

These are VS Code configuration features, not portable MCP keys. Consult the official [VS Code MCP configuration documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) before adapting this file to another client. A masked prompt avoids putting the token directly in this JSON; it isn't a general guarantee about every aspect of credential storage.

## Separate client settings from server policy

A useful review starts by assigning every setting to its owner. The client owns process launch or connection details. The server owns its application behavior. Infrastructure may own additional limits and access controls.

| Concern | Where to configure it |
|---|---|
| Local executable and arguments | Client MCP configuration |
| Remote endpoint URL | Client MCP configuration |
| Tool permissions and upstream API scopes | Server and upstream service |
| Requests allowed per user | Server or gateway |
| Maximum concurrent upstream jobs | Server application |
| Subscription charges or usage billing | Service provider or hosting account |

There is no universal MCP client JSON key named `rateLimit`, `monthlyBudget`, or `allowedTools` that works across clients. A particular client or server may offer controls with similar purposes, but those controls need its own documentation.

For MCP server rate limiting, distinguish request volume from concurrent work. A server might receive few tool calls while each call starts an expensive background job. Your deployment may need both a per-identity request limit and a separate concurrency limit. Neither is created by adding an arbitrary field to the connection file.

Remote server price is similarly outside this file. Before connecting an agent, check the provider's billing terms, the upstream API's charges, and any hosting costs you own. A working URL doesn't tell you whether repeated tool calls are billable.

## Configure authentication without inventing OAuth keys

For a remote server using MCP authorization, prefer your client's supported sign-in flow. Don't paste an OAuth client secret into a guessed `oauth` object or treat a short-lived access token as permanent configuration.

The official [MCP authorization specification](https://modelcontextprotocol.io/specification/latest/basic/authorization) describes HTTP authorization discovery and token handling. Those exchanges happen between the client, resource server, and authorization server; they aren't replaced by a universal JSON block.

A practical OAuth configuration example can therefore be the URL-only VS Code template above. If the server requires OAuth and the client supports the server's authorization flow, connecting leads into the client's authentication process. The absence of credentials in the file isn't necessarily an omission.

Use the bearer-header template only when the service documents that authentication method. Don't configure both a manually supplied bearer token and managed OAuth unless the client and provider explicitly explain how they interact.

When comparing authentication platforms, check interoperability rather than a dated vendor ranking: can your client complete discovery, obtain a token intended for this resource, and request the scopes the service requires? For the full exchange, see [MCP OAuth Authorization: Step-by-Step PKCE and Tokens](https://allmcps.com/blog/mcp-oauth-authorization-flow).

Local stdio credentials are different. A server may read an API key from its environment, but that's authentication to its upstream service, not automatically MCP's HTTP OAuth flow. Never assume `${API_KEY}` is expanded in `env`; variable substitution syntax belongs to the client and must be documented there.

## Review a configuration before trusting it

Treat a local MCP entry like a program launch instruction, not harmless connection metadata. Review the executable, arguments, and any package it downloads before approving it. A server launched under your account can have access beyond the tools it advertises, subject to operating-system permissions and any sandboxing you apply.

Use this focused configuration security checklist:

1. Identify the exact executable or remote hostname and confirm who maintains it.
2. Inspect arguments for unexpected directories, shell wrappers, or execution of downloaded packages.
3. Remove credentials from shared files and use the client's documented secret mechanism where available.
4. Give upstream credentials only the permissions needed for the intended tools.
5. Check workspace configuration changes before accepting them, especially after opening an unfamiliar repository.
6. Confirm that remote authentication and any billing account belong to the intended environment.

When choosing an integration, [AllMCPs](https://allmcps.com/best) helps you find, inspect, and install MCP servers. Use that discovery step to identify candidates, then verify the selected server's installation and credential requirements against its documentation before copying an entry into your client.

Keep development and production connections visibly distinct. Names such as `tickets-dev` and `tickets-prod` help a human review the file, but names don't enforce isolation. Separate endpoints and appropriately scoped credentials do.

## Validate the file and prove the connection works

First, check ordinary JSON syntax locally:

```bash
python -m json.tool /path/to/config.json > /dev/null
```

On systems without `/dev/null`, omit the redirection. Successful parsing catches trailing commas and malformed strings. It doesn't validate client-specific fields, resolve paths, or test credentials. Avoid submitting secret-bearing configuration to an unfamiliar online validator.

Next, test a local server independently with the official [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx -y @modelcontextprotocol/inspector \
  /absolute/path/to/node \
  /absolute/path/to/workspace-tools/dist/index.js
```

This command downloads and runs Inspector through npm, then launches your server with the supplied executable and arguments. Review that execution step as you would any development dependency. If the server needs environment variables, supply them securely to the test process as well; Inspector doesn't automatically inherit values from your desktop client's JSON.

In Inspector, establish the connection, list tools if the server offers them, and invoke one documented read-only operation. Avoid testing writes merely to prove connectivity.

Finally, reload or restart your AI client's MCP connection using its supported controls. Verify the same server appears and that the same safe operation succeeds there. Passing Inspector proves the server can work in that test environment; it doesn't prove your client loaded the correct file or used the same credentials.

If Inspector succeeds but your client fails, compare the executable path, arguments, environment, endpoint, and authentication state. The next useful test is a controlled difference between those environments—not another copied configuration. For automated checks beyond this setup pass, use [Testing and Debugging MCP Servers: From Inspector to CI](https://allmcps.com/blog/testing-and-debugging-mcp-servers).

## FAQ

### Is there a standard mcp.json format?

No universal client configuration format is defined by MCP. Clients choose their own filenames and keys. For example, Claude Desktop uses `mcpServers`, while VS Code's MCP configuration uses `servers`.

### Can I copy the same configuration between clients?

You can often reuse the executable, arguments, and endpoint. Rebuild the surrounding structure for the destination client, and verify its handling of environment variables, secret references, and authentication.

### Can I put comments in MCP configuration JSON?

Strict JSON doesn't allow comments or trailing commas. Some clients support JSON with comments, but that support isn't portable. Use strict JSON when sharing templates across clients.

### Where do I configure MCP server rate limits?

Usually in the server, gateway, or upstream service. A client connection file doesn't establish a server-side rate limit unless a documented client-specific feature explicitly provides one.

### Does a remote MCP server always need an API key?

No. A service may use OAuth, another documented authentication mechanism, or no authentication. Follow its connection instructions rather than adding an `Authorization` header by default.
