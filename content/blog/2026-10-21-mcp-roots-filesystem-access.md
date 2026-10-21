---
title: "MCP Roots: How Clients Scope Server Filesystem Access"
excerpt: "MCP roots let clients announce approved filesystem locations to servers. Learn the roots capability, roots/list requests, change notifications, and safe boundaries."
tags: ["MCP", "Security", "Architecture", "Guides"]
faq:
  - q: "Are MCP roots an access control mechanism?"
    a: "MCP roots are a client-provided scope signal, not a complete access control mechanism. A server must enforce the announced directories in its own file operations, while also applying path canonicalization, symlink checks, permissions, and any deployment-level sandboxing. If a client does not provide roots, the server should fail closed or require an explicit configuration rather than assume unrestricted filesystem access."
  - q: "What does the MCP roots capability mean?"
    a: "The MCP roots capability means a client can provide a server with one or more filesystem locations through the roots/list request. The client advertises this support in its initialize capabilities, optionally setting listChanged to true. That flag indicates the client can notify the server when the root list changes; it does not itself grant the server permission to read arbitrary paths."
  - q: "Can an MCP server define its own roots?"
    a: "No, MCP roots are announced and controlled by the client. A server can request the current list with roots/list, validate the returned URIs, and use them to scope its operations. Server configuration may impose narrower limits, such as read-only mode or a configured allowlist, but the server should not treat a path it invented as a client-approved root."
  - q: "What should an MCP server do when roots change?"
    a: "When a client advertises listChanged and sends notifications/roots/list_changed, the server should discard or refresh its cached root list by issuing another roots/list request. It should revalidate active paths against the new list and stop new operations that are no longer in scope. Long-running operations need an explicit policy for whether they finish or are cancelled."
---

MCP roots are client-announced filesystem locations that help an MCP server scope file access to the directories a user or host has made available. A client advertises the [MCP roots capability](/mcp-protocol-versioning) during initialization, and the server retrieves the locations with `roots/list`; clients can optionally notify the server when that list changes. Roots provide useful scope information, but servers must enforce filesystem boundaries themselves with path validation, permissions, and sandboxing.

## What MCP roots represent

An MCP root identifies a location where a server may perform filesystem-related work on the client’s behalf. A root is represented as a URI and may include a human-readable name:

```json
{
  "uri": "file:///home/alex/projects/inventory",
  "name": "Inventory project"
}
```

The URI is the important field. `name` is optional metadata for display or context and should not be used as an authorization key. In typical local development, roots use `file://` URIs. A client and server should agree on which URI schemes the server understands instead of assuming that every URI can be converted into a local path.

Roots are particularly relevant to servers that read, search, edit, create, or delete files. For example, a client might expose a project directory as one root and a documentation directory as another. The server can then limit operations to those locations rather than accepting arbitrary paths supplied by a model or tool caller.

The MCP roots feature does not copy files to the server and does not automatically create an operating-system sandbox. It communicates the client’s intended filesystem scope over MCP. The server remains responsible for turning that scope into an enforceable policy.

For a broader view of the primitives that MCP servers expose, see [What Can MCP Servers Do?](/blog/what-mcp-servers-can-do). This article focuses specifically on the client-to-server filesystem scope represented by roots.

## How clients announce roots

Roots are part of the client capabilities sent in the `initialize` request. A client that supports roots includes a `roots` capability. The `listChanged` property is optional and indicates whether the client can notify the server when the available roots change.

A representative initialize fragment looks like this:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "roots": {
        "listChanged": true
      }
    },
    "clientInfo": {
      "name": "example-client",
      "version": "1.0.0"
    }
  }
}
```

The exact protocol version and client metadata vary. The important part for roots is the client capability object. The capability belongs to the client side of the connection; it is not a server capability that a server advertises in its own `initialize` result.

After initialization, a server that needs filesystem scope can send a `roots/list` request to the client:

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "roots/list"
}
```

The client returns a result containing a `roots` array:

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": {
    "roots": [
      {
        "uri": "file:///home/alex/projects/inventory",
        "name": "Inventory project"
      },
      {
        "uri": "file:///home/alex/notes",
        "name": "Notes"
      }
    ]
  }
}
```

A server should not issue `roots/list` before initialization has established that the client supports the relevant MCP interaction. Clients differ in how they expose roots, and some clients may provide no roots at all. A robust server treats an empty or unavailable list as a meaningful state rather than silently falling back to the entire host filesystem.

The server may cache the result for efficiency, but that cache must have an invalidation strategy. If a client advertises `listChanged: true`, it can send this notification when its roots change:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/roots/list_changed"
}
```

The notification contains no root list. It tells the server to request the current list again with `roots/list`. A server should not assume that a previous path remains approved after receiving this notification.

## The MCP roots capability in practice

The capability has a narrow meaning:

```json
{
  "roots": {
    "listChanged": true
  }
}
```

`listChanged: true` means the client supports change notifications. It does not mean that the server can subscribe to arbitrary filesystem events, that every path beneath a root is readable, or that the operating system will reject access outside the roots.

If `listChanged` is omitted or false, the server should not depend on receiving a roots-change notification. It can still request roots when appropriate, but it needs a policy for stale information. For a short-lived operation, fetching roots before the operation may be sufficient. For a long-running session, the server may need to refresh periodically or require the client to reconnect when scope changes.

MCP SDKs generally expose roots through client-side or server-side abstractions, but method names and lifecycle details vary by language and SDK version. When implementing against an SDK, verify how it represents URI roots, how it reports an unsupported client capability, and whether it handles `notifications/roots/list_changed` automatically. The wire-level methods remain the useful interoperability contract: `roots/list` and `notifications/roots/list_changed`.

Protocol behavior can evolve with negotiated versions, so keep the server’s [MCP protocol versioning](/mcp-protocol-versioning) policy explicit. Do not use a client-specific extension as a substitute for checking the negotiated MCP behavior.

## Using roots to enforce filesystem boundaries

The central server rule is simple: every filesystem operation must be checked against the current approved roots before it runs.

A safe request path usually follows this sequence:

1. Obtain the current roots, or use a cache that is known to be current.
2. Parse and validate the requested URI or path.
3. Resolve the path to a canonical representation.
4. Confirm that the canonical target is inside an approved root.
5. Apply operation-specific policy, such as read-only or allowed extensions.
6. Perform the operation using the validated representation.

For a local `file://` root, a server might convert the URI into a platform path, resolve `.` and `..`, and compare the result with canonicalized root paths. Prefix matching is not enough. A root at `/work/project` must not accidentally authorize `/work/project-old`, so comparisons should be path-component aware.

The server also needs a symlink policy. A path such as `/work/project/link/secrets.txt` may appear beneath the root textually while resolving outside it. Depending on the operation and platform, the server should resolve existing symlinks before authorization, reject symlinks that escape the root, or use operating-system mechanisms that constrain resolution. A check performed only before opening the file can also be vulnerable to time-of-check/time-of-use races when an attacker can modify the directory tree.

Other boundary cases deserve explicit handling:

- Relative paths should be resolved against a selected root, never against the process working directory by accident.
- Windows drive letters, UNC paths, case sensitivity, and separator normalization need platform-specific tests.
- Archive extraction and recursive copy operations must validate every output path, not only the archive or destination argument.
- Search tools must constrain traversal at the directory-walk layer, not filter results after reading outside the root.
- Temporary files should be created inside an approved location and checked before use.
- A root URI should not be trusted merely because it has a plausible `file://` spelling.

A server can impose a narrower boundary than the roots supplied by the client. For instance, the client may expose `/home/alex/projects`, while the server configuration permits only `/home/alex/projects/inventory`. The effective scope should be the intersection of client roots and server policy.

## Roots are not the only security boundary

Roots help express intended scope, but they do not replace authentication, authorization, process isolation, or operating-system permissions. A local STDIO server may run with the user’s permissions; a remote server may run on a different host where a client’s `file://` URI has no meaningful local path. In a remote deployment, the server must define what a client-provided URI means and avoid implying that a client path automatically grants access to a server-side filesystem.

For remote deployments, review the [guide to securing remote MCP servers](/blog/securing-remote-mcp-servers-authentication-guide). Transport security and identity answer who can connect; roots help describe which filesystem locations a connected client intends to expose. These are separate concerns.

The same separation applies to tools. A tool that accepts `path`, `directory`, or `pattern` arguments should enforce root scope regardless of how the argument arrived. Tool descriptions can tell a model to stay within a project, but natural-language instructions are not a security control. An explicit read-only setting is also useful, especially when a server offers both inspection and mutation. See the discussion of [MCP tool annotations](/blog/mcp-tool-annotations-readonly-destructive-hints) for how tools can describe behavioral hints to clients; annotations do not enforce roots either.

A production server should log authorization decisions without leaking sensitive contents. Useful fields include the requested URI, selected root identifier, normalized path, operation type, decision, and reason. Avoid logging full file data or credentials merely because a path check failed.

## A server-side implementation pattern

The following pseudocode illustrates the policy rather than a particular SDK API:

```text
on_initialized:
    if client_capabilities.roots is unsupported:
        use configured policy or fail closed
    else:
        roots = request roots/list
        effective_roots = validate_and_canonicalize(roots)

on notifications/roots/list_changed:
    roots = request roots/list
    effective_roots = validate_and_canonicalize(roots)

before_file_operation(requested_uri, operation):
    target = parse_and_canonicalize(requested_uri)
    if target is not beneath any effective_root:
        return permission_error
    if operation is write and server_is_read_only:
        return permission_error
    if extension_or_operation_is_disallowed(target, operation):
        return permission_error
    return perform_operation(target)
```

There are several implementation choices to make explicit:

- **No roots:** fail closed for filesystem tools, or require a separately configured allowlist. Do not interpret no roots as “all paths.”
- **Invalid roots:** reject malformed, unsupported, or ambiguous URIs and report a clear protocol or tool error.
- **Root removal:** stop accepting new operations outside the refreshed set. Decide and document how in-flight reads and writes are handled.
- **Multiple roots:** preserve root identity when returning results so a client can distinguish similarly named directories.
- **URI and path conversion:** centralize conversion and canonicalization rather than duplicating it across tools.

This pattern applies whether a server exposes raw filesystem tools, project search, document conversion, repository operations, or resource subscriptions. The [MCP resources and prompts guide](/blog/mcp-resources-and-prompts-guide) covers those other primitives; roots are the scope input that filesystem-oriented implementations can use alongside them.

## Choosing a filesystem server

If you are evaluating an existing implementation, inspect how it handles allowed paths, roots, symlinks, writes, and remote execution instead of relying only on the server name. The [filesystem server directory](/best/file-systems) includes implementations with different scope and deployment models.

For example, [Filesystem](/mcp/filesystem) is described as providing configurable allowed paths and a reference-server setup. [fs-mcp-rs](/mcp/fs-mcp-rs) documents scoped roots, read-only mode, optional writes, search, and terminal sessions. Those features are useful signals for evaluation, but each server’s own configuration and enforcement behavior should be tested before production use.

Repository-oriented servers need the same discipline. A [Git MCP server](/mcp/git-mcp-server-2) may expose operations across a repository, but repository boundaries and filesystem boundaries are not automatically identical. A Git worktree, submodule, generated directory, or hook can introduce paths that deserve separate policy decisions.

## Testing MCP filesystem boundaries

Boundary tests should exercise both accepted and rejected cases. At minimum, test:

1. A file directly beneath a root.
2. A sibling directory with a similar name.
3. `..` traversal in a requested path.
4. A symlink from inside a root to a location outside it.
5. A root removed after initialization.
6. An empty roots response.
7. An unsupported URI scheme.
8. A recursive operation containing an escaping entry.
9. A write attempted when the server is read-only.
10. A Windows path and a case-variant path where applicable.

Test the wire behavior as well as the local policy. Confirm that the server requests `roots/list` after initialization, refreshes after `notifications/roots/list_changed`, and does not continue using a removed root for new work. Also test clients that omit the roots capability, because interoperability failures often appear when a server assumes every client supports the same optional feature.

A useful integration test records the client’s root list, invokes a read inside the root, and then attempts a read outside it through every relevant tool. The latter must be rejected even if the model supplies an absolute path or disguises traversal through a URI encoding. Repeat the test for writes, searches, archive operations, and any tool that shells out to another process.

## Next steps

Start by identifying which of your MCP tools touch files, then make their effective scope explicit and test it at the canonical-path layer. Compare implementations in the [best file systems MCP server listings](/best/file-systems), review [production MCP server architecture](/blog/architecting-production-mcp-servers), and use the [remote MCP deployment guide](/deploy-mcp-server) if the server runs outside the client’s host.
