import fs from 'node:fs';
import path from 'node:path';

console.log('--- Testing Agentic Boosting & Monetization Tools ---');

const files = [
  'app/api/v1/boost/pricing/route.ts',
  'app/api/v1/boost/checkout/route.ts',
  'public/.well-known/agent-skills/mcp-monetization/SKILL.md',
];

let allExist = true;
for (const f of files) {
  const full = path.join(process.cwd(), f);
  if (fs.existsSync(full)) {
    console.log(`[PASS] Exists: ${f}`);
  } else {
    console.error(`[FAIL] Missing: ${f}`);
    allExist = false;
  }
}

if (allExist) {
  console.log('\nAll agentic commerce files created successfully!');
} else {
  process.exit(1);
}
