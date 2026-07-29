const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  await page.goto('http://127.0.0.1:8787/mcp/modelcontextprotocol-server-postgres', { waitUntil: 'load' });
  await page.waitForSelector('.listing-metrics-row');
  await page.click('.listing-metrics-row button:has-text("Share")');
  await page.waitForSelector('.share-modal-content');
  await page.waitForTimeout(500);

  const modalBox = await page.$eval('.share-modal-content', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  console.log('modal', modalBox);

  // zoom the markdown code block region
  await page.screenshot({ path: 'scratch_codeblock_zoom.png', clip: { x: modalBox.x, y: 470, width: modalBox.w, height: 90 } });

  // check for horizontal overflow on the modal content itself
  const overflowCheck = await page.evaluate(() => {
    const el = document.querySelector('.share-modal-content');
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  console.log('overflowCheck', overflowCheck);

  const preBoxes = await page.$$eval('.share-modal-content pre', els => els.map(el => {
    const r = el.getBoundingClientRect();
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, right: r.right };
  }));
  console.log('preBoxes', JSON.stringify(preBoxes));

  await browser.close();
})();
