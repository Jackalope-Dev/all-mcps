import { chromium } from 'playwright';

async function scrapeFooterLinks() {
  console.log('Extracting directory & badge links from NickLaunches.com...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://nicklaunches.com/', { waitUntil: 'networkidle' });

  const links = await page.evaluate(() => {
    const allAnchors = Array.from(document.querySelectorAll('a[href^="http"]'));
    return allAnchors.map(a => ({
      text: a.textContent.trim(),
      href: a.href,
      imgAlt: a.querySelector('img')?.alt || ''
    })).filter(l => !l.href.includes('nicklaunches.com') && !l.href.includes('x.com') && !l.href.includes('twitter.com') && !l.href.includes('github.com'));
  });

  console.log(`Found ${links.length} external directory/badge links!`);
  links.forEach(l => console.log(`- ${l.text || l.imgAlt || 'Link'}: ${l.href}`));

  await browser.close();
}

scrapeFooterLinks().catch(console.error);
