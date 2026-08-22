import fs from 'fs';
import path from 'path';

console.log('--- Testing Agent Readiness & Discovery Endpoints Structure ---');

const checks = [
  { name: 'robots.txt handler', path: 'app/robots.txt/route.ts' },
  { name: 'API Catalog route', path: 'app/api/well-known/api-catalog/route.ts' },
  { name: 'OpenID configuration route', path: 'app/api/well-known/openid-configuration/route.ts' },
  { name: 'OAuth Protected Resource route', path: 'app/api/well-known/oauth-protected-resource/route.ts' },
  { name: 'MCP Server Card route', path: 'app/api/well-known/mcp-server-card/route.ts' },
  { name: 'Agent Skills Index route', path: 'app/api/well-known/agent-skills/index/route.ts' },
  { name: 'Auth.md route', path: 'app/api/well-known/auth-md/route.ts' },
  { name: 'Health check route', path: 'app/api/v1/health/route.ts' },
  { name: 'Markdown renderer route', path: 'app/api/v1/markdown-renderer/route.ts' },
  { name: 'WebMCPProvider component', path: 'components/WebMCPProvider.tsx' },
  { name: 'Proxy with RFC 8288 Link headers', path: 'proxy.ts' },
  { name: 'DNS-AID Zone config', path: 'public/dns-aid.zone' },
  { name: 'Public auth.md', path: 'public/auth.md' },
  { name: 'Public mcp-search SKILL.md', path: 'public/.well-known/agent-skills/mcp-search/SKILL.md' },
  { name: 'Public mcp-registry SKILL.md', path: 'public/.well-known/agent-skills/mcp-registry/SKILL.md' },
];

let passed = true;

for (const check of checks) {
  const fullPath = path.join(process.cwd(), check.path);
  if (fs.existsSync(fullPath)) {
    console.log(`[PASS] ${check.name} -> ${check.path}`);
  } else {
    console.error(`[FAIL] ${check.name} -> Missing file ${check.path}`);
    passed = false;
  }
}

if (!passed) {
  process.exit(1);
} else {
  console.log('\nAll 11 Agent Discovery and Readiness components verified successfully!');
}
