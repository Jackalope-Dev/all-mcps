const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  await page.goto('http://127.0.0.1:8787/mcp/modelcontextprotocol-server-postgres', { waitUntil: 'load' });
  await page.waitForSelector('.listing-metrics-row');
  await page.waitForTimeout(500);

  const boxes = await page.$$eval('.listing-metrics-row > *', els => els.map(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { class: el.className, w: Math.round(r.width), h: Math.round(r.height), padding: cs.padding, fontSize: cs.fontSize };
  }));
  console.log('METRIC BOXES', JSON.stringify(boxes, null, 2));

  const row = await page.$('.listing-metrics-row');
  await row.screenshot({ path: 'scratch_metrics_row.png' });

  // open share modal
  await page.click('.listing-metrics-row button:has-text("Share")');
  await page.waitForSelector('.share-modal-content');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch_share_modal.png', fullPage: false });

  const modal = await page.$('.share-modal-content');
  const mbox = await modal.boundingBox();
  console.log('modal box', mbox);

  await browser.close();
})();
