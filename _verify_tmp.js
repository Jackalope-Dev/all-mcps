const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  for (const width of [320, 360, 414, 680, 700]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1000);
    const bar = await page.$('.directory-search-bar');
    if (bar) {
      await bar.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await bar.screenshot({ path: `C:/Users/caden/AppData/Local/Temp/claude/C--Users-caden-Desktop-all-mcps/a6f01698-fdf7-4360-8c85-32e29dd1b1db/scratchpad/search-bar-fixed-${width}.png` });
      const box = await bar.evaluate((el) => {
        const overflowing = el.scrollWidth > el.clientWidth + 1;
        const kids = Array.from(el.querySelectorAll('*')).some((k) => k.scrollWidth > k.clientWidth + 1);
        return { overflowing, childOverflow: kids, width: el.clientWidth };
      });
      console.log(`width=${width}`, JSON.stringify(box));
    } else {
      console.log(`width=${width} NO SEARCH BAR FOUND`);
    }
    await page.close();
  }

  await browser.close();
  console.log('DONE');
})();
