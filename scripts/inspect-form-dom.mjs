import { chromium } from 'playwright';

async function inspectDOM() {
  console.log('Inspecting actual submission DOM structures...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const urls = [
    'https://nicklaunches.com/',
    'https://microlaunch.net/submit',
    'https://www.uneed.best/submit',
  ];

  for (const url of urls) {
    console.log(`\n==================================================`);
    console.log(`URL: ${url}`);
    console.log(`==================================================`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);

      const elements = await page.evaluate(() => {
        const els = Array.from(
          document.querySelectorAll(
            'input, textarea, select, button, [contenteditable="true"]',
          ),
        );
        return els.map((e) => ({
          tag: e.tagName,
          type: e.type || '',
          name: e.getAttribute('name') || '',
          id: e.getAttribute('id') || '',
          placeholder: e.getAttribute('placeholder') || '',
          aria: e.getAttribute('aria-label') || '',
          label: e.labels?.[0]?.textContent?.trim() || '',
          text: e.textContent?.trim().slice(0, 50) || '',
          parent: e.parentElement?.textContent?.trim().slice(0, 100) || '',
          outer: e.outerHTML.slice(0, 150),
        }));
      });

      console.log(`Found ${elements.length} interactive elements:`);
      elements.forEach((el, i) => {
        console.log(
          `[${i + 1}] <${el.tag} type="${el.type}" name="${el.name}" id="${el.id}" placeholder="${el.placeholder}"> Label: "${el.label}" Parent: "${el.parent.replace(/\s+/g, ' ')}"`,
        );
        console.log(`    HTML: ${el.outer}`);
      });
    } catch (err) {
      console.log(`Error loading ${url}:`, err.message);
    }
  }

  await browser.close();
}

inspectDOM().catch(console.error);
