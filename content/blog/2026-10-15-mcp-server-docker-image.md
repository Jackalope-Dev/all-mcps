---
title: "MCP Server Docker Image: Run Stdio Servers with Docker"
excerpt: "Learn how to build and run an MCP server Docker image for stdio clients, including docker run -i, volume mounts, secrets, debugging, and distribution trade-offs."
tags: ["Deployment"]
faq:
  - q: "Can an MCP server run in Docker over stdio?"
    a: "Yes, an MCP server can run in Docker over stdio when the container keeps standard input open and writes only MCP protocol messages to standard output. Use `docker run --rm -i` rather than allocating a terminal, and configure the MCP client to launch Docker as the command with the image name and required arguments."
  - q: "Should I use Docker secrets for a local MCP server?"
    a: "Docker secrets are useful when your deployment environment supports them, but they are not uniformly available for ordinary local `docker run` workflows. For local use, a read-only mounted secret file or an environment variable may be simpler. Avoid putting credentials in image layers, shell history, source control, or client configuration committed to a repository."
  - q: "Why does my Dockerized MCP server produce protocol errors?"
    a: "The usual cause is diagnostic output written to stdout, a closed stdin pipe, or a pseudo-terminal changing the byte stream. MCP stdio servers should write protocol messages to stdout and logs to stderr. Remove `-t`, add `-i`, test the image directly, and inspect stderr separately before debugging the client configuration."
  - q: "Is a Docker image better than a remote MCP server?"
    a: "A Docker image is usually better for local, isolated, reproducible execution when the MCP client can launch processes. A remote MCP server is a better fit when several users or applications need shared access, centralized authentication, persistent infrastructure, or cloud deployment. The choice depends on client transport support, operational ownership, and the server's access to local files."
---

An **MCP server Docker image** packages an MCP server and its runtime dependencies so a local client can launch the server consistently. For an MCP server using stdio, run the image with `docker run --rm -i` so the client can keep the container's standard input and output connected; do not allocate a pseudo-terminal. Mount only the files the server needs, pass credentials without baking them into the image, and use a remote deployment when the server must be shared or continuously operated.

## When Docker is the right MCP distribution format

Docker is a good distribution format for an MCP server when the server has non-trivial runtime requirements: a particular language version, native libraries, command-line tools, browser dependencies, or a database client. The image also gives users a repeatable entry point instead of asking them to install every dependency on the host.

A container is especially useful when:

- The MCP server is intended for local use but should not install dependencies globally.
- The server needs a fixed runtime or system package set.
- You want to test the same artifact in development and CI.
- The server needs controlled access to a host directory through an explicit volume mount.
- Your MCP client can launch local commands and keep stdio connected.

Docker is not automatically the best choice. A container adds an image build, registry, permission, filesystem, and networking boundary. A small server distributed as a single executable or a package may be easier for users to install. Docker also does not make an unsafe MCP tool safe: if the container can access the Docker socket, host filesystem, or powerful credentials, its effective privileges may still be substantial.

For a catalog of container-oriented servers, see [Best Docker MCP Servers](/best/docker). The relevant question for this article is narrower: how to package and run a stdio server in a container that an MCP client starts on demand.

## How stdio works inside a container

With the stdio transport, the MCP client starts the server as a child process. The client writes MCP messages to the process's stdin and reads responses from stdout. The server must preserve that stream for protocol traffic. Diagnostic logs belong on stderr.

Docker can sit between the client and the server without changing this model:

```text
MCP client -> docker run stdin -> container stdin -> MCP server
MCP client <- docker run stdout <- container stdout <- MCP server
```

The `-i` option keeps standard input open. Without it, the server may start successfully but receive an immediate end-of-file when the client tries to initialize a session. Avoid `-t` for protocol traffic. A pseudo-terminal is designed for interactive terminal applications and can introduce terminal behavior that is inappropriate for a machine-readable stream.

A minimal invocation looks like this:

```bash
docker run --rm -i \
  --name example-mcp \
  example/mcp-server:1.0.0
```

`--rm` removes the stopped container. It is convenient for client-launched processes, but omit it when you need to inspect a stopped container after a failure. Pin an image tag or digest for reproducible configurations instead of relying on `latest`.

The server process should remain in the foreground. Do not start it with a shell that backgrounds the process, and avoid entrypoint scripts that print banners to stdout. If a wrapper is necessary, use `exec` so signals and standard streams reach the MCP server:

```sh
#!/bin/sh
set -eu
exec /usr/local/bin/mcp-server "$@"
```

The exact message framing and initialization behavior are defined by MCP and the implementation's SDK. Client support for stdio command arguments and environment variables also varies, so validate the configuration against the client you use. The [MCP installation guide for Claude, Cursor, Windsurf, and VS Code](/blog/how-to-install-mcp-servers-in-claude-cursor-windsurf-and-vs-code) covers client-specific configuration patterns.

## Build an MCP server Docker image

A useful image has a predictable entrypoint, no development-only files, and a runtime that does not need a shell session. The following Dockerfile illustrates a multi-stage build for a TypeScript-based server. The package manager commands, build script, and output directory must match your project.

```dockerfile
FROM node:22-bookworm AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER node
ENTRYPOINT ["node", "dist/index.js"]
```

The `ENTRYPOINT` array form avoids an extra shell and preserves argument handling. A non-root runtime user reduces the impact of a server defect, although the container's access to mounted files still depends on ownership and permissions.

Build and test the image locally:

```bash
docker build --tag example/mcp-server:1.0.0 .
docker run --rm -i example/mcp-server:1.0.0
```

The second command may appear to do nothing because an MCP stdio server waits for input. That is normal. To test the protocol, use an MCP-compatible client or an SDK test harness rather than typing arbitrary text into the terminal. If the server emits startup logs, confirm that they go to stderr, not stdout.

If you are implementing the server itself, the [MCP server TypeScript SDK guide](/blog/build-mcp-server-typescript-sdk) covers tools, resources, and testing. The container should package that already-tested server; Docker is not a substitute for protocol-level tests.

## Configure a client to run the image

MCP clients generally represent a local stdio server with a command, an argument list, and optionally environment variables. A typical conceptual configuration is:

```json
{
  "mcpServers": {
    "example": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "example/mcp-server:1.0.0"
      ]
    }
  }
}
```

The file location and property names are client-specific. Some clients expose separate fields for environment variables; others pass an environment map in the server definition. Some desktop clients launch the command directly, while hosted or browser-based clients may not be able to start a local Docker process at all.

For Cursor-specific setup, use [How to Add MCP Servers to Cursor](/clients/cursor). Do not assume that a configuration accepted by one client is valid in another. Test the command independently first, then add it to the client and inspect the client's MCP logs.

A client-launched container should normally be short-lived and one-to-one with the client session. If you need a long-running shared service, exposing a network endpoint is usually a clearer architecture than keeping a container attached to one client's stdio pipe. The [remote MCP deployment guide](/blog/deploying-remote-mcp-servers-production-guide) covers the operational concerns of that model.

## Mount files and directories deliberately

Containers do not automatically see the host filesystem. If an MCP server needs to read a project directory, mount it explicitly:

```bash
docker run --rm -i \
  --mount type=bind,src="$PWD",dst=/workspace,readonly \
  --workdir /workspace \
  example/mcp-server:1.0.0
```

The read-only flag is important for servers that only inspect files. Use a writable mount only when the tool's purpose requires file changes, and mount the narrowest directory that satisfies the task rather than the entire home directory.

On Linux, the container process may need matching permissions to read the mounted path. On Docker Desktop, file sharing and host-path permissions are mediated by the desktop application. On SELinux-enabled systems, bind mounts may require an appropriate labeling option, depending on the host configuration. These host differences are a reason to document the expected mount and permission behavior for your image.

A configuration file can be mounted separately:

```bash
docker run --rm -i \
  --mount type=bind,src="$PWD/project",dst=/workspace,readonly \
  --mount type=bind,src="$HOME/.config/example-mcp/config.json",dst=/etc/example-mcp/config.json,readonly \
  --workdir /workspace \
  example/mcp-server:1.0.0 \
  --config /etc/example-mcp/config.json
```

Avoid mounting the Docker socket unless the server specifically needs to manage Docker. A socket mount such as `/var/run/docker.sock:/var/run/docker.sock` can grant broad control over the host's Docker daemon. If Docker management is the actual use case, compare the permissions and behavior of directory listings such as [docker-mcp](/mcp/docker-mcp), [mcp-server-docker](/mcp/ofershap-mcp-server-docker), and [QuantGeekDev/docker-mcp](/mcp/quantgeekdev-docker-mcp) rather than adding the socket casually to an unrelated image.

## Pass secrets without baking them into the image

Never put API keys in a Dockerfile `ENV` instruction, image build argument, source repository, or a layer created during `RUN`. Image history and registries can retain values even after a later layer removes a file.

For a local test, an environment variable is simple:

```bash
docker run --rm -i \
  --env EXAMPLE_API_KEY \
  example/mcp-server:1.0.0
```

This asks Docker to copy `EXAMPLE_API_KEY` from the host environment. It keeps the literal value out of the command line, but the credential is still available to processes that can inspect the container environment. Do not use this approach when the client configuration itself is shared with untrusted users.

A mounted file is often preferable when the server supports a credential-file option:

```bash
docker run --rm -i \
  --mount type=bind,src="$HOME/.config/example-mcp/token",dst=/run/secrets/example-token,readonly \
  example/mcp-server:1.0.0 \
  --token-file /run/secrets/example-token
```

Set restrictive permissions on the host file and ensure the container user can read it. Docker Compose and some orchestrators provide secret mechanisms that mount values as files. Docker Swarm has native secrets; ordinary `docker run` does not provide the same general-purpose secret abstraction, so do not describe a local `docker run` command as using Docker secrets unless the deployment environment actually supplies them.

Also consider whether the MCP client logs command arguments, environment values, or server errors. Keep credentials out of arguments and redact secrets in application logs.

## Troubleshoot a containerized stdio server

Start with the Docker command, then move outward to the client.

1. **Check the image starts.** Run `docker run --rm -i image:tag` and verify the process stays alive while waiting for input.
2. **Remove the TTY.** Use `-i`, not `-it`, for stdio protocol traffic.
3. **Separate logs from protocol output.** Send application diagnostics to stderr. A startup banner on stdout can make the client report invalid JSON or an initialization failure.
4. **Check the entrypoint.** Confirm that the intended server is the foreground process and that wrapper scripts use `exec`.
5. **Verify mounts.** Add a temporary diagnostic command or inspect the container's effective path, but do not change the production image to print sensitive configuration.
6. **Check permissions.** The runtime user may not be able to read a bind mount or a secret file.
7. **Inspect client logs.** A client may reject unknown configuration properties or impose its own timeout and process-lifecycle rules.

For command-oriented servers, least privilege matters as much as packaging. A server that can execute host commands or arbitrary code should have explicit validation, timeouts, output limits, and audit behavior. For examples in this category, review [MCP shell](/mcp/sonirico-mcp-shell), [mcp-server-commands](/mcp/g0t4-mcp-server-commands), and the Docker-based [mcp-code-runner](/mcp/axliupore-mcp-code-runner). Their capabilities differ, so assess the actual tool surface and container permissions before deployment.

## When to choose a remote deployment instead

Use a remote MCP server when the server needs to be available to multiple users, run continuously, access private infrastructure from a controlled network, or centralize authentication and auditing. A remote service also avoids requiring every client machine to install Docker and pull the image.

The trade-off is operational complexity. You must manage transport security, identity, authorization, upgrades, logs, health checks, network policy, and potentially state. A local image is usually simpler for a single developer working with local files; a remote service is usually better for a team-owned capability.

File access is a decisive factor. A local stdio container can mount a selected workspace from the developer's machine. A remote server cannot see that local path unless the files are uploaded, synchronized, or exposed through another service. Conversely, a remote server can reach databases and internal APIs that should never be exposed to a local container.

## Next steps

Build the image, run it with `--rm -i`, and test its stdio behavior before adding it to a client. Then document required mounts, environment variables, secret files, image tags, and permissions alongside the client configuration. Browse [Best File Systems MCP Servers](/best/file-systems) for filesystem-focused options, [Best Command Line & Terminal MCP Servers](/best/command-line) for command-oriented tools, and [Best Cloud Platforms MCP Servers](/best/cloud) when the server belongs in a hosted environment. You can also validate an MCP server interactively with the [MCP server playground](/tools/playground).
