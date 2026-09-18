import { describe, expect, it } from 'vitest';
import {
  collectInstallCandidates,
  type InstallHint,
  isPlausibleInstallPackage,
  isRemoteHint,
  looksLikeMcpEndpointUrl,
  parseInstallHint,
} from './parseInstallHint';

/** Narrow to a stdio hint, failing loudly instead of silently passing on null. */
function stdio(hint: ReturnType<typeof parseInstallHint>): InstallHint {
  expect(hint).toBeTruthy();
  expect(isRemoteHint(hint)).toBe(false);
  return hint as InstallHint;
}

describe('dev tooling is never mistaken for the server', () => {
  // The reported bug, from the owner of a hosted server with no npm package at all:
  // his listing's setup block told readers to run the MCP Inspector, because his README
  // has the standard "Test with MCP Inspector" section and the parser took the first
  // npx invocation it found.
  const inspectorReadme = [
    '# Magic Hour MCP Server',
    '',
    '## Setup',
    '',
    '```sh',
    'pip install -e .',
    '```',
    '',
    '## Test with MCP Inspector',
    '',
    '```sh',
    'npx @modelcontextprotocol/inspector',
    '```',
  ].join('\n');

  it('does not resolve a README whose only runner command is the Inspector', () => {
    expect(parseInstallHint(inspectorReadme)).toBeNull();
  });

  it('keeps looking past the Inspector for the real install command', () => {
    const hint = stdio(
      parseInstallHint(
        `${inspectorReadme}\n\n## Install\n\n\`npx -y magic-hour-mcp\``,
      ),
    );
    expect(hint.command).toBe('npx');
    expect(hint.args).toEqual(['-y', 'magic-hour-mcp']);
  });

  it('ignores a pinned version on a denied package', () => {
    expect(
      parseInstallHint('npx -y @modelcontextprotocol/inspector@latest'),
    ).toBeNull();
  });

  it('ignores installer CLIs that take the real package as an argument', () => {
    // Resolving the argument instead would be a different guess, not a better one:
    // "cool-mcp" here is a Smithery registry id, not necessarily an npm package.
    expect(
      parseInstallHint('npx -y @smithery/cli install cool-mcp --client claude'),
    ).toBeNull();
    expect(parseInstallHint('npx add-mcp cool-mcp')).toBeNull();
  });

  it('ignores deploy and test tooling shown in a Development section', () => {
    for (const cmd of [
      'npx wrangler deploy',
      'npx vitest run',
      'npx vercel --prod',
      'uvx pytest -q',
      'npx prisma migrate dev',
    ]) {
      expect(parseInstallHint(cmd), cmd).toBeNull();
    }
  });

  it('ignores a JSON config block that launches the Inspector', () => {
    expect(
      parseInstallHint(
        '{"command": "npx", "args": ["-y", "@modelcontextprotocol/inspector"]}',
      ),
    ).toBeNull();
  });
});

describe('flags are not package names', () => {
  it('skips a value-taking flag and keeps the real uvx invocation', () => {
    const hint = stdio(
      parseInstallHint('uvx --from mcp-server-git mcp-server-git'),
    );
    expect(hint.command).toBe('uvx');
    expect(hint.args).toEqual(['--from', 'mcp-server-git', 'mcp-server-git']);
    expect(hint.package).toBe('mcp-server-git');
  });

  it('reports the installed distribution, not the entry point, for --from', () => {
    const hint = stdio(
      parseInstallHint('uvx --from magic-hour-mcp magic-hour'),
    );
    expect(hint.args).toEqual(['--from', 'magic-hour-mcp', 'magic-hour']);
    expect(hint.package).toBe('magic-hour-mcp');
  });

  it('skips bare flags', () => {
    const hint = stdio(parseInstallHint('npx --yes weather-mcp'));
    expect(hint.args).toEqual(['--yes', 'weather-mcp']);
  });

  it('never returns a flag as the package', () => {
    for (const cmd of [
      'uvx --from',
      'npx -p',
      'npx --package',
      'uvx --python',
    ]) {
      expect(parseInstallHint(cmd), cmd).toBeNull();
    }
  });
});

describe('prose and placeholders are not package names', () => {
  it('does not take the next word of a sentence as a package', () => {
    expect(
      parseInstallHint('You can use npx to install the server.'),
    ).toBeNull();
  });

  it('rejects placeholders and generic example names', () => {
    for (const cmd of [
      'npx -y your-package-name',
      'npx -y mcp-server',
      'uvx mcp',
      'npx -y server',
    ]) {
      expect(parseInstallHint(cmd), cmd).toBeNull();
    }
  });

  it('rejects shell interpolation swallowed from a header example', () => {
    expect(isPlausibleInstallPackage('Authorization:${AUTH_HEADER}')).toBe(
      false,
    );
    expect(isPlausibleInstallPackage('<your-package>')).toBe(false);
    expect(isPlausibleInstallPackage('.')).toBe(false);
    expect(isPlausibleInstallPackage('/')).toBe(false);
  });

  it('still accepts ordinary and scoped package specs', () => {
    for (const pkg of [
      'weather-mcp',
      '@acme/weather-mcp',
      'weather-mcp@1.2.3',
      'github:acme/weather-mcp',
    ]) {
      expect(isPlausibleInstallPackage(pkg), pkg).toBe(true);
    }
  });
});

describe('remote wrappers resolve to the server they bridge to', () => {
  it('follows mcp-remote to its endpoint instead of caching the bridge', () => {
    const hint = parseInstallHint('npx -y mcp-remote https://acme.dev/mcp');
    expect(isRemoteHint(hint)).toBe(true);
    expect((hint as { url: string }).url).toBe('https://acme.dev/mcp');
  });

  it('resolves nothing when the bridge has no endpoint behind it', () => {
    expect(parseInstallHint('npx -y mcp-remote')).toBeNull();
  });
});

describe('endpoint bar', () => {
  it('rejects a .well-known descriptor document', () => {
    // Shaped like the best possible endpoint (mcp.* host, /mcp/ path) while being the
    // one URL on the page guaranteed not to speak MCP.
    expect(
      looksLikeMcpEndpointUrl(
        'https://mcp.magichour.ai/.well-known/mcp/server-card.json',
      ),
    ).toBe(false);
  });

  it('still accepts the hosted endpoint itself', () => {
    expect(looksLikeMcpEndpointUrl('https://mcp.magichour.ai/')).toBe(true);
  });
});

describe('ordinary READMEs still resolve', () => {
  it('reads a plain npx one-liner', () => {
    const hint = stdio(parseInstallHint('Run `npx -y weather-mcp` to start.'));
    expect(hint.command).toBe('npx');
    expect(hint.args).toEqual(['-y', 'weather-mcp']);
  });

  it('adds -y when the README omits it', () => {
    const hint = stdio(parseInstallHint('npx weather-mcp'));
    expect(hint.args).toEqual(['-y', 'weather-mcp']);
  });

  it('reads a JSON mcpServers block', () => {
    const hint = stdio(
      parseInstallHint(
        '{"mcpServers":{"weather":{"command":"npx","args":["-y","weather-mcp"]}}}',
      ),
    );
    expect(hint.command).toBe('npx');
    expect(hint.args).toEqual(['-y', 'weather-mcp']);
  });

  it('reads a pip install line as a uvx run', () => {
    const hint = stdio(parseInstallHint('pip install weather-mcp'));
    expect(hint.command).toBe('uvx');
    expect(hint.args).toEqual(['weather-mcp']);
  });

  it('does not treat a local editable install as a package', () => {
    expect(parseInstallHint('pip install -e .')).toBeNull();
  });

  it('collects every runner invocation for Jev to choose among', () => {
    const candidates = collectInstallCandidates(
      'Debug with npx -y @modelcontextprotocol/inspector\nThen run npx -y weather-mcp',
    );
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    const labels = candidates.map((c) =>
      'url' in c ? c.url : `${c.command} ${c.args.join(' ')}`,
    );
    expect(labels.some((l) => l.includes('weather-mcp'))).toBe(true);
  });
});

describe('"inspector" in a name is not the same as the Inspector', () => {
  it('rejects third-party rebuilds of the debugging UI and the bare word', () => {
    for (const pkg of ['@mcpjam/inspector', 'mcp-inspector', 'Inspector']) {
      expect(isPlausibleInstallPackage(pkg), pkg).toBe(false);
    }
  });

  it('keeps servers that genuinely inspect something', () => {
    for (const pkg of [
      '@gridinsoft/mcp-inspector',
      'ghost-inspector-mcp',
      'geo-inspector-mcp',
      'queue-inspector-mcp',
    ]) {
      expect(isPlausibleInstallPackage(pkg), pkg).toBe(true);
    }
  });
});
