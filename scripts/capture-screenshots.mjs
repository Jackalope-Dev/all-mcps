import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const PAGES = [
  {
    name: 'homepage',
    url: 'https://allmcps.com'
  },
  {
    name: 'browse-directory',
    url: 'https://allmcps.com/browse'
  },
  {
    name: 'config-generator-tool',
    url: 'https://allmcps.com/tools/config-generator'
  },
  {
    name: 'categories',
    url: 'https://allmcps.com/categories'
  }
];

const BRAND_DIR = path.resolve('brand-assets');
const PUBLIC_DIR = path.resolve('public/screenshots');

if (!fs.existsSync(BRAND_DIR)) fs.mkdirSync(BRAND_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

console.log('Capturing screenshots with a 2.5s delay to let all animations settle...');

PAGES.forEach(({ name, url }) => {
  const brandPath = path.join(BRAND_DIR, `${name}-desktop.png`);
  const publicPath = path.join(PUBLIC_DIR, `${name}-desktop.png`);
  
  console.log(`\n📸 Capturing ${name} (${url})...`);
  try {
    execSync(`npx playwright screenshot --wait-for-timeout=2500 "${url}" "${brandPath}" --viewport-size=1920,1080`, { stdio: 'inherit' });
    fs.copyFileSync(brandPath, publicPath);
    console.log(`✅ Crisp screenshot saved: ${brandPath}`);
  } catch (err) {
    console.error(`❌ Failed to capture ${name}:`, err.message);
  }
});

console.log('\n🎉 All settled screenshots captured successfully!');
