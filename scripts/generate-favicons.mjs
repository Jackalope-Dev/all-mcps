import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  });

  // 1. Render dark tile favicon SVG -> app/icon.png & favicon-tile.png
  const tileSvgPath = path.resolve('public/favicon-tile.svg');
  const tileSvgContent = fs.readFileSync(tileSvgPath, 'utf8');
  await page.setContent(
    `<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;">${tileSvgContent}</body></html>`,
  );
  const tileSvgEl = await page.$('svg');
  await tileSvgEl.evaluate((el) => {
    el.setAttribute('width', '512');
    el.setAttribute('height', '512');
  });
  const tilePngBuffer = await tileSvgEl.screenshot({
    type: 'png',
    omitBackground: true,
  });
  fs.writeFileSync(path.resolve('app/icon.png'), tilePngBuffer);
  fs.writeFileSync(path.resolve('public/favicon-tile.png'), tilePngBuffer);
  fs.writeFileSync(
    path.resolve('brand-assets/favicon-tile.png'),
    tilePngBuffer,
  );

  // 2. Render transparent logo SVG -> public/logo-icon.png & brand-assets/logo-icon.png
  const logoSvgPath = path.resolve('public/logo-icon.svg');
  const logoSvgContent = fs.readFileSync(logoSvgPath, 'utf8');
  await page.setContent(
    `<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;">${logoSvgContent}</body></html>`,
  );
  const logoSvgEl = await page.$('svg');
  await logoSvgEl.evaluate((el) => {
    el.setAttribute('width', '512');
    el.setAttribute('height', '512');
  });
  const logoPngBuffer = await logoSvgEl.screenshot({
    type: 'png',
    omitBackground: true,
  });
  fs.writeFileSync(path.resolve('public/logo-icon.png'), logoPngBuffer);
  fs.writeFileSync(path.resolve('brand-assets/logo-icon.png'), logoPngBuffer);

  console.log(
    'Successfully generated transparent logo PNGs and dark squircle tile favicon PNGs!',
  );
  await browser.close();
})();
