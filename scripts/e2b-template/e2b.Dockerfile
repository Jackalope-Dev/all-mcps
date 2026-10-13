# Custom E2B sandbox for scripts/e2b-stdio-verify.mjs.
#
# The base image has node/npx but not uv/uvx, so every uvx listing paid for a
# uv install inside its own sandbox (see withRunnerBootstrap). Baking the
# runners in removes that per-run cost and a class of bootstrap timeouts.
#
# Build once (needs the e2b CLI, logged in):
#   cd scripts/e2b-template && e2b template build --name allmcps-verify
# Then set the E2B_TEMPLATE repository variable to `allmcps-verify`.
FROM e2bdev/base

RUN apt-get update \
  && apt-get install -y --no-install-recommends git python3 python3-pip python3-venv iproute2 \
  && rm -rf /var/lib/apt/lists/*

# uv / uvx for PyPI-based MCP servers, installed for the sandbox user.
USER user
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/home/user/.local/bin:${PATH}"
