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
  {
    slug: 'zed',
    name: 'Zed',
    configFilename: 'settings.json',
    badgeText: 'Code Editor',
    lead: 'How to add MCP servers to the Zed editor — the context_servers block in settings.json, where the file lives, and how to check the server is running in the Agent Panel.',
    configKey: 'context_servers',
    configLocations: [
      { os: 'macOS / Linux', path: '~/.config/zed/settings.json' },
      { os: 'Project', path: '.zed/settings.json in your project root' },
    ],
    configExample: `{
  "context_servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"],
      "env": {}
    }
  }
}`,
    steps: [
      {
        title: 'Open your Zed settings',
        body: 'Run "zed: open settings" from the command palette, or open the Agent Panel settings and choose to add a custom server. Zed calls MCP servers "context servers".',
      },
      {
        title: 'Add the server under context_servers',
        body: 'Add a named entry inside "context_servers" with a "command", its "args", and an optional "env" object for secrets. Zed uses context_servers — not mcpServers — so rename the key if you paste a Claude or Cursor config.',
      },
      {
        title: 'Check the status in the Agent Panel',
        body: 'Zed starts the server when the settings file is saved. Open the Agent Panel settings: a green indicator next to the server means it is running and its tools are available to the agent.',
      },
    ],
    faq: [
      {
        q: 'How do I add an MCP server to Zed?',
        a: 'Add an entry under "context_servers" in your Zed settings.json with a "command", "args", and optional "env". Zed starts the server on save and lists it in the Agent Panel settings with a status indicator.',
      },
      {
        q: 'Why does Zed use context_servers instead of mcpServers?',
        a: 'Zed names MCP servers "context servers" in its settings schema. The command, args, and env fields are the same as other clients, so you only need to rename the top-level key when copying a config.',
      },
      {
        q: 'Can Zed extensions provide MCP servers?',
        a: 'Yes. Some MCP servers are packaged as Zed extensions that you install from the extensions view instead of editing settings.json. Custom servers from any package manager still go in context_servers.',
      },
    ],
  },
  {
    slug: 'codex',
    name: 'OpenAI Codex CLI',
    configFilename: 'config.toml',
    badgeText: 'Terminal CLI',
    lead: 'How to add MCP servers to the OpenAI Codex CLI — the [mcp_servers] tables in ~/.codex/config.toml, the codex mcp add command, and how to confirm tools loaded.',
    configKey: 'mcp_servers',
    configLocations: [{ os: 'User (global)', path: '~/.codex/config.toml' }],
    configExample: `# ~/.codex/config.toml
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]

[mcp_servers.filesystem.env]
# API_KEY = "..."`,
    steps: [
      {
        title: 'Add the server with the CLI or config file',
        body: 'Run "codex mcp add <name> -- <command> [args...]", or add an [mcp_servers.<name>] table to ~/.codex/config.toml. Codex uses TOML, not JSON, so each server is its own table.',
      },
      {
        title: 'Set command, args, and env',
        body: 'Each server table takes a "command" string and an "args" array. Put secrets in a nested [mcp_servers.<name>.env] table rather than in the args.',
      },
      {
        title: 'Verify inside a session',
        body: 'Start Codex and run the /mcp command to list configured servers and their tools. If a server is missing, check the TOML syntax — a malformed table silently drops the entry.',
      },
    ],
    faq: [
      {
        q: 'How do I add an MCP server to Codex CLI?',
        a: 'Run codex mcp add <name> -- <command> [args...], or add an [mcp_servers.<name>] table with command and args to ~/.codex/config.toml. Use /mcp inside Codex to confirm it loaded.',
      },
      {
        q: 'Can I reuse a Claude Desktop MCP config in Codex?',
        a: 'The values carry over but the format does not: Codex reads TOML, so convert each mcpServers JSON entry into an [mcp_servers.<name>] table with the same command, args, and env.',
      },
      {
        q: 'Does Codex support remote MCP servers?',
        a: 'Codex supports stdio servers and streamable HTTP servers configured with a url field. Check the Codex docs for the current remote and OAuth options, since support has expanded across releases.',
      },
    ],
  },
  {
    slug: 'gemini-cli',
    name: 'Gemini CLI',
    configFilename: 'settings.json',
    badgeText: 'Terminal CLI',
    lead: 'How to add MCP servers to Google Gemini CLI — the mcpServers block in ~/.gemini/settings.json, project-level config, and how to list connected servers.',
    configKey: 'mcpServers',
    configLocations: [
      { os: 'User (global)', path: '~/.gemini/settings.json' },
      { os: 'Project', path: '.gemini/settings.json in your project root' },
    ],
    configExample: mcpServersExample('mcpServers'),
    steps: [
      {
        title: 'Open the Gemini settings file',
        body: 'Edit ~/.gemini/settings.json for all projects, or .gemini/settings.json in a repository for that project only. Create the file if it does not exist.',
      },
      {
        title: 'Add the server under mcpServers',
        body: 'Add a named entry with "command", "args", and optional "env". Gemini CLI uses the same mcpServers shape as Claude Desktop and Cursor, so those configs paste in directly. You can also run "gemini mcp add".',
      },
      {
        title: 'Restart and list servers',
        body: 'Start a new Gemini CLI session and run the /mcp command to see each server, its connection status, and the tools it exposes.',
      },
    ],
    faq: [
      {
        q: 'How do I add an MCP server to Gemini CLI?',
        a: 'Add the server under "mcpServers" in ~/.gemini/settings.json (or a project .gemini/settings.json) with a command and args, or run gemini mcp add. Use /mcp in a session to confirm it connected.',
      },
      {
        q: 'Is the Gemini CLI MCP config compatible with Claude Desktop?',
        a: 'Yes. Both use an mcpServers object with command, args, and env, so a server block copied from claude_desktop_config.json works in Gemini CLI settings.json unchanged.',
      },
      {
        q: 'How do I see which tools a Gemini CLI MCP server provides?',
        a: 'Run /mcp inside a Gemini CLI session. It lists every configured server, whether it connected, and the tools each one exposes to the model.',
      },
    ],
  },
  {
    slug: 'jetbrains',
    name: 'JetBrains AI Assistant',
    configFilename: 'Settings → Tools → AI Assistant → MCP',
    badgeText: 'IDE Plugin',
    lead: 'How to add MCP servers to JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm) through AI Assistant — the MCP settings page, JSON import, and verifying tools.',
    configKey: 'mcpServers',
    configLocations: [
      {
        os: 'Any OS',
        path: 'Settings → Tools → AI Assistant → Model Context Protocol (MCP)',
      },
    ],
    configExample: mcpServersExample('mcpServers'),
    steps: [
      {
        title: 'Open the AI Assistant MCP settings',
        body: 'In your JetBrains IDE, go to Settings → Tools → AI Assistant → Model Context Protocol (MCP). This requires the AI Assistant plugin to be installed and enabled.',
      },
      {
        title: 'Add a server or paste JSON',
        body: 'Click Add, then either fill in the command and arguments or switch to the JSON view and paste an mcpServers block. Configs from Claude Desktop can be imported as-is.',
      },
      {
        title: 'Apply and use the tools in chat',
        body: 'Apply the settings, then open AI Assistant chat. The server status shows on the MCP settings page, and its tools become available to the assistant.',
      },
    ],
    faq: [
      {
        q: 'How do I add an MCP server in IntelliJ or PyCharm?',
        a: 'Open Settings → Tools → AI Assistant → Model Context Protocol (MCP), click Add, and enter the command and args or paste an mcpServers JSON block. The same steps apply to every JetBrains IDE with AI Assistant.',
      },
      {
        q: 'Can I import my Claude Desktop MCP config into JetBrains?',
        a: 'Yes. AI Assistant accepts the standard mcpServers JSON, so you can paste server blocks from claude_desktop_config.json into the JSON view of the MCP settings page.',
      },
      {
        q: 'Can a JetBrains IDE act as an MCP server?',
        a: 'Yes — recent JetBrains IDEs include a built-in MCP server that lets external clients such as Claude Desktop or Cursor use IDE features. That is separate from adding MCP servers to AI Assistant.',
      },
    ],
  },
  {
    slug: 'roo-code',
    name: 'Roo Code',
    configFilename: 'mcp_settings.json / .roo/mcp.json',
    badgeText: 'IDE Extension',
    lead: 'How to add MCP servers to Roo Code in VS Code — the global mcp_settings.json, project-level .roo/mcp.json, and managing servers from the MCP panel.',
    configKey: 'mcpServers',
    configLocations: [
      { os: 'Global', path: 'mcp_settings.json (open via the MCP panel)' },
      { os: 'Project', path: '.roo/mcp.json in your project root' },
    ],
    configExample: mcpServersExample('mcpServers'),
    steps: [
      {
        title: 'Open the MCP panel',
        body: 'In the Roo Code sidebar, click the MCP servers icon. From there choose Edit Global MCP to open mcp_settings.json, or Edit Project MCP to create .roo/mcp.json in the workspace.',
      },
      {
        title: 'Add the server under mcpServers',
        body: 'Add a named entry with "command", "args", and "env". Roo Code uses the standard mcpServers shape, so configs from Cline or Claude Desktop paste in directly. Project entries override global ones with the same name.',
      },
      {
        title: 'Confirm it is connected',
        body: 'Save the file. The MCP panel shows each server with a status dot, lets you restart or disable it, and lists its tools with per-tool auto-approve toggles.',
      },
    ],
    faq: [
      {
        q: 'How do I add an MCP server to Roo Code?',
        a: 'Open the MCP panel in the Roo Code sidebar and edit the global mcp_settings.json or the project .roo/mcp.json. Add the server under mcpServers with command, args, and env, then save.',
      },
      {
        q: 'What is the difference between global and project MCP config in Roo Code?',
        a: 'Global servers in mcp_settings.json are available in every workspace. Project servers in .roo/mcp.json apply to that repository only, can be committed for your team, and take precedence on name conflicts.',
      },
      {
        q: 'Can Roo Code auto-approve MCP tool calls?',
        a: 'Yes. Each tool can be set to auto-approve from the MCP panel or with an alwaysAllow list in the server config. Only auto-approve read-only tools you trust.',
      },
    ],
  },
  {
    slug: 'continue',
    name: 'Continue',
    configFilename: '.continue/mcpServers/',
    badgeText: 'IDE Extension',
    lead: 'How to add MCP servers to Continue in VS Code and JetBrains — the .continue/mcpServers folder, YAML or JSON configs, and using tools in agent mode.',
    configKey: 'mcpServers',
    configLocations: [
      {
        os: 'Workspace',
        path: '.continue/mcpServers/ in your project root (one file per server)',
      },
    ],
    configExample: mcpServersExample('mcpServers'),
    steps: [
      {
        title: 'Create the mcpServers folder',
        body: 'Create a .continue/mcpServers/ folder at the top level of your workspace. Each server gets its own YAML or JSON file inside it.',
      },
      {
        title: 'Add a server file',
        body: 'Continue accepts its own YAML block format, and it also reads JSON files in the Claude Desktop / Cursor mcpServers shape — so you can drop an existing mcpServers JSON file into the folder unchanged.',
      },
      {
        title: 'Use the tools in agent mode',
        body: 'MCP tools are only available in Continue agent mode. Switch the chat to Agent and the server tools appear in the tool list.',
      },
    ],
    faq: [
      {
        q: 'How do I add an MCP server to Continue?',
        a: 'Add a YAML or JSON file for the server in a .continue/mcpServers/ folder at your workspace root. JSON files in the standard mcpServers shape from Claude Desktop or Cursor work as-is.',
      },
      {
        q: 'Why are my MCP tools not showing in Continue?',
        a: 'MCP tools only work in agent mode. Switch the chat mode to Agent, and check that the server file is in .continue/mcpServers/ at the workspace root, not a subfolder.',
      },
      {
        q: 'Does Continue support MCP in JetBrains IDEs?',
        a: 'Yes. Continue runs in both VS Code and JetBrains, and the .continue/mcpServers folder works the same way in each.',
      },
    ],
  },
  {
    slug: 'lm-studio',
    name: 'LM Studio',
    configFilename: 'mcp.json',
    badgeText: 'Desktop App',
    lead: 'How to add MCP servers to LM Studio so local models can call tools — the mcp.json file, the Cursor-compatible format, and approving tool calls.',
    configKey: 'mcpServers',
    configLocations: [
      { os: 'macOS / Linux', path: '~/.lmstudio/mcp.json' },
      { os: 'Windows', path: '%USERPROFILE%\\.lmstudio\\mcp.json' },
    ],
    configExample: mcpServersExample('mcpServers'),
    steps: [
      {
        title: 'Open mcp.json from LM Studio',
        body: 'In LM Studio, open the Program tab in the right sidebar and choose Install → Edit mcp.json. The file opens in the in-app editor.',
      },
      {
        title: 'Add the server under mcpServers',
        body: 'LM Studio follows Cursor\'s mcp.json notation, so add a named entry with "command", "args", and "env" under "mcpServers". Remote servers can use a "url" field instead.',
      },
      {
        title: 'Load a tool-capable model and approve calls',
        body: 'Save the file and chat with a model that supports tool use. LM Studio asks you to confirm each tool call by default, which you can review before it runs.',
      },
    ],
    faq: [
      {
        q: 'How do I add an MCP server to LM Studio?',
        a: 'Open the Program tab, choose Install → Edit mcp.json, and add the server under mcpServers with command and args. LM Studio uses the same format as Cursor.',
      },
      {
        q: 'Can local models use MCP servers?',
        a: 'Yes, if the model supports tool calling. LM Studio passes MCP tools to the loaded model and shows a confirmation dialog before each tool call runs.',
      },
      {
        q: 'Is it safe to use MCP servers with LM Studio?',
        a: 'MCP servers can run code and access files or APIs on your machine. Only install servers from sources you trust, and keep the per-call confirmation on for tools that write data.',
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

  if (clientSlug === 'zed') {
    return JSON.stringify(
      {
        context_servers: {
          [cleanName]: { command, args: defaultArgs, env: envObj },
        },
      },
      null,
      2,
    );
  }

  if (clientSlug === 'codex') {
    const tomlString = (s: string) => JSON.stringify(s);
    const lines = [
      `[mcp_servers.${cleanName}]`,
      `command = ${tomlString(command)}`,
      `args = [${defaultArgs.map(tomlString).join(', ')}]`,
    ];
    const envEntries = Object.entries(envObj);
    if (envEntries.length > 0) {
      lines.push('', `[mcp_servers.${cleanName}.env]`);
      for (const [k, v] of envEntries) lines.push(`${k} = ${tomlString(v)}`);
    }
    return lines.join('\n');
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
