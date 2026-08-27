import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { chromium } from 'playwright';

const metadataPath = path.resolve('data/directory-submission-info.json');
const submissionData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

const logoPath = path.resolve('brand-assets/logo-icon.png');
const screenshot1Path = path.resolve('brand-assets/homepage-desktop.png');
const screenshot2Path = path.resolve(
  'brand-assets/browse-directory-desktop.png',
);
const screenshot3Path = path.resolve(
  'brand-assets/config-generator-tool-desktop.png',
);
const screenshot4Path = path.resolve('brand-assets/categories-desktop.png');

const TARGET_DIRECTORIES = submissionData.directories;

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}

function randomDelay(minMs = 200, maxMs = 500) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Humanized Form Field Agent with Keystroke Delays & Anti-Bot Stealth
 */
async function runSuperPageAgent(page, targetName, forceRefill = false) {
  console.log(
    `\n🧠 Humanized Stealth Agent evaluating DOM for [${targetName}]${forceRefill ? ' (Force Refill)' : ''}...`,
  );

  // Initial human hesitation delay (800ms - 1500ms)
  await randomDelay(800, 1500);

  // 1. File Upload Engine (Logo vs Multi-Screenshots)
  try {
    const fileInputs = await page.$$('input[type="file"]');
    const screenshotsArray = [
      screenshot1Path,
      screenshot2Path,
      screenshot3Path,
      screenshot4Path,
    ].filter((p) => fs.existsSync(p));

    for (let i = 0; i < fileInputs.length; i++) {
      const input = fileInputs[i];
      const isVisible = await input.isVisible().catch(() => true);
      if (!isVisible) continue;

      const info = await page.evaluate((el) => {
        const name = (el.getAttribute('name') || '').toLowerCase();
        const id = (el.getAttribute('id') || '').toLowerCase();
        const accept = (el.getAttribute('accept') || '').toLowerCase();
        const label = (el.labels?.[0]?.textContent || '').toLowerCase();
        const parent = (el.parentElement?.textContent || '').toLowerCase();
        const multiple = el.hasAttribute('multiple');
        return { text: `${name} ${id} ${accept} ${label} ${parent}`, multiple };
      }, input);

      if (
        info.text.includes('logo') ||
        info.text.includes('icon') ||
        info.text.includes('avatar')
      ) {
        if (fs.existsSync(logoPath)) {
          await input.setInputFiles(logoPath);
          console.log(`  📸 Uploaded LOGO: logo-icon.png`);
          await randomDelay(300, 600);
        }
      } else if (
        info.text.includes('screenshot') ||
        info.text.includes('preview') ||
        info.text.includes('cover') ||
        info.text.includes('image') ||
        info.text.includes('media') ||
        info.text.includes('gallery')
      ) {
        if (info.multiple && screenshotsArray.length > 0) {
          await input.setInputFiles(screenshotsArray.slice(0, 3));
          console.log(`  🖼️ Uploaded 3 SCREENSHOTS (Homepage, Browse, Tools)`);
          await randomDelay(400, 700);
        } else if (i === 1 && screenshotsArray[0]) {
          await input.setInputFiles(screenshotsArray[0]);
          console.log(`  🖼️ Uploaded SCREENSHOT #1: homepage-desktop.png`);
          await randomDelay(300, 500);
        } else if (i === 2 && screenshotsArray[1]) {
          await input.setInputFiles(screenshotsArray[1]);
          console.log(
            `  🖼️ Uploaded SCREENSHOT #2: browse-directory-desktop.png`,
          );
          await randomDelay(300, 500);
        } else if (i === 3 && screenshotsArray[2]) {
          await input.setInputFiles(screenshotsArray[2]);
          console.log(
            `  🖼️ Uploaded SCREENSHOT #3: config-generator-tool-desktop.png`,
          );
          await randomDelay(300, 500);
        }
      } else {
        if (i === 0 && fs.existsSync(logoPath)) {
          await input.setInputFiles(logoPath);
          console.log(`  📸 Uploaded LOGO (Slot 1): logo-icon.png`);
          await randomDelay(300, 500);
        } else if (i > 0 && screenshotsArray.length > 0) {
          if (info.multiple) {
            await input.setInputFiles(screenshotsArray.slice(0, 3));
            console.log(`  🖼️ Uploaded 3 SCREENSHOTS to Slot ${i + 1}`);
            await randomDelay(400, 700);
          } else {
            const idx = (i - 1) % screenshotsArray.length;
            await input.setInputFiles(screenshotsArray[idx]);
            console.log(`  🖼️ Uploaded SCREENSHOT #${idx + 1} to Slot ${i + 1}`);
            await randomDelay(300, 500);
          }
        }
      }
    }
  } catch (e) {}

  // 2. Selects, Radios & Checkboxes
  try {
    const selects = await page.$$('select');
    for (const sel of selects) {
      const isVisible = await sel.isVisible().catch(() => false);
      if (!isVisible) continue;

      const text = await page.evaluate(
        (el) =>
          `${el.name} ${el.id} ${el.labels?.[0]?.textContent || ''} ${el.parentElement?.textContent || ''}`.toLowerCase(),
        sel,
      );

      if (
        text.includes('cat') ||
        text.includes('topic') ||
        text.includes('industry') ||
        text.includes('niche')
      ) {
        const options = await sel.$$('option');
        for (const opt of options) {
          const optText = (await opt.textContent()).toLowerCase();
          if (
            optText.includes('developer') ||
            optText.includes('ai') ||
            optText.includes('saas') ||
            optText.includes('productivity') ||
            optText.includes('tech')
          ) {
            const val = await opt.getAttribute('value');
            await sel.selectOption(val);
            console.log(
              `  🏷️ Selected Category: ${(await opt.textContent()).trim()}`,
            );
            await randomDelay(300, 500);
            break;
          }
        }
      } else if (
        text.includes('price') ||
        text.includes('pricing') ||
        text.includes('model') ||
        text.includes('cost')
      ) {
        const options = await sel.$$('option');
        for (const opt of options) {
          const optText = (await opt.textContent()).toLowerCase();
          if (optText.includes('free') || optText.includes('open source')) {
            const val = await opt.getAttribute('value');
            await sel.selectOption(val);
            console.log(
              `  💲 Selected Pricing: ${(await opt.textContent()).trim()}`,
            );
            await randomDelay(300, 500);
            break;
          }
        }
      }
    }
  } catch (e) {}

  // 3. Humanized Field Typing Engine
  const inputElements = await page.$$(
    'input:not([type="hidden"]):not([type="submit"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]',
  );

  for (const el of inputElements) {
    const isVisible = await el.isVisible().catch(() => false);
    if (!isVisible) continue;

    // Check if field is empty or wiped
    const isCurrentValueEmpty = await el.evaluate(
      (input) => !input.value || input.value.trim() === '',
    );

    // Re-fill if field is currently empty OR if forceRefill parameter is set!
    if (!isCurrentValueEmpty && !forceRefill) continue;

    const info = await page.evaluate((field) => {
      const name = (field.getAttribute('name') || '').toLowerCase();
      const id = (field.getAttribute('id') || '').toLowerCase();
      const placeholder = (
        field.getAttribute('placeholder') || ''
      ).toLowerCase();
      const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
      const labelText = (field.labels?.[0]?.textContent || '').toLowerCase();
      const parentText = (field.parentElement?.textContent || '')
        .toLowerCase()
        .slice(0, 150);
      const tag = field.tagName;
      const currentValue = field.value || '';
      return {
        combined: `${name} ${id} ${placeholder} ${ariaLabel} ${labelText} ${parentText}`,
        tag,
        name,
        id,
        currentValue,
      };
    }, el);

    const { combined, tag, name, id, currentValue } = info;

    // Skip search bars & video fields
    if (
      name === 'q' ||
      info.combined.includes('search bar') ||
      id.includes('search_bar')
    )
      continue;
    if (
      combined.includes('video') ||
      combined.includes('youtube') ||
      combined.includes('vimeo') ||
      combined.includes('demo_url')
    )
      continue;

    let targetValue = null;
    let labelName = '';

    // 1. Long Description / About / Full Pitch
    if (
      combined.includes('long_desc') ||
      combined.includes('full_desc') ||
      combined.includes('about') ||
      combined.includes('overview') ||
      combined.includes('details') ||
      (tag === 'TEXTAREA' &&
        (combined.includes('desc') || combined.includes('body')) &&
        !combined.includes('short') &&
        !combined.includes('comment') &&
        !combined.includes('intro'))
    ) {
      targetValue = submissionData.longDescription;
      labelName = 'Long Description';
    }
    // 2. Short Description
    else if (combined.includes('short') && combined.includes('desc')) {
      targetValue = submissionData.shortDescription;
      labelName = 'Short Description';
    }
    // 3. First Comment / Intro / Founder Story
    else if (
      combined.includes('comment') ||
      combined.includes('intro') ||
      combined.includes('maker_note') ||
      combined.includes('story') ||
      combined.includes('founder') ||
      combined.includes('note_to')
    ) {
      targetValue = submissionData.makerComment;
      labelName = 'First Comment / Intro';
    }
    // 4. Tagline / Headline / One-liner
    else if (
      combined.includes('tagline') ||
      combined.includes('headline') ||
      combined.includes('one_liner') ||
      (combined.includes('pitch') &&
        !combined.includes('comment') &&
        !combined.includes('search'))
    ) {
      targetValue = submissionData.tagline;
      labelName = 'Tagline/Pitch';
    }
    // 5. Search Query Pitch ("What do people search for?")
    else if (
      combined.includes('search for') ||
      combined.includes('find a tool') ||
      combined.includes('search_query') ||
      combined.includes('search_term') ||
      combined.includes('how_to_find')
    ) {
      targetValue = submissionData.searchQueryPitch;
      labelName = 'Search Queries Pitch';
    }
    // 6. Keywords / Tags
    else if (
      combined.includes('tag') ||
      combined.includes('keyword') ||
      combined.includes('category_tags') ||
      combined.includes('topics')
    ) {
      targetValue = submissionData.keywords.join(', ');
      labelName = 'Category Tags/Keywords';
    }
    // 7. Twitter Handle / Username vs Twitter URL
    else if (
      combined.includes('twitter') ||
      combined.includes('x.com') ||
      combined.includes('x_handle') ||
      combined.includes('twitter_handle')
    ) {
      if (
        combined.includes('user') ||
        combined.includes('handle') ||
        info.combined.includes('@') ||
        name.includes('handle') ||
        id.includes('handle')
      ) {
        targetValue = submissionData.twitterUsername;
        labelName = 'Twitter Username';
      } else {
        targetValue = submissionData.twitter;
        labelName = 'Twitter URL';
      }
    }
    // 8. GitHub Link
    else if (combined.includes('github')) {
      targetValue = submissionData.github;
      labelName = 'GitHub Link';
    }
    // 9. Maker Name / Founder Name
    else if (
      combined.includes('maker_name') ||
      combined.includes('author') ||
      combined.includes('founder_name') ||
      combined.includes('your_name')
    ) {
      targetValue = submissionData.makerName;
      labelName = 'Maker Name';
    }
    // 10. Website URL
    else if (
      combined.includes('url') ||
      combined.includes('website') ||
      combined.includes('domain') ||
      combined.includes('link')
    ) {
      targetValue = submissionData.url;
      labelName = 'Website URL';
    }
    // 11. Product Name / App Title
    else if (
      combined.includes('product_name') ||
      combined.includes('app_name') ||
      combined.includes('startup_name') ||
      combined.includes('tool_name') ||
      (combined.includes('title') && !combined.includes('job')) ||
      name === 'name' ||
      id === 'name'
    ) {
      targetValue = submissionData.name;
      labelName = 'Product Name';
    }
    // 12. General Description Fallback for unhandled textareas
    else if (tag === 'TEXTAREA' && !currentValue) {
      targetValue = submissionData.longDescription;
      labelName = 'Long Description (Fallback)';
    }

    if (targetValue) {
      // Focus element with natural movement delay
      await el.focus().catch(() => {});
      await randomDelay(150, 300);

      // Humanized typing simulation (25ms - 55ms per character)
      try {
        await el.pressSequentially(targetValue, {
          delay: Math.floor(Math.random() * 30) + 25,
        });
      } catch (err) {
        // Fallback for custom contenteditables
        await page.evaluate(
          ({ element, val }) => {
            element.value = val;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          },
          { element: el, val: targetValue },
        );
      }

      await el.evaluate((e) => e.setAttribute('data-agent-filled', 'true'));
      console.log(
        `  ✨ Typed ${labelName}: ${targetValue.length > 40 ? `${targetValue.slice(0, 40)}...` : targetValue}`,
      );

      // Stagger delay between filling fields (250ms - 550ms) to bypass bot heuristics
      await randomDelay(250, 550);
    }
  }
}

async function runLLMDirectorySubmitter() {
  console.log('\n==================================================');
  console.log('🤖 Humanized Stealth Chrome Directory Driver');
  console.log('==================================================');
  console.log('Anti-Bot Protection Features:');
  console.log(
    '  ⌨️ Humanized typing simulation (25-55ms randomized keystrokes)',
  );
  console.log('  ⏱️ Staggered field pauses (250-550ms between inputs)');
  console.log('  ⏳ Human hesitation delay after page load');
  console.log('  🖼️ Multi-Screenshot & Logo upload precision');
  console.log('  🔒 No background polling loops\n');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  for (let i = 0; i < TARGET_DIRECTORIES.length; i++) {
    const target = TARGET_DIRECTORIES[i];
    console.log(`--------------------------------------------------`);
    console.log(
      `📍 [${i + 1}/${TARGET_DIRECTORIES.length}] Navigating to ${target.name} (${target.url})...`,
    );

    try {
      await page.goto(target.url, {
        waitUntil: 'domcontentloaded',
        timeout: 35000,
      });
      await page.waitForTimeout(2500); // Allow dynamic React rendering

      await runSuperPageAgent(page, target.name);

      let proceed = false;
      while (!proceed) {
        const nextName =
          i + 1 < TARGET_DIRECTORIES.length
            ? TARGET_DIRECTORIES[i + 1].name
            : 'Finish';
        console.log(`\n👉 Options:`);
        console.log(
          `   - Type "f" + [ENTER] to RE-FILL page (e.g. after logging in or opening a modal)`,
        );
        console.log(
          `   - Press [ENTER] to navigate Chrome to next site: ${nextName}`,
        );

        const input = await askQuestion(`Choice: `);
        const command = input.trim().toLowerCase();

        if (command === 'f' || command === 'fill' || command === 'refill') {
          console.log(
            '\n⚡ Force Re-filling active page form (detecting wiped fields)...',
          );
          await runSuperPageAgent(page, target.name, true);
        } else {
          proceed = true;
        }
      }
    } catch (err) {
      console.error(`⚠️ Notice loading ${target.name}:`, err.message);
      await askQuestion(`[Press ENTER to skip to next directory...] `);
    }
  }

  console.log('\n🎉 Finished all directory targets!');
  await browser.close();
}

runLLMDirectorySubmitter().catch((err) => {
  console.error('Fatal error in Stealth Agent:', err);
  process.exit(1);
});
