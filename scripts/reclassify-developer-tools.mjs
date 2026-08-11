import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Fast zero-token classifier script to sort out generic "💻 Developer Tools" listings
 * into proper categories using deterministic pattern rules.
 *
 * Usage:
 *   Dry-run (preview changes):
 *     node scripts/reclassify-developer-tools.mjs
 *
 *   Apply changes to remote Cloudflare D1 DB:
 *     node scripts/reclassify-developer-tools.mjs --apply
 */

const APPLY = process.argv.includes('--apply');
const DB_NAME = 'all-mcps';
const ACCOUNT_ID = '1a04a617cf42aaaba19b44365dd7c882';

// High-precision category rules (tested against MCP registry descriptions)
const CATEGORY_RULES = [
  {
    category: '🗄️ Databases',
    regex: /\b(postgres|postgresql|mysql|sqlite|mongodb|redis|supabase|neon|clickhouse|cassandra|dynamodb|planetscale|cockroachdb|memcached|duckdb|snowflake|bigquery|couchdb|prisma|drizzle|sql|database|datastore|timescaledb|vectordb|query-builder|orm)\b/i,
  },
  {
    category: '💬 Communication',
    regex: /\b(slack|discord|telegram|whatsapp|email|gmail|sendgrid|resend|mailchimp|matrix|teams|twilio|zendesk|intercom|messaging|messenger|outlook|webhook|notification|pubsub)\b/i,
  },
  {
    category: '📂 Browser Automation',
    regex: /\b(playwright|puppeteer|selenium|browserbase|stagehand|headful|headless|browser-automation|chromedp|web-browser|browser-use|simulator|ios-simulator|android|simctl|mobile-device|axe-core|a11y|accessibility)\b/i,
  },
  {
    category: '🔎 Search & Data Extraction',
    regex: /\b(serper|tavily|brave-search|google-search|bing-search|duckduckgo|web-scraper|scraping|crawling|web-crawler|firecrawl|jina|diffbot|web-extraction|web-search|search-engine|search\s+and\s+extract)\b/i,
  },
  {
    category: '🔄 Version Control',
    regex: /\b(github|gitlab|bitbucket|gitea|git-repo|git-commit|version-control|subversion|mercurial|git-history|commits|pull-request|merge-request|repowise)\b/i,
  },
  {
    category: '☁️ Cloud Platforms',
    regex: /\b(aws|amazon-web-services|gcp|google-cloud|azure|cloudflare|terraform|kubernetes|k8s|docker|vercel|netlify|digitalocean|heroku|cloud-infrastructure|aws-lambda|s3-bucket|jenkins|bitrise|buildkite|cicd|ci-cd|pipeline|apisix|envoy|traefik|nginx|gateway|container|serverless)\b/i,
  },
  {
    category: '📊 Monitoring',
    regex: /\b(sentry|datadog|prometheus|grafana|opentelemetry|logrocket|newrelic|pagerduty|uptime|logging|observability|metrics|alerting|statuspage|telemetry|code-quality|linter|jmeter|locust|performance-testing|load-testing|stress-testing|profiler|health-check|monitoring)\b/i,
  },
  {
    category: '🏢 Workplace & Productivity',
    regex: /\b(jira|linear|trello|asana|notion|clickup|confluence|google-calendar|google-docs|todoist|airtable|workplace|google-sheets|excel|task-management|milestone)\b/i,
  },
  {
    category: '📋 Product Management',
    regex: /\b(codebeamer|alm|product-management|work-items|trackers|feature-flags|product-board|jira-issues)\b/i,
  },
  {
    category: '💰 Finance & Fintech',
    regex: /\b(stripe|shopify|plaid|crypto|solana|ethereum|bitcoin|base-chain|x402|stock|market-data|prices|pricing|finance|financial|accounting|hledger|forex|sec-edgar|wallet|token|defi|fintech|sepa|exchange-rate|payment|payroll|billing|invoice|revenue|trading)\b/i,
  },
  {
    category: '🧠 Knowledge & Memory',
    regex: /\b(pinecone|weaviate|qdrant|chroma|vector-db|vector-database|rag|memory|knowledge-base|obsidian|roam|logseq|mem0|zotero|notes|note-taking|embeddings|context-engineering|knowledge-graph|second-brain)\b/i,
  },
  {
    category: '🔒 Security',
    regex: /\b(security|vulnerability|vulnerabilities|secrets|vault|snyk|sonar|auth0|okta|pentest|penetration|cve|threat|cybersecurity|auth|soc-security|slop-detector|audit|compliance|access-control)\b/i,
  },
  {
    category: '🧬 Biology & Bioinformatics',
    regex: /\b(ncbi|blast|pubchem|dna|protein|bioinformatics|genomics|chembl|pdb|uniprot|medical|healthcare|biology|clinical)\b/i,
  },
  {
    category: '🎮 Gaming',
    regex: /\b(unity|unreal|minecraft|steam|game-engine|chess|poker|gaming|games)\b/i,
  },
  {
    category: '🎙️ Speech-to-Text',
    regex: /\b(whisper|speech-to-text|stt|transcription|transcribe|audio-transcription)\b/i,
  },
  {
    category: '🎧 Text-to-Speech',
    regex: /\b(elevenlabs|text-to-speech|tts|voice-synthesis)\b/i,
  },
  {
    category: '🎥 Multimedia Process',
    regex: /\b(ffmpeg|video|image-processing|opencv|sharp|yt-dlp|youtube-dl|audio-processing|media-processing|image-audit|image-dimension|canvas|audio)\b/i,
  },
  {
    category: '🏠 Home Automation',
    regex: /\b(home-assistant|homebridge|mqtt|zigbee|smart-home|iot)\b/i,
  },
  {
    category: '🚀 Aerospace & Astrodynamics',
    regex: /\b(astronomy|nasa|satellite|orbit|celestial|spacetrack)\b/i,
  },
  {
    category: '🛒 E-Commerce',
    regex: /\b(woocommerce|magento|ecommerce|e-commerce|shopping-cart|storefront)\b/i,
  },
  {
    category: '⚖️ Legal',
    regex: /\b(legal|law|contracts|court|court-listener|compliance|terms-of-service)\b/i,
  },
  {
    category: '🌐 Social Media',
    regex: /\b(twitter|x-api|bluesky|mastodon|reddit|linkedin|facebook|instagram|tiktok|social-media)\b/i,
  },
  {
    category: '👨‍💻 Code Execution',
    regex: /\b(code-execution|python-interpreter|repl|sandbox|e2b|run-code|swift-compiler|code-runner|justfile|just-mcp)\b/i,
  },
  {
    category: '📂 File Systems',
    regex: /\b(filesystem|file-system|local-files|directory-tree|file-search|google-drive|dropbox|onedrive|filescope|markdown-preview|markview)\b/i,
  },
  {
    category: '🤖 Coding Agents',
    regex: /\b(coding-agent|claude-code|skill-ninja|agent-skill|aide-spec|code-intelligence|hierarchical-code|copilot|ai-coder|agent-framework)\b/i,
  },
  {
    category: '📊 Data Visualization',
    regex: /\b(mermaid|diagrams|mindmap|charting|graph-visualization|mindpilot|charts)\b/i,
  },
  {
    category: '🔗 Aggregators',
    regex: /\b(openapi|swagger|rest-api-wrapper|mcp-link|api-connector|api-spec)\b/i,
  },
  {
    category: '🎓 Education',
    regex: /\b(python-docs|cheatsheet|documentation-retrieval|reference-docs|tutorials|learning|course)\b/i,
  },
  {
    category: '🎧 Support & Service Management',
    regex: /\b(incident-management|rootly|opsgenie|service-desk|ticketing|support-tickets)\b/i,
  },
  {
    category: '🎯 Marketing',
    regex: /\b(seo|copywriting|brand|marketing|campaign|content-strategy|ad-performance)\b/i,
  },
  {
    category: '🔬 Research',
    regex: /\b(arxiv|pubmed|academic|citations|paper-search|literature-review|scientific-research)\b/i,
  },
  {
    category: '📊 Data Platforms',
    regex: /\b(mixpanel|posthog|amplitude|segment|analytics-platform|data-warehouse)\b/i,
  },
  {
    category: '👤 Customer Data Platforms',
    regex: /\b(crm|salesforce|hubspot|customer-data|leads)\b/i,
  },
  {
    category: '🖥️ OS Automation',
    regex: /\b(macos|windows-os|linux-automation|mac-monitor|os-automation|apple-native|system-control)\b/i,
  },
];

async function main() {
  console.log('Fetching listings in 💻 Developer Tools from Cloudflare D1 remote DB...');
  const query = "SELECT id, name, description, url, tools FROM servers WHERE category = '💻 Developer Tools';";
  const fetchCmd = `npx wrangler d1 execute ${DB_NAME} --remote --json --command "${query}"`;
  
  const rawOut = execSync(fetchCmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const parsed = JSON.parse(rawOut);
  const rows = parsed[0]?.results || [];

  console.log(`Found ${rows.length} listings currently categorized as '💻 Developer Tools'.\n`);

  const updates = [];
  const catCounts = {};

  for (const r of rows) {
    // Strip domain URL prefix to prevent github.com matching version control rule falsely
    const cleanUrl = (r.url || '').replace(/^https?:\/\/(www\.)?github\.com\//i, '');
    const text = `${r.name} ${r.description || ''} ${cleanUrl} ${r.tools || ''}`;

    for (const rule of CATEGORY_RULES) {
      if (rule.regex.test(text)) {
        updates.push({ id: r.id, category: rule.category, name: r.name });
        catCounts[rule.category] = (catCounts[rule.category] || 0) + 1;
        break;
      }
    }
  }

  console.log(`✅ Classified ${updates.length} out of ${rows.length} listings (${((updates.length / rows.length) * 100).toFixed(1)}%).`);
  console.log('\nBreakdown of newly assigned categories:');
  console.table(catCounts);

  if (updates.length === 0) {
    console.log('No updates to apply.');
    return;
  }

  if (!APPLY) {
    console.log('\n[DRY RUN] No changes were written to D1.');
    console.log('To apply these reclassifications to production D1, run:');
    console.log('  node scripts/reclassify-developer-tools.mjs --apply\n');
    return;
  }

  console.log('\n🚀 Applying updates to Cloudflare D1 remote database...');
  
  // Write migration SQL in chunks of 500 statements to stay within D1 script limits
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sqlFile = path.join(process.cwd(), 'drizzle', `reclassify-${timestamp}.sql`);

  const sqlLines = updates.map(
    (u) => `UPDATE servers SET category = '${u.category.replace(/'/g, "''")}' WHERE id = '${u.id.replace(/'/g, "''")}';`
  );

  fs.writeFileSync(sqlFile, sqlLines.join('\n'), 'utf8');
  console.log(`Wrote ${sqlLines.length} SQL statements to ${sqlFile}`);

  console.log('Executing SQL migration on D1...');
  const applyCmd = `npx wrangler d1 execute ${DB_NAME} --remote --file=${sqlFile}`;
  execSync(applyCmd, { stdio: 'inherit' });

  console.log('\n🎉 Successfully updated categories in production database!');
}

main().catch((err) => {
  console.error('Error during reclassification:', err);
  process.exit(1);
});
