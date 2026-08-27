import fs from 'node:fs';
import path from 'node:path';

console.log('--- Testing Agent Claim Components ---');

const files = [
  'app/mcp/[id]/claim/ClaimClient.tsx',
  'app/api/mcp/route.ts',
  'components/WebMCPProvider.tsx',
];

let ok = true;
for (const f of files) {
  const full = path.join(process.cwd(), f);
  if (fs.existsSync(full)) {
    console.log(`[PASS] Exists: ${f}`);
  } else {
    console.error(`[FAIL] Missing: ${f}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('\nAgent claim components verified successfully!');
