import { chromium } from 'playwright';
import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';

const metadataPath = path.resolve('data/directory-submission-info.json');
const submissionData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const logoPath = path.resolve('brand-assets/logo-icon.png');
const screenshotPath = path.resolve('brand-assets/homepage-desktop.png');

const TARGET_DIRECTORIES = submissionData.directories;

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

async function handleSaaSHub(page) {
  console.log('  🔍 Executing SaaSHub multi-step submit flow...');
  try {
    // Step 1: Check for search box or submit product link
    const searchInput = await page.$('input[name="q"], input[type="text"], input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.fill(submissionData.name);
      await searchInput.press('Enter');
      console.log('  ⌨️ Typed "AllMCPs" & pressed ENTER in search box...');
      await page.waitForTimeout(3000);
    }

    // Step 2: Look for "Submit software", "Add product", or top right "Submit" button
    const submitBtn = await page.$('a[href*="/submit"], a:has-text("Submit"), button:has-text("Submit"), a:has-text("Add Product"), a:has-text("Add Software")');
    if (submitBtn) {
      console.log('  👉 Clicking SaaSHub Submit/Add button...');
      await submitBtn.click();
      await page.waitForTimeout(2500);
    }
  } catch (err) {
    console.log('  Notice during SaaSHub flow:', err.message);
  }
}

async function smartFill(page, siteName) {
  console.log(`🤖 Active Chrome Driver working on ${siteName}...`);

  // Site Specific Automation Handling
  if (siteName === 'SaaSHub') {
    await handleSaaSHub(page);
  }

  // Check for Next/Continue buttons to advance multi-step wizards
  try {
    const nextBtn = await page.$('button:has-text("Next"), button:has-text("Continue"), button:has-text("Start")');
    if (nextBtn && await nextBtn.isVisible()) {
      console.log('  👉 Advancing multi-step form wizard (clicking Next/Continue)...');
      await nextBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {}

  // Attach File Assets (Logo & Screenshots)
  try {
    const fileInputs = await page.$$('input[type="file"]');
    if (fileInputs.length > 0) {
      if (fs.existsSync(logoPath)) {
        await fileInputs[0].setInputFiles(logoPath);
        console.log('  📷 Attached logo-icon.png file!');
      }
      if (fileInputs.length > 1 && fs.existsSync(screenshotPath)) {
        await fileInputs[1].setInputFiles(screenshotPath);
        console.log('  🖼️ Attached homepage screenshot file!');
      }
    }
  } catch (e) {}

  // Fill text, textarea, select, url inputs
  await page.evaluate((data) => {
    function setInputValue(element, val) {
      if (!element || element.value === val) return false;
      element.focus();
      element.value = val;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      return true;
    }

    const fields = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="file"]):not([type="checkbox"]), textarea, select'));

    fields.forEach((field) => {
      const name = (field.getAttribute('name') || '').toLowerCase();
      const id = (field.getAttribute('id') || '').toLowerCase();
      const placeholder = (field.getAttribute('placeholder') || '').toLowerCase();
      const labelText = (field.labels?.[0]?.textContent || '').toLowerCase();
      const combined = `${name} ${id} ${placeholder} ${labelText}`;

      // URL / Website
      if (combined.includes('url') || combined.includes('website') || combined.includes('link') || combined.includes('domain')) {
        setInputValue(field, data.url);
      }
      // Product / App Name / Title
      else if (combined.includes('title') || combined.includes('product') || combined.includes('name') || combined.includes('app') || combined.includes('startup')) {
        setInputValue(field, data.name);
      }
      // Tagline / Headline / Pitch
      else if (combined.includes('tagline') || combined.includes('pitch') || combined.includes('headline') || combined.includes('summary') || combined.includes('one_liner')) {
        setInputValue(field, data.tagline);
      }
      // Short Description
      else if (combined.includes('short') && combined.includes('desc')) {
        setInputValue(field, data.shortDescription);
      }
      // Description / Details / About
      else if (combined.includes('desc') || combined.includes('about') || combined.includes('details') || combined.includes('body') || combined.includes('info')) {
        setInputValue(field, data.longDescription);
      }
      // Contact Email
      else if (combined.includes('email') || combined.includes('contact')) {
        setInputValue(field, data.contactEmail);
      }
      // Twitter / Social
      else if (combined.includes('twitter') || combined.includes('x.com')) {
        setInputValue(field, data.twitter);
      }
    });
  }, submissionData);
}

async function runInteractiveSubmitter() {
  console.log('\n==================================================');
  console.log('🚀 Smart Active Chrome Directory Driver');
  console.log('==================================================');
  console.log('Antigravity is actively driving Google Chrome on your screen.');
  console.log('Press ENTER in this terminal whenever you wish to jump Chrome to the next site!\n');

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
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(2000); // Allow dynamic JavaScript forms to render
      await smartFill(page, target.name);

      console.log(`\n✅ Active Driver populated ${target.name}!`);
      console.log(`👉 Solve CAPTCHA / submit if needed in Chrome.`);
      
      const nextName = i + 1 < TARGET_DIRECTORIES.length ? TARGET_DIRECTORIES[i + 1].name : 'Finish';
      await askQuestion(`\n[Press ENTER to advance Chrome to next site: ${nextName}] `);
    } catch (err) {
      console.error(`⚠️ Notice loading ${target.name}:`, err.message);
      await askQuestion(`[Press ENTER to skip to next directory...] `);
    }
  }

  console.log('\n🎉 Finished all directory submission sites!');
  await browser.close();
}

runInteractiveSubmitter().catch((err) => {
  console.error('Fatal error in Chrome driver:', err);
  process.exit(1);
});
