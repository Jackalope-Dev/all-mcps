const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  const link = await page.$eval('a[href^="/mcp/"]', el => el.getAttribute('href'));
  console.log('link', link);
  const resp = await page.goto('http://localhost:3000' + link, { waitUntil: 'load' });
  console.log('status', resp.status());
  await page.waitForTimeout(1000);
  console.log('title', await page.title());
  console.log('bodylen', (await page.content()).length);
  const boxes = await page.$$eval('.listing-metrics-row > *', els => els.map(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { tag: el.tagName, class: el.className, w: r.width, h: r.height, padding: cs.padding, fontSize: cs.fontSize, borderRadius: cs.borderRadius };
  }));
  console.log(JSON.stringify(boxes, null, 2));
  await browser.close();
})();
