---
title: "Build MCP Server Python FastMCP with uvx Packaging"
excerpt: "Build an MCP server in Python with FastMCP using decorators, typed tool arguments, context logging, and uv packaging that runs through uvx."
tags: ["MCP", "Developer Tools", "Guides", "Architecture"]
faq:
  - q: "Is FastMCP part of the Python MCP SDK?"
    a: "FastMCP and the official Python MCP SDK are related but should not be treated as interchangeable package APIs. FastMCP is commonly used as a Python framework with decorator-based server registration, while the official SDK is distributed separately and its APIs depend on the release you install. This tutorial uses the standalone fastmcp package and recommends pinning the version you test."
  - q: "How do I run a FastMCP server with uvx?"
    a: "Define a console script in pyproject.toml, build or publish the package, and run that command with uvx --from. For example, uvx --from weather-mcp weather-mcp installs the distribution into an isolated environment and starts its executable. Test the command against a built wheel before publishing so missing modules and dependencies are found early."
  - q: "How does FastMCP create schemas from Python types?"
    a: "FastMCP inspects a decorated function's signature and annotations to generate the tool input schema exposed through MCP. Types such as str, int, lists, dictionaries, defaults, and Literal values can describe the expected inputs. Generated schemas do not replace application checks, so enforce limits, authorization, path restrictions, and other business rules inside the tool."
  - q: "How should a FastMCP server write logs?"
    a: "Use FastMCP Context methods such as await ctx.info() when a diagnostic or progress message should be sent to the connected MCP client. Never use ordinary print calls for debugging in a stdio server because stdout carries protocol messages. Configure Python logging for server-side diagnostics and send those records to stderr or a managed log sink."
---

Build an MCP server in Python with FastMCP by creating a `FastMCP` instance and registering typed Python functions with `@mcp.tool()`. FastMCP can derive tool schemas from annotations, validate incoming arguments, and handle MCP protocol details; `uv` packages the project so clients can launch it with `uvx`. This tutorial builds a runnable server, adds context logging, tests the package boundary, and configures a stdio client.

## What you will build

The example is a small weather-style server. It returns placeholder data rather than calling a real weather API, so it needs no credentials while still showing the implementation details that matter in a real integration:

- A `FastMCP` server instance
- A decorator-registered tool
- Typed and constrained tool arguments
- A correctly injected `Context` parameter
- Client-visible logging without corrupting stdout
- A `pyproject.toml` console script that runs through `uvx`

FastMCP is a Python framework for MCP applications. It is not safe to assume that every FastMCP release has identical APIs, especially around testing helpers, CLI commands, and context injection. The code below uses the standalone `fastmcp` package and should be tested against the version recorded in your lockfile.

For protocol concepts and design decisions outside the FastMCP implementation, see the [MCP server development guide](/build-mcp-server). This article concentrates on a practical FastMCP project and its packaging workflow.

## Create the project with uv

Install `uv` using the method appropriate for your operating system, then create a project:

```bash
uv init weather-mcp
cd weather-mcp
uv add fastmcp
```

The `uv add` command adds the dependency to `pyproject.toml` and updates `uv.lock`. Commit the lockfile so local development and CI resolve the same dependency versions. For a server distributed to other people, pin FastMCP and other compatibility-sensitive dependencies after you have tested them.

Check the installed package from the project environment:

```bash
uv run python -c "import fastmcp; print(getattr(fastmcp, '__version__', 'version attribute unavailable'))"
```

The version attribute is not guaranteed to exist in every package release, which is why the command uses `getattr`. The important check is that the import succeeds inside the same environment used by `uv run` and later by the built package.

Create this layout:

```text
weather-mcp/
├── pyproject.toml
└── src/
    └── weather_mcp/
        ├── __init__.py
        └── server.py
```

A `src` layout makes accidental imports from the repository root less likely. It also forces you to verify that the package contains the module that the eventual wheel and console script need.

## Define the FastMCP server

Put the following code in `src/weather_mcp/server.py`:

```python
from typing import Literal

from fastmcp import Context, FastMCP

mcp = FastMCP("Weather MCP")


def _weather_result(
    city: str,
    units: Literal["celsius", "fahrenheit"],
) -> dict[str, str]:
    """Return deterministic placeholder data for local testing."""
    temperature = "21" if units == "celsius" else "70"
    return {
        "city": city,
        "temperature": temperature,
        "units": units,
        "summary": "clear",
    }


@mcp.tool()
async def get_weather(
    city: str,
    ctx: Context,
    units: Literal["celsius", "fahrenheit"] = "celsius",
) -> dict[str, str]:
    """Return a small weather summary for a city."""
    await ctx.info(f"Looking up weather for {city} in {units}")
    result = _weather_result(city, units)
    await ctx.info(f"Weather lookup completed for {city}")
    return result


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
```

The parameter order is important Python syntax as well as an integration detail. `ctx` comes before `units`, because a required parameter cannot follow a parameter with a default value. The same rule applies to every defaulted argument in a tool signature.

The `@mcp.tool()` decorator registers `get_weather` as an MCP tool. The function name is normally used as the tool name, and the docstring can provide tool documentation. Keep names stable after clients, prompts, or automation depend on them. If your FastMCP version supports explicit decorator options for names or descriptions, use those deliberately and verify the resulting schema.

`city: str` describes a string input. `Literal["celsius", "fahrenheit"]` communicates an enum-like constraint to schema generation and runtime validation. The default makes `units` optional for callers. The return annotation documents the intended result shape, although exact conversion behavior can vary between FastMCP versions.

The `Context` parameter is framework-injected rather than an ordinary tool argument. Declaring it as `ctx: Context` is the least ambiguous form for the versions that use signature inspection to identify context parameters. Avoid changing it casually to `Context | None` or `Optional[Context]`; some releases or configurations may then interpret it as a normal input or fail during registration.

The private helper is intentionally independent of MCP. That makes ordinary unit tests simple:

```python
from weather_mcp.server import _weather_result


def test_weather_result() -> None:
    result = _weather_result("Paris", "celsius")
    assert result["temperature"] == "21"
```

For an integration test, exercise the decorated server through a FastMCP-supported client or test transport for the exact version in `uv.lock`. Do not call `get_weather("Paris", ...)` as if it were an ordinary function unless you also provide the framework context expected by that release.

## Use typed arguments as a contract

Automatic schemas are useful only when the annotations represent the real contract. A search tool might look like this:

```python
@mcp.tool()
async def search_documents(
    query: str,
    ctx: Context,
    limit: int = 10,
    order: Literal["relevance", "recent"] = "relevance",
) -> list[dict[str, str]]:
    """Search indexed documents with a bounded result count."""
    await ctx.debug(f"Searching for {query!r}")

    if not query.strip():
        raise ValueError("query must not be empty")
    if not 1 <= limit <= 50:
        raise ValueError("limit must be between 1 and 50")

    # Query your index here.
    return []
```

Again, `ctx` precedes the defaulted `limit` and `order` parameters. The annotations help the client understand what to send, but they do not enforce operational policy by themselves. An integer can be syntactically valid and still be too large for your database or API. Validate lengths, ranges, identifiers, file paths, and permissions before performing expensive or privileged work.

For nested input, use an explicit typed model if the FastMCP release and model library in your project support it. A small public input model is usually safer than accepting an arbitrary dictionary. It produces a clearer contract and reduces the amount of unvalidated data reaching the implementation.

## Log through Context without breaking stdio

A stdio MCP server uses stdout for protocol traffic. A stray `print()` can insert non-protocol text into that stream and cause the client to report a JSON or transport error. Use context methods for messages intended for the connected client:

```python
@mcp.tool()
async def rebuild_index(ctx: Context) -> str:
    await ctx.info("Starting index rebuild")
    # Perform work here.
    await ctx.info("Index rebuild completed")
    return "completed"
```

Context logging is suitable for progress and user-visible diagnostics. Whether a client displays `info`, `debug`, or other notifications varies by client and version, so test with the clients you intend to support.

For operational logs that should remain on the server, use Python's `logging` module and configure a handler that writes to stderr, a file, or your process supervisor. Do not log API keys, access tokens, authorization headers, or sensitive tool arguments. Context messages may be shown to users or retained by a client.

## Run the server locally

Install the locked environment and run the module:

```bash
uv sync
uv run python -m weather_mcp.server
```

The process will wait for MCP messages on stdin when using the default stdio behavior. Do not expect a browser page or ordinary terminal output. If you need a development CLI, inspect the commands provided by your installed release:

```bash
uv run fastmcp --help
```

CLI options and transport defaults can vary, so verify the version-specific behavior before using a development command in production configuration. For local desktop integrations, stdio is often the simplest transport because the client starts and supervises the server process.

You can also use the [AllMCPs MCP playground](/tools/playground) for interactive inspection where the server type and connection options are supported.

## Package the server for uvx

Configure package metadata and a console script in `pyproject.toml`:

```toml
[project]
name = "weather-mcp"
version = "0.1.0"
description = "A small weather MCP server"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    "fastmcp",
]

[project.scripts]
weather-mcp = "weather_mcp.server:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

`uv init` may generate some of these fields already. Add the `project.scripts` table instead of duplicating an existing section. The left side, `weather-mcp`, is the executable command. The right side points to the importable module and function that starts the server.

Run the entry point locally:

```bash
uv sync
uv run weather-mcp
```

Now build a wheel and test that artifact in an isolated environment:

```bash
uv build
uvx --from dist/weather_mcp-0.1.0-py3-none-any.whl weather-mcp
```

The generated filename changes when the version changes, so list the `dist` directory if necessary. Testing the wheel matters: `uv run` from the repository can succeed even when package discovery, dependencies, or console-script metadata are incomplete.

After publishing the distribution to a package index, the same command becomes:

```bash
uvx --from weather-mcp weather-mcp
```

The distribution name and executable name do not have to match, but matching them reduces configuration errors. For a Git-based package, use a tag or commit when reproducibility matters rather than tracking a moving branch.

## Configure an MCP client

A typical stdio configuration launches the package through `uvx`:

```json
{
  "mcpServers": {
    "weather": {
      "command": "uvx",
      "args": [
        "--from",
        "weather-mcp",
        "weather-mcp"
      ]
    }
  }
}
```

File locations and configuration keys differ between clients. Use the relevant guides for [Claude Desktop](/clients/claude-desktop), [Cursor](/clients/cursor), [VS Code with GitHub Copilot](/clients/vs-code), [Cline](/clients/cline), or [Claude Code](/clients/claude-code). Some clients support an `env` object; others require environment variables to be configured in the operating system or shell.

For a server that needs credentials, pass environment variables instead of command-line arguments where the client supports it:

```json
{
  "mcpServers": {
    "weather": {
      "command": "uvx",
      "args": ["--from", "weather-mcp", "weather-mcp"],
      "env": {
        "WEATHER_API_KEY": "set-this-in-the-client-environment"
      }
    }
  }
}
```

Do not commit real secrets. Confirm how your chosen client stores configuration and whether it passes the `env` mapping to child processes.

## Verify and troubleshoot the package

Run the exact launch command outside the client first:

```bash
uvx --from weather-mcp weather-mcp
```

Then work through these checks:

1. **The command is not found.** Confirm that the package contains the `project.scripts` entry and that the argument after `--from` is the executable name.
2. **The module cannot be imported.** Test the built wheel rather than only running from the repository. Confirm that `src/weather_mcp/__init__.py` and `server.py` are included.
3. **The client reports malformed protocol data.** Remove `print()` calls and route ordinary logs to stderr. Stdout must remain available for MCP traffic.
4. **`ctx` appears in the tool schema.** Check that the parameter is annotated as the required `Context` type and that it appears before all defaulted parameters. Confirm that the installed FastMCP version matches your tested version.
5. **The schema is too permissive.** Replace untyped dictionaries and strings with concrete annotations, `Literal` values, or supported typed models, then add application-level validation.
6. **A dependency works locally but not with `uvx`.** Add it to `[project].dependencies`; packages installed manually in your development environment are not automatically included in the isolated `uvx` environment.
7. **Relative paths fail in the client.** Resolve paths deliberately or use package resources and environment variables. A client may launch the process with a different working directory.

Once the server works, pin the FastMCP version and commit `uv.lock`. A lockfile gives reproducible project resolution, while an exact requirement in `pyproject.toml` communicates a stricter compatibility expectation to package installers. Re-run the wheel test after dependency upgrades because generated schemas, context injection, and CLI behavior can change between releases.

## Next steps

Start with one typed tool and verify both `uv run` and the built-wheel `uvx` command before adding external APIs or privileged operations. Review the [FastMCP directory listing](/mcp/fastmcp), then connect the package using the [MCP installation guide](/blog/how-to-install-mcp-servers-in-claude-cursor-windsurf-and-vs-code). For transport, security, and architecture decisions beyond this example, return to the [MCP server development guide](/build-mcp-server).
