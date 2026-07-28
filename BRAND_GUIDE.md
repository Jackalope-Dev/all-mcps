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
- **Cyan:** `#00E5FF` (Used for active states, vibrant highlights, primary brand identity)
- **Blue:** `#007BFF` (Used as the secondary color in brand gradients)

**Primary Gradient (Cyan to Blue):**
Used in the main logo and for key hero text / superpowers text.
`background: linear-gradient(135deg, #00E5FF, #007BFF)`

### Backgrounds (Dark Mode First)
- **Base Background:** `#020617` (Slate 950)
- **Surface / Card Background:** `#0f172a` (Slate 900)
- **Borders:** `rgba(255, 255, 255, 0.1)`

### Typography Colors
- **Primary Text:** `#ffffff` (White, for headings)
- **Secondary Text:** `#94a3b8` (Slate 400, for body and subtext)

## 3. Typography
- **Primary Font:** Inter, Roboto, or Geist (sans-serif)
- Use tight letter spacing (`letter-spacing: -2px` or similar) and heavy font weights (`800` or `900`) for main hero text and logos.
- Use `400` or `500` font weights for body text to ensure readability.

## 4. Logo & Assets
All official brand assets are located in the `/brand-assets/` directory.
- `logo-icon.svg` / `.png` - The standalone cyan geometric "M". Use for favicons, small spaces, and standard UI headers alongside text.
- `logo-full-light.svg` / `.png` - Icon + White Wordmark. Best for dark backgrounds.
- `logo-full-dark.svg` / `.png` - Icon + Dark Wordmark. Best for light backgrounds.
- `promo-banner.svg` / `.png` - 1200x630 card for social media and OpenGraph sharing.

**Usage:**
- When adding the logo to the website, use the SVG format located at `/public/logo-icon.svg` to ensure perfect transparency and scaling.
