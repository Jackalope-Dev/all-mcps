import { describe, expect, it } from 'vitest';
import {
  isUnverifiedInstall,
  resolveInstallConfig,
  runtimeLabel,
  toCachedInstallFields,
  transportLabel,
} from './installConfig';

const base = { id: 'brain-scanner', name: 'Brain Scanner' };

describe('resolveInstallConfig endpoint heuristics', () => {
  it('does NOT treat a bare product homepage as a remote MCP endpoint', () => {
    // The reported bug: this rendered one-click buttons pointing people's
    // clients at a marketing page.
    const install = resolveInstallConfig({
      ...base,
      url: 'https://brainscanner.dev',
    });
    expect(install.kind).not.toBe('remote');
  });

  it('still recognises URLs that genuinely look like endpoints', () => {
    for (const url of [
      'https://brainscanner.dev/mcp',
      'https://brainscanner.dev/mcp/v2',
      'https://example.com/sse',
      'https://api.example.com/v1',
      'https://mcp.example.com/',
    ]) {
      const install = resolveInstallConfig({ ...base, url });
      expect(install.kind, url).toBe('remote');
    }
  });

  it('does not mistake a docs path that merely contains the word', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://example.com/blog/mcpanel-review',
    });
    expect(install.kind).not.toBe('remote');
  });

  it('prefers an explicit remoteEndpointUrl over a cached parse', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://github.com/owner/repo',
      remoteEndpointUrl: 'https://brainscanner.dev/mcp/v2',
      installKind: 'stdio',
      installCommand: 'npx',
      installArgs: ['-y', 'guessed-package'],
      installConfidence: 'high',
    });
    expect(install).toMatchObject({
      kind: 'remote',
      url: 'https://brainscanner.dev/mcp/v2',
      confidence: 'high',
      source: 'submitted',
    });
  });

  it('falls back to the other sources when the endpoint is cleared', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://github.com/owner/repo',
      remoteEndpointUrl: '',
      installKind: 'stdio',
      installCommand: 'npx',
      installArgs: ['-y', 'real-package'],
      installConfidence: 'high',
    });
    expect(install).toMatchObject({ kind: 'stdio', command: 'npx' });
  });

  it('never resolves a GitHub repo URL to a remote endpoint', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://github.com/owner/mcp-server',
    });
    expect(install.kind).toBe('stdio');
  });
});

describe('resolveInstallConfig ignores stale cached endpoints', () => {
  // Rows written before the endpoint heuristic was tightened still hold plain
  // homepages in install_package, and cache outranks every other source — so
  // without a re-check the fixed heuristic never reached the listing.
  it('drops a cached remote URL that is not endpoint-shaped', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://brainscanner.dev',
      installKind: 'remote',
      installPackage: 'https://brainscanner.dev',
      installConfidence: 'medium',
    });
    expect(install.kind).not.toBe('remote');
  });

  it('keeps a cached remote URL that is endpoint-shaped', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://github.com/owner/repo',
      installKind: 'remote',
      installPackage: 'https://brainscanner.dev/mcp/v2',
      installConfidence: 'high',
    });
    expect(install).toMatchObject({
      kind: 'remote',
      url: 'https://brainscanner.dev/mcp/v2',
      source: 'cached',
    });
  });

  it('does not promote a signup/docs link in the description to an endpoint', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://brainscanner.dev',
      description:
        'Hosted brain scanning for agents. Sign up at https://brainscanner.dev/signup and follow the setup guide at https://brainscanner.dev/connect.',
    });
    expect(install.kind).not.toBe('remote');
  });

  it('still finds a real endpoint mentioned after a homepage link', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://github.com/owner/repo',
      description:
        'Docs at https://brainscanner.dev/connect. Connect your client to https://brainscanner.dev/mcp/v2 with OAuth.',
    });
    expect(install).toMatchObject({
      kind: 'remote',
      url: 'https://brainscanner.dev/mcp/v2',
    });
  });
});

describe('isUnverifiedInstall', () => {
  it('flags a runner+package guessed from the listing name', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://brainscanner.dev',
    });
    expect(install.source).toBe('heuristic');
    expect(isUnverifiedInstall(install)).toBe(true);
  });

  it('does not flag an owner-set endpoint or a parsed README command', () => {
    expect(
      isUnverifiedInstall(
        resolveInstallConfig({
          ...base,
          url: 'https://github.com/owner/repo',
          remoteEndpointUrl: 'https://brainscanner.dev/mcp/v2',
        }),
      ),
    ).toBe(false);
    expect(
      isUnverifiedInstall(
        resolveInstallConfig({
          ...base,
          url: 'https://github.com/owner/repo',
          description: 'Install with npx -y brain-scanner-mcp',
        }),
      ),
    ).toBe(false);
  });
});

describe('endpoint bar rejects README artefacts', () => {
  // Both shapes were sitting in install_package on thousands of live rows.
  it('rejects a mangled markdown link fragment that ends in a real-looking path', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://github.com/owner/repo',
      installKind: 'remote',
      installPackage:
        'https://img.shields.io/badge/MCP-blue)](https://aidc-ai.io/api/mcp',
      installConfidence: 'high',
    });
    expect(install.kind).not.toBe('remote');
  });

  it('rejects the spec site linked by half the READMEs on the internet', () => {
    for (const url of [
      'https://modelcontextprotocol.io',
      'https://modelcontextprotocol.io/introduction',
      'https://spec.modelcontextprotocol.io/specification/2024-11-05/server/',
    ]) {
      const install = resolveInstallConfig({
        ...base,
        url: 'https://github.com/owner/repo',
        installKind: 'remote',
        installPackage: url,
        installConfidence: 'high',
      });
      expect(install.kind, url).not.toBe('remote');
    }
  });
});

describe('toCachedInstallFields refuses to persist a non-endpoint as remote', () => {
  // The write-side choke point: the read side alone was not enough, because other
  // consumers (endpoint liveness, vuln scanning) read these columns directly.
  it('returns null for a remote install whose URL is not endpoint-shaped', () => {
    expect(
      toCachedInstallFields({
        kind: 'remote',
        url: 'https://brainscanner.dev',
        confidence: 'high',
        source: 'description',
      }),
    ).toBeNull();
    expect(
      toCachedInstallFields({
        kind: 'remote',
        url: 'https://modelcontextprotocol.io/introduction',
        confidence: 'high',
        source: 'description',
      }),
    ).toBeNull();
  });

  it('still persists a real endpoint and any stdio install', () => {
    expect(
      toCachedInstallFields({
        kind: 'remote',
        url: 'https://brainscanner.dev/mcp/v2',
        confidence: 'high',
        source: 'submitted',
      }),
    ).toMatchObject({
      installKind: 'remote',
      installPackage: 'https://brainscanner.dev/mcp/v2',
    });
    expect(
      toCachedInstallFields({
        kind: 'stdio',
        command: 'npx',
        args: ['-y', 'real-package'],
        packageName: 'real-package',
        confidence: 'high',
        source: 'description',
      }),
    ).toMatchObject({ installKind: 'stdio', installPackage: 'real-package' });
  });
});

describe('transport / runtime labels', () => {
  it('omits both for a hosted listing we only have a homepage for', () => {
    // The reported case: a hosted server whose primary URL is a marketing page
    // resolved to a low-confidence stdio guess, and the listing published
    // "Transport SSE (Remote)" and "Runtime Node.js" anyway.
    const install = resolveInstallConfig({
      ...base,
      url: 'https://brainscanner.dev',
      description: 'Hosted brain scanning for your agents. Sign up to begin.',
    });
    expect(isUnverifiedInstall(install)).toBe(true);
    expect(transportLabel(install)).toBeNull();
    expect(runtimeLabel(install)).toBeNull();
  });

  it('never guesses Node.js from the description alone', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://example.com',
      description: 'A python-powered analysis server.',
    });
    expect(runtimeLabel(install)).toBeNull();
  });

  it('reports a confirmed stdio runner', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://github.com/acme/brain-scanner',
      installKind: 'stdio',
      installCommand: 'uvx',
      installArgs: ['real-package'],
      installPackage: 'real-package',
      installConfidence: 'high',
    });
    expect(transportLabel(install)).toBe('STDIO');
    expect(runtimeLabel(install)).toBe('Python');
  });

  it('reports transport but no local runtime for a confirmed remote server', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://brainscanner.dev',
      remoteEndpointUrl: 'https://brainscanner.dev/mcp',
    });
    expect(install.kind).toBe('remote');
    expect(transportLabel(install)).toBe('SSE (Remote)');
    expect(runtimeLabel(install)).toBeNull();
  });
});

describe('resolveInstallConfig ignores cached non-server packages', () => {
  // Reported by a server owner: his listing's setup block ran the MCP Inspector, a
  // debugging tool, as if it were his server. 246 listings cached that package, plus
  // hundreds more holding installer CLIs, deploy tooling and bare flags — all written at
  // high confidence by the old README parser, and cache outranks every other source here.
  const cachedInspector = {
    installKind: 'stdio',
    installCommand: 'npx',
    installArgs: '["-y","@modelcontextprotocol/inspector"]',
    installPackage: '@modelcontextprotocol/inspector',
    installConfidence: 'high',
  };

  it('does not serve a cached debugging CLI as the install command', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://github.com/acme/brain-scanner',
      ...cachedInspector,
    });
    expect(install.source).not.toBe('cached');
    // Nothing verified is left, so what remains must mark itself as a guess rather than
    // render as a ready-to-run config block.
    expect(isUnverifiedInstall(install)).toBe(true);
  });

  it('does not claim a runtime on the strength of a cached dev tool', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://github.com/acme/brain-scanner',
      ...cachedInspector,
    });
    expect(runtimeLabel(install)).toBeNull();
    expect(transportLabel(install)).toBeNull();
  });

  it('drops cached flags and prose captured as package names', () => {
    for (const packageName of ['--from', '-p', 'to', 'mcp', 'wrangler']) {
      const install = resolveInstallConfig({
        ...base,
        url: 'https://github.com/acme/brain-scanner',
        installKind: 'stdio',
        installCommand: 'npx',
        installArgs: JSON.stringify(['-y', packageName]),
        installPackage: packageName,
        installConfidence: 'high',
      });
      expect(install.source, packageName).not.toBe('cached');
    }
  });

  it('still serves a genuine cached install', () => {
    const install = resolveInstallConfig({
      ...base,
      url: 'https://github.com/acme/brain-scanner',
      installKind: 'stdio',
      installCommand: 'npx',
      installArgs: '["-y","brain-scanner-mcp"]',
      installPackage: 'brain-scanner-mcp',
      installConfidence: 'high',
    });
    expect(install.source).toBe('cached');
    expect(install.kind === 'stdio' && install.packageName).toBe(
      'brain-scanner-mcp',
    );
  });
});

describe('toCachedInstallFields refuses to persist a non-server package', () => {
  it('returns null for a dev tool, an installer CLI or a flag', () => {
    for (const packageName of [
      '@modelcontextprotocol/inspector',
      '@smithery/cli',
      'wrangler',
      '--from',
      'your-package-name',
    ]) {
      expect(
        toCachedInstallFields({
          kind: 'stdio',
          command: 'npx',
          args: ['-y', packageName],
          packageName,
          confidence: 'high',
          source: 'description',
        }),
        packageName,
      ).toBeNull();
    }
  });
});
