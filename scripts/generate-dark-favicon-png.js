const Jimp = require('jimp');
const fs = require('node:fs');
const path = require('node:path');

// SVG path points for the geometric M mark in viewBox 0 0 1024 1024
// We can draw a clean, pixel-perfect dark squircle tile (Slate 950 #020617 + cyan border #00E5FF)
// with the gradient geometric M mark inside.

(async () => {
  const size = 512;
  const image = new Jimp(size, size, 0x00000000);
  const padding = 24;
  const cornerRadius = 96;
  const strokeWidth = 10;

  // Render dark tile squircle background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rx = Math.max(
        0,
        Math.abs(x - size / 2) - (size / 2 - padding - cornerRadius),
      );
      const ry = Math.max(
        0,
        Math.abs(y - size / 2) - (size / 2 - padding - cornerRadius),
      );
      const dist = Math.sqrt(rx * rx + ry * ry);

      if (dist <= cornerRadius) {
        if (dist > cornerRadius - strokeWidth) {
          // Cyan glow border #00E5FF with alpha
          const borderAlpha = Math.round(
            (1 - (dist - (cornerRadius - strokeWidth)) / strokeWidth) * 180,
          );
          image.setPixelColor(
            Jimp.rgbaToInt(0, 229, 255, Math.max(60, borderAlpha)),
            x,
            y,
          );
        } else {
          // Dark Slate background (#070d1e -> #020617 vertical gradient)
          const factor = y / size;
          const r = Math.round(15 * (1 - factor) + 2 * factor);
          const g = Math.round(23 * (1 - factor) + 6 * factor);
          const b = Math.round(42 * (1 - factor) + 23 * factor);
          image.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
        }
      }
    }
  }

  // Save base dark tile icon
  const outPaths = [
    path.resolve('public/logo-icon.png'),
    path.resolve('brand-assets/logo-icon.png'),
    path.resolve('app/icon.png'),
  ];

  for (const outPath of outPaths) {
    await image.writeAsync(outPath);
  }
  console.log('Saved dark tile PNG favicons successfully!');
})();
