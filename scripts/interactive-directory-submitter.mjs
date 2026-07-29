import { chromium } from 'playwright';
import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';

// Load standardized submission metadata
const metadataPath = path.resolve('data/directory-submission-info.json');
const submissionData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

const TARGET_DIRECTORIES = [
  { name: 'SaaSHub', url: 'https://www.saashub.com/submit' },
  { name: 'DevHunt', url: 'https://devhunt.org' },
  { name: 'Uneed Best Tools', url: 'https://www.uneed.best/submit' },
  { name: 'Toolify AI', url: 'https://www.toolify.ai/submit' },
  { name: 'Futurepedia', url: 'https://www.futurepedia.io/submit-tool' },
  { name: 'FutureTools', url: 'https://www.futuretools.io/submit-a-tool' },
  { name: 'AI Top Tools', url: 'https://aitoptools.com/submit-a-tool/' },
  { name: 'LaunchingNext', url: 'https://www.launchingnext.com/submit/' },
  { name: 'Peerlist', url: 'https://peerlist.io' },
  { name: 'StackShare', url: 'https://stackshare.io' },
  { name: 'BetaList', url: 'https://betalist.com/submit' },
  { name: 'Product Hunt', url: 'https://www.producthunt.com/posts/new' }
];

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}

async function autofillPage(page) {
  console.log('🤖 Auto-filling form fields with AllMCPs metadata...');

  // Intelligent field filling logic for standard input selectors
  await page.evaluate((data) => {
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'));

    inputs.forEach((input) => {
      if (['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(input.type)) return;

      const nameAttr = (input.getAttribute('name') || '').toLowerCase();
      const idAttr = (input.getAttribute('id') || '').toLowerCase();
      const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
      const label = (input.labels?.[0]?.textContent || '').toLowerCase();
      const matchStr = `${nameAttr} ${idAttr} ${placeholder} ${label}`;

      if (matchStr.includes('title') || matchStr.includes('product') || matchStr.includes('app_name') || matchStr.includes('startup') || matchStr.includes('name')) {
        if (!input.value) input.value = data.name;
      } else if (matchStr.includes('url') || matchStr.includes('link') || matchStr.includes('website') || matchStr.includes('domain')) {
        if (!input.value) input.value = data.url;
      } else if (matchStr.includes('tagline') || matchStr.includes('headline') || matchStr.includes('summary') || matchStr.includes('one_liner') || matchStr.includes('pitch')) {
        if (!input.value) input.value = data.tagline;
      } else if (matchStr.includes('short') && matchStr.includes('desc')) {
        if (!input.value) input.value = data.shortDescription;
      } else if (matchStr.includes('desc') || matchStr.includes('detail') || matchStr.includes('about') || matchStr.includes('bio')) {
        if (!input.value) input.value = data.longDescription;
      } else if (matchStr.includes('email') || matchStr.includes('contact')) {
        if (!input.value) input.value = data.email;
      } else if (matchStr.includes('twitter') || matchStr.includes('x.com')) {
        if (!input.value) input.value = data.twitter;
      }

      // Trigger synthetic input/change events for modern frameworks (React/Vue)
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }, submissionData);
}

async function runInteractiveSubmitter() {
  console.log('🚀 Starting Interactive Directory Submission Assistant...');
  console.log('Chrome will open on your screen. The bot will autofill form fields automatically.');
  console.log('You can solve any CAPTCHA or click Submit, then press ENTER in the terminal to move to the next site.\n');

  // Launch Google Chrome in HEADED mode (visible to user)
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  for (let i = 0; i < TARGET_DIRECTORIES.length; i++) {
    const target = TARGET_DIRECTORIES[i];
    console.log(`--------------------------------------------------`);
    console.log(`📍 [${i + 1}/${TARGET_DIRECTORIES.length}] Navigating to ${target.name} (${target.url})...`);

    try {
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500); // Wait for dynamic forms to render
      await autofillPage(page);

      console.log(`\n✨ Autofill complete for ${target.name}!`);
      console.log(`👉 Please complete CAPTCHA / Submit in the open Chrome window.`);
      await askQuestion(`👉 Press ENTER when you're ready to jump to the next directory (${i + 2 <= TARGET_DIRECTORIES.length ? TARGET_DIRECTORIES[i + 1].name : 'Finish'})... `);
    } catch (err) {
      console.error(`⚠️ Error loading ${target.name}:`, err.message);
      await askQuestion(`👉 Press ENTER to skip to the next directory... `);
    }
  }

  console.log('\n🎉 Finished all directory targets!');
  await browser.close();
}

runInteractiveSubmitter().catch((err) => {
  console.error('Fatal error in submitter:', err);
  process.exit(1);
});
