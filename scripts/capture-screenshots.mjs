import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const SITE_URL = 'https://allmcps.com';
const OUTPUT_DIR = path.resolve('brand-assets');
const PUBLIC_DIR = path.resolve('public/screenshots');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

async function capture() {
  console.log(`Launching browser to capture screenshots of ${SITE_URL}...`);
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Full HD (1920x1080)
  const contextDesktop = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2
  });
  const pageDesktop = await contextDesktop.newPage();
  await pageDesktop.goto(SITE_URL, { waitUntil: 'networkidle' });
  
  const desktopFile = path.join(OUTPUT_DIR, 'homepage-screenshot-desktop.png');
  const desktopPublic = path.join(PUBLIC_DIR, 'homepage-screenshot-desktop.png');
  await pageDesktop.screenshot({ path: desktopFile, fullPage: false });
  await pageDesktop.screenshot({ path: desktopPublic, fullPage: false });
  console.log(`Saved desktop screenshot to ${desktopFile}`);

  // 2. Desktop Standard (1280x800)
  const desktopStdFile = path.join(OUTPUT_DIR, 'homepage-screenshot-1280x800.png');
  await pageDesktop.screenshot({ path: desktopStdFile, fullPage: false });

  // 3. Mobile (iPhone 14 frame: 390x844)
  const contextMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });
  const pageMobile = await contextMobile.newPage();
  await pageMobile.goto(SITE_URL, { waitUntil: 'networkidle' });
  const mobileFile = path.join(OUTPUT_DIR, 'homepage-screenshot-mobile.png');
  await pageMobile.screenshot({ path: mobileFile, fullPage: false });
  console.log(`Saved mobile screenshot to ${mobileFile}`);

  await browser.close();
  console.log('Screenshots captured successfully!');
}

capture().catch((err) => {
  console.error('Error capturing screenshot:', err);
  process.exit(1);
});
