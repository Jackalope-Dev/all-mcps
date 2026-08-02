/**
 * Helper utilities for parsing, auditing, and merging MCP client configuration JSON files.
 * Supports Claude Desktop (mcpServers), Cursor (.cursor/mcp.json), Windsurf, Cline, and Zed formats.
 */

export interface AuditIssue {
  type: 'error' | 'warning' | 'info';
  serverKey?: string;
  message: string;
  suggestion?: string;
}

export interface AuditResult {
  isValidJson: boolean;
  formatDetected: 'claude' | 'cursor' | 'windsurf' | 'cline' | 'zed' | 'unknown';
  issues: AuditIssue[];
  serverCount: number;
  parsedConfig: any;
}

export function auditMcpConfig(rawJson: string): AuditResult {
  const issues: AuditIssue[] = [];

  if (!rawJson.trim()) {
    return {
      isValidJson: false,
      formatDetected: 'unknown',
      issues: [{ type: 'info', message: 'Paste your MCP configuration JSON to audit for issues.' }],
      serverCount: 0,
      parsedConfig: null,
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e: any) {
    return {
      isValidJson: false,
      formatDetected: 'unknown',
      issues: [
        {
          type: 'error',
          message: `JSON Syntax Error: ${e.message}`,
          suggestion: 'Ensure all keys are double-quoted and trailing commas are removed.',
        },
      ],
      serverCount: 0,
      parsedConfig: null,
    };
  }

  // Detect format
  let formatDetected: AuditResult['formatDetected'] = 'unknown';
  let serversObj: Record<string, any> = {};

  if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
    formatDetected = 'claude';
    serversObj = parsed.mcpServers;
  } else if (parsed.experimental?.context_servers && Array.isArray(parsed.experimental.context_servers)) {
    formatDetected = 'zed';
    parsed.experimental.context_servers.forEach((s: any) => {
      if (s.id) serversObj[s.id] = s;
    });
  } else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    // Plain object of servers
    serversObj = parsed;
    formatDetected = 'cursor';
  }

  const serverKeys = Object.keys(serversObj);
  const serverCount = serverKeys.length;

  if (serverCount === 0) {
    issues.push({
      type: 'warning',
      message: 'No MCP servers found in configuration.',
      suggestion: 'Add an "mcpServers" block with your server definitions.',
    });
  }

  const envPlaceholderRegex = /<(?:YOUR_|YOUR_)?(?:API_KEY|TOKEN|SECRET|PASSWORD|URL|PATH|DB)[^>]*>|YOUR_[A-Z0-9_]+|CHANGEME|ENTER_[A-Z0-9_]+/i;

  // Inspect each server entry
  for (const key of serverKeys) {
    const s = serversObj[key];

    if (!s || typeof s !== 'object') {
      issues.push({
        type: 'error',
        serverKey: key,
        message: `Server "${key}" is not a valid configuration object.`,
      });
      continue;
    }

    // Check command / url
    if (!s.command && !s.url) {
      issues.push({
        type: 'error',
        serverKey: key,
        message: `Server "${key}" is missing a "command" or "url" field.`,
        suggestion: 'Specify "command": "npx" or "uvx" for stdio servers, or "url": "https://..." for remote SSE servers.',
      });
    }

    // Check arguments
    if (s.args) {
      if (!Array.isArray(s.args)) {
        issues.push({
          type: 'error',
          serverKey: key,
          message: `Server "${key}" has "args" defined as a non-array.`,
          suggestion: 'Change "args" to a JSON array of string arguments, e.g. ["-y", "package-name"].',
        });
      } else {
        s.args.forEach((arg: any, idx: number) => {
          if (typeof arg === 'string' && envPlaceholderRegex.test(arg)) {
            issues.push({
              type: 'warning',
              serverKey: key,
              message: `Server "${key}" argument #${idx + 1} contains unreplaced placeholder: "${arg}".`,
              suggestion: 'Replace placeholder values with your real API key or credential string.',
            });
          }
        });
      }
    }

    // Check environment variables
    if (s.env && typeof s.env === 'object') {
      for (const [envKey, envVal] of Object.entries(s.env)) {
        if (typeof envVal === 'string' && envPlaceholderRegex.test(envVal)) {
          issues.push({
            type: 'warning',
            serverKey: key,
            message: `Environment variable "${envKey}" in server "${key}" contains unreplaced placeholder: "${envVal}".`,
            suggestion: `Replace "${envVal}" with your actual ${envKey} secret before running.`,
          });
        }
      }
    }

    // Check deprecated package names
    const commandStr = `${s.command || ''} ${(s.args || []).join(' ')}`.toLowerCase();
    if (commandStr.includes('@smithery/cli')) {
      issues.push({
        type: 'info',
        serverKey: key,
        message: `Server "${key}" uses Smithery CLI runner.`,
        suggestion: 'Consider using npx or uvx directly for faster startup and native MCP protocol stability.',
      });
    }
  }

  if (issues.length === 0) {
    issues.push({
      type: 'info',
      message: '✅ Configuration structure is valid! No missing keys or syntax errors detected.',
    });
  }

  return {
    isValidJson: true,
    formatDetected,
    issues,
    serverCount,
    parsedConfig: parsed,
  };
}

export function mergeServerIntoConfig(
  existingJson: string,
  newServer: { id: string; command: string; args: string[] }
): string {
  let configObj: any;

  if (existingJson.trim()) {
    try {
      configObj = JSON.parse(existingJson);
    } catch {
      configObj = { mcpServers: {} };
    }
  } else {
    configObj = { mcpServers: {} };
  }

  if (!configObj.mcpServers) {
    configObj.mcpServers = {};
  }

  const serverKey = newServer.id.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  configObj.mcpServers[serverKey] = {
    command: newServer.command || 'npx',
    args: newServer.args || ['-y', newServer.id],
  };

  return JSON.stringify(configObj, null, 2);
}
