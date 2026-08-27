/**
 * MCP client definitions powering /clients and /clients/[client]. Each client is
 * a high-intent landing page: how to install an MCP server in that client, the
 * canonical config location and shape, a HowTo/FAQ for answer-engine visibility,
 * and a live "popular servers" list drawn from the catalog on the page itself.
 *
 * Config locations and steps describe the standard stdio setup. Keep them
 * canonical rather than version-specific so they stay accurate as clients evolve.
 */
export type ClientStep = { title: string; body: string };
export type ClientConfigLocation = { os: string; path: string };

export type McpClient = {
  /** URL slug: /clients/<slug> */
  slug: string;
  /** Display / product name, e.g. "Claude Desktop". */
  name: string;
  /** Primary configuration file basename. */
  configFilename: string;
  /** Tag/Badge describing client environment (Desktop, IDE, CLI, etc.). */
  badgeText: string;
  /** One-line meta/intro summary. */
  lead: string;
  /** The JSON key servers are nested under in this client's config. */
  configKey: string;
  /** Where the config file lives, per OS (empty when the client is CLI-first). */
  configLocations: ClientConfigLocation[];
  /** A minimal, copy-pasteable config snippet for this client. */
  configExample: string;
  /** Ordered setup steps — also emitted as HowTo structured data. */
  steps: ClientStep[];
  /** Client-specific FAQ — emitted as FAQPage structured data. */
  faq: { q: string; a: string }[];
};

/** Standard stdio server block, reused across clients that use `mcpServers`. */
function mcpServersExample(configKey: string): string {
  return `{
  "${configKey}": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"],
      "env": {}
    }
  }
}`;
}

export const MCP_CLIENTS: McpClient[] = [
  {
    slug: 'claude-desktop',
    name: 'Claude Desktop',
    configFilename: 'claude_desktop_config.json',
    badgeText: 'Desktop App',
    lead: 'How to install and configure MCP servers in Claude Desktop on macOS and Windows — the config file location, the exact JSON shape, and how to verify your tools loaded.',
    configKey: 'mcpServers',
    configLocations: [
      {
        os: 'macOS',
        path: '~/Library/Application Support/Claude/claude_desktop_config.json',
      },
      { os: 'Windows', path: '%APPDATA%\\Claude\\claude_desktop_config.json' },
    ],
    configExample: mcpServersExample('mcpServers'),
    steps: [
      {
        title: 'Open the config file',
        body: 'In Claude Desktop, go to Settings → Developer → Edit Config. This opens (or creates) claude_desktop_config.json in your text editor. You can also open the file directly at the path for your OS.',
      },
      {
        title: 'Add the server under mcpServers',
        body: 'Add an entry inside the "mcpServers" object with a name, a "command", and its "args". Put any secrets in the "env" object rather than inline in the args.',
      },
      {
        title: 'Save and fully restart Claude Desktop',
        body: 'Quit Claude Desktop completely (not just the window) and reopen it. MCP servers are only launched on startup, so config edits are ignored until a full restart.',
      },
      {
        title: 'Verify the tools loaded',
        body: 'Open a new chat and look for the tools/MCP indicator. If the server shows zero tools or an error, check the MCP log at ~/Library/Logs/Claude/mcp*.log (macOS) or %APPDATA%\\Claude\\logs (Windows).',
      },
    ],
    faq: [
      {
        q: 'Where is the Claude Desktop MCP config file?',
        a: 'On macOS it is ~/Library/Application Support/Claude/claude_desktop_config.json; on Windows it is %APPDATA%\\Claude\\claude_desktop_config.json. The fastest way to open it is Settings → Developer → Edit Config, which creates the file if it does not exist.',
      },
      {
        q: 'Why does my MCP server show zero tools in Claude Desktop?',
        a: 'The server process usually started but crashed before responding to the tools/list request — commonly a missing environment variable, a bad command path, or non-JSON output on stdout. Open the per-server log at ~/Library/Logs/Claude/mcp*.log to see the actual error.',
      },
      {
        q: 'Do I need to restart Claude Desktop after editing the config?',
        a: 'Yes. Claude Desktop only launches MCP servers at startup, so you must fully quit and reopen the app — closing the window is not enough.',
      },
    ],
  },
  {
    slug: 'cursor',
    name: 'Cursor',
    configFilename: 'mcp.json',
    badgeText: 'AI Editor',
    lead: 'How to install MCP servers in Cursor — the global and per-project mcp.json files, adding a server from Settings, and enabling tools in the Agent.',
    configKey: 'mcpServers',
    configLocations: [
      { os: 'Global', path: '~/.cursor/mcp.json' },
      { os: 'Project', path: '.cursor/mcp.json in your project root' },
    ],
    configExample: mcpServersExample('mcpServers'),
    steps: [
      {
        title: 'Open MCP settings',
        body: 'Go to Cursor Settings → MCP → Add new MCP server, or edit the JSON directly: ~/.cursor/mcp.json for every project, or .cursor/mcp.json in a project root to scope it to that repo.',
      },
      {
        title: 'Add the server under mcpServers',
        body: 'Add a named entry with a "command" and "args" (and "env" for secrets), using the same stdio shape as other MCP clients.',
      },
      {
        title: 'Enable it and use it in the Agent',
        body: 'Cursor picks up the change automatically; make sure the server is toggled on in the MCP settings. Its tools then become available to the Agent (Composer) — the model calls them when relevant.',
      },
    ],
    faq: [
      {
        q: 'Where does Cursor store its MCP config?',
        a: 'Cursor reads ~/.cursor/mcp.json for a global configuration available in every project, and .cursor/mcp.json in a project root for servers scoped to that repository. Both use the same "mcpServers" JSON shape as Claude Desktop.',
      },
      {
        q: 'Why are my Cursor MCP tools not showing up?',
        a: 'Confirm the server is toggled on in Cursor Settings → MCP, that the command runs on its own in a terminal, and that you are using the Agent (Composer), since MCP tools are called from agent mode. A red status in the MCP panel usually shows the underlying error.',
      },
      {
        q: 'Can I share MCP servers with my team in Cursor?',
        a: 'Yes — commit a .cursor/mcp.json to your repository. Anyone who opens the project in Cursor gets the same servers, though each person still supplies their own secrets via env values.',
      },
    ],
  },
  {
    slug: 'cline',
    name: 'Cline / VS Code',
    configFilename: 'cline_mcp_settings.json',
    badgeText: 'VS Code Extension',
    lead: 'How to configure MCP servers for Cline (formerly Claude Dev) in VS Code — settings file location, standard JSON structure, and enabling tool permissions.',
    configKey: 'mcpServers',
    configLocations: [
      {
        os: 'macOS',
        path: '~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
      },
      {
        os: 'Windows',
        path: '%APPDATA%\\Code\\User\\globalStorage\\saoudrizwan.claude-dev\\settings\\cline_mcp_settings.json',
      },
    ],
    configExample: `{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite"],
      "disabled": false,
      "autoApprove": []
    }
  }
}`,
    steps: [
      {
        title: 'Open Cline MCP Settings',
        body: 'In VS Code, click the Cline icon in the activity bar, select the gear/MCP settings icon, or edit cline_mcp_settings.json directly.',
      },
      {
        title: 'Add the server configuration',
        body: 'Paste your server under "mcpServers". You can optionally specify autoApprove tool arrays or set disabled: false.',
      },
      {
        title: 'Test tool execution',
        body: 'Prompt Cline in VS Code to use the newly added tool. Cline will prompt for permission or automatically run the tool based on your settings.',
      },
    ],
    faq: [
      {
        q: 'Where is the Cline MCP settings file located?',
        a: 'It lives inside VS Code globalStorage under saoudrizwan.claude-dev/settings/cline_mcp_settings.json. The easiest way to open it is clicking the gear icon in the Cline side panel.',
      },
      {
        q: 'Can Cline auto-approve MCP tool calls?',
        a: 'Yes, inside cline_mcp_settings.json you can add tool names to the "autoApprove": [] array for that server.',
      },
    ],
  },
  {
    slug: 'windsurf',
    name: 'Windsurf',
    configFilename: 'mcp_config.json',
    badgeText: 'AI Editor',
    lead: 'How to configure MCP servers in Windsurf (Codeium) — the mcp_config.json location, the JSON shape, and how to load the servers into Cascade.',
    configKey: 'mcpServers',
    configLocations: [
      { os: 'All platforms', path: '~/.codeium/windsurf/mcp_config.json' },
    ],
    configExample: mcpServersExample('mcpServers'),
    steps: [
      {
        title: 'Open the MCP config',
        body: 'In Windsurf, open Cascade and go to the MCP / plugins settings, then choose to edit the raw config — or open ~/.codeium/windsurf/mcp_config.json directly.',
      },
      {
        title: 'Add the server under mcpServers',
        body: 'Add a named entry with "command", "args", and an optional "env" object for secrets, using the standard stdio shape.',
      },
      {
        title: 'Refresh and use it in Cascade',
        body: 'Save the file and refresh the MCP servers from the Windsurf MCP panel (or restart Windsurf). The tools then become available to Cascade.',
      },
    ],
    faq: [
      {
        q: 'Where is the Windsurf MCP config file?',
        a: 'Windsurf reads ~/.codeium/windsurf/mcp_config.json. You can edit it from the MCP settings inside Cascade or open the file directly. It uses the same "mcpServers" shape as other MCP clients.',
      },
      {
        q: 'How do I reload MCP servers in Windsurf?',
        a: 'After editing mcp_config.json, use the refresh action in the Windsurf MCP panel, or restart Windsurf. New or changed servers are not picked up until you refresh or relaunch.',
      },
      {
        q: 'Does Windsurf support the same MCP servers as Cursor and Claude?',
        a: 'Yes. MCP is a shared protocol, so any stdio MCP server works across Windsurf, Cursor, Claude Desktop, and Claude Code — only the config file location and, for VS Code, the JSON key differ.',
      },
    ],
  },
  {
    slug: 'claude-code',
    name: 'Claude Code',
    configFilename: '.mcp.json / ~/.claude.json',
    badgeText: 'Terminal CLI',
    lead: 'How to add MCP servers to Claude Code from the terminal — the claude mcp add command, project vs user scope, and how to confirm the server connected.',
    configKey: 'mcpServers',
    configLocations: [
      { os: 'Project (shared)', path: '.mcp.json in your project root' },
      { os: 'User (global)', path: '~/.claude.json' },
    ],
    configExample: `# Add a server from the terminal
claude mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/dir

# List configured servers and their status
claude mcp list`,
    steps: [
      {
        title: 'Add the server with the CLI',
        body: 'Run "claude mcp add <name> -- <command> [args...]". Everything after the -- is the command Claude Code runs to launch the server. Use -e KEY=value to pass environment variables.',
      },
      {
        title: 'Choose a scope',
        body: 'Add --scope project to write the server into a shared .mcp.json your team commits, or --scope user to make it available across all your projects. Local scope (the default) keeps it to the current project for just you.',
      },
      {
        title: 'Verify the connection',
        body: 'Run "claude mcp list" to see each server and whether it connected. You can also use the /mcp command inside a Claude Code session to inspect available servers and tools.',
      },
    ],
    faq: [
      {
        q: 'How do I add an MCP server to Claude Code?',
        a: 'Use the terminal: claude mcp add <name> -- <command> [args...]. For example, claude mcp add github -- npx -y @modelcontextprotocol/server-github. Add -e KEY=value for secrets and --scope project or user to control where it is stored.',
      },
      {
        q: 'What is the difference between project and user scope in Claude Code?',
        a: 'Project scope writes to a .mcp.json in the repository so your whole team shares the server; user scope stores it in your global config so it follows you across projects. Local (default) scope keeps it to the current project for only you.',
      },
      {
        q: 'How do I check whether a Claude Code MCP server connected?',
        a: 'Run claude mcp list from the terminal, or use the /mcp slash command inside a session. For verbose connection logs, start Claude Code with the --debug flag.',
      },
    ],
  },
  {
    slug: 'vs-code',
    name: 'VS Code (GitHub Copilot)',
    configFilename: '.vscode/mcp.json',
    badgeText: 'IDE Extension',
    lead: 'How to add MCP servers to VS Code for GitHub Copilot agent mode — the .vscode/mcp.json file, the servers key, and enabling tools in Copilot Chat.',
    configKey: 'servers',
    configLocations: [
      { os: 'Workspace', path: '.vscode/mcp.json in your project root' },
      {
        os: 'User',
        path: 'the "mcp" section of your VS Code user settings.json',
      },
    ],
    configExample: `{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
    }
  }
}`,
    steps: [
      {
        title: 'Create the MCP config',
        body: 'Run "MCP: Add Server" from the Command Palette, or create .vscode/mcp.json in your project. Note that VS Code nests servers under a "servers" key — not "mcpServers" like other clients.',
      },
      {
        title: 'Add the server definition',
        body: 'Add a named entry with a "command" and "args". For secrets, use VS Code "inputs" so the value is prompted for and stored securely instead of hard-coded in the file.',
      },
      {
        title: 'Enable it in Copilot agent mode',
        body: 'Open Copilot Chat and switch to Agent mode, then start the server from the MCP prompt. The tools become available for Copilot to call during agent tasks.',
      },
    ],
    faq: [
      {
        q: 'How do I add an MCP server to VS Code?',
        a: 'Create a .vscode/mcp.json in your project (or run "MCP: Add Server" from the Command Palette) and add the server under a "servers" key. MCP tools are used from GitHub Copilot Chat in Agent mode.',
      },
      {
        q: 'Why does VS Code use "servers" instead of "mcpServers"?',
        a: 'VS Code adopted its own schema and nests MCP servers under a "servers" key, with support for a separate "inputs" array for prompted secrets. If you copy a config from Claude or Cursor, rename "mcpServers" to "servers".',
      },
      {
        q: 'Do I need Copilot agent mode to use MCP in VS Code?',
        a: 'Yes — MCP tools are invoked from Copilot Chat in Agent mode. Make sure you have Copilot enabled and select Agent mode before expecting the server tools to be called.',
      },
    ],
  },
];

export function mcpClientBySlug(slug: string): McpClient | undefined {
  return MCP_CLIENTS.find((c) => c.slug === slug);
}

/** Formats a valid client-specific JSON block for a server given its details */
export function formatServerClientConfig(
  clientSlug: string,
  serverName: string,
  command = 'npx',
  args: string[] = [],
  env?: Record<string, string>,
): string {
  const cleanName = serverName
    .toLowerCase()
    .replace(/^@modelcontextprotocol\/server-/, '')
    .replace(/^server-/, '')
    .replace(/[^a-z0-9_-]/g, '-');

  const defaultArgs =
    args.length > 0
      ? args
      : [
          '-y',
          serverName.startsWith('@')
            ? serverName
            : `@modelcontextprotocol/server-${cleanName}`,
        ];
  const envObj = env && Object.keys(env).length > 0 ? env : {};

  if (clientSlug === 'vs-code') {
    return JSON.stringify(
      {
        servers: {
          [cleanName]: {
            command,
            args: defaultArgs,
            ...(Object.keys(envObj).length > 0 ? { env: envObj } : {}),
          },
        },
      },
      null,
      2,
    );
  }

  if (clientSlug === 'claude-code') {
    const argsStr = defaultArgs.join(' ');
    const envStr = Object.entries(envObj)
      .map(([k, v]) => `-e ${k}=${v}`)
      .join(' ');
    return `claude mcp add ${cleanName} ${envStr ? `${envStr} ` : ''}-- ${command} ${argsStr}`;
  }

  return JSON.stringify(
    {
      mcpServers: {
        [cleanName]: {
          command,
          args: defaultArgs,
          ...(Object.keys(envObj).length > 0 ? { env: envObj } : {}),
        },
      },
    },
    null,
    2,
  );
}
