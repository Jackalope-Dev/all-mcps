# AllMCPs Brand Guide

This document outlines the core brand identity, colors, typography, and assets for AllMCPs. Any future agents modifying UI or generating new materials should strictly adhere to these guidelines.

## 1. Brand Identity
**Name:** AllMCPs
**Tagline:** Give your AI agents superpowers.
**Mission:** The definitive directory for discovering and installing Model Context Protocol servers.

**Aesthetic:** Modern, Trustworthy, Enterprise SaaS, Flat Vector Geometry.
- **DO:** Use solid dark backgrounds, sleek gradients, flat vectors, and clean typography.
- **DO NOT:** Use classic "AI generated" tropes (e.g., 3D neon orbs, complex glowing meshes, hyper-realistic robot nodes). Keep it professional.

## 2. Colors

### Primary Accents
- **Cyan:** `#00E5FF` (logo, active states, focus rings, highlights) — CSS `--brand-cyan` / `--accent-color`
- **Blue:** `#007BFF` (secondary brand stop) — CSS `--brand-blue` / `--accent-secondary`

**Primary Gradient (Cyan to Blue):**
Used in the logo mark, primary buttons, nav hairline, hero “superpowers”, and wordmark “All”.
```css
--brand-gradient: linear-gradient(135deg, #00E5FF, #007BFF);
```

### Backgrounds (Dark Mode First)
- **Base Background:** `#020617` (Slate 950)
- **Surface / Card Background:** `#0f172a` (Slate 900)
- **Borders:** `rgba(255, 255, 255, 0.1)`

### Typography Colors
- **Primary Text:** `#ffffff` (White, for headings)
- **Secondary Text:** `#94a3b8` (Slate 400, for body and subtext)

## 3. Typography
- **Primary Font:** [Atkinson Hyperlegible Next](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next) (sans-serif) — designed so easily confused characters stay distinct (`l` vs `I` vs `1`, `O` vs `0`). Lowercase **`l` has a clear tail**, not a plain vertical bar, so **AllMCPs** does not read as `A11` / `AII`.
- **Fallbacks:** system UI stack (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif).
- Use moderately tight letter spacing on large headings (`letter-spacing: -0.01em` to `-0.03em`) and heavy font weights (`700`–`800`) for hero text and logos. Avoid ultra-tight tracking on the wordmark — it collapses the double-`l`.
- Use `400` or `500` font weights for body text to ensure readability.
- Wordmark markup: split as `All` (gradient) + `MCPs` (solid), via the `.wordmark-all` / `.wordmark-mcps` classes.

## 4. Logo & Assets
All official brand assets are located in the `/brand-assets/` directory.
- `logo-icon.svg` / `.png` - The standalone cyan geometric "M". Use for favicons, small spaces, and standard UI headers alongside text.
- `logo-full-light.svg` / `.png` - Icon + White Wordmark. Best for dark backgrounds.
- `logo-full-dark.svg` / `.png` - Icon + Dark Wordmark. Best for light backgrounds.
- `promo-banner.svg` / `.png` - 1200x630 card for social media and OpenGraph sharing.

**Usage:**
- Prefer the shared React component `components/BrandLogo.tsx` (icon tile + optional wordmark) so size, glow, and gradient stay consistent.
- SVG source of truth: `/public/logo-icon.svg` (also under `/brand-assets/`).
- Header: `size="md"` with wordmark. Footer / compact: `size="sm"`. Auth / empty states: `size="lg"` icon-only is fine.
