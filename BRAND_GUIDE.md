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
- **Base Background:** `#05070c` (`--bg-color`)
- **Surfaces:** `#0b0f17` / `#10151f` / `#161c28` (`--surface-1/2/3`)
- **Borders:** `rgba(255, 255, 255, 0.07)` default, `0.13` strong (`--border-color`, `--border-strong`)

### Typography Colors
- **Primary Text:** `#ffffff` (White, for headings)
- **Secondary Text:** `#94a3b8` (Slate 400, for body and subtext)

## 3. Typography
- **Primary Font:** [Atkinson Hyperlegible Next](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next) (sans-serif) — designed so easily confused characters stay distinct (`l` vs `I` vs `1`, `O` vs `0`). Lowercase **`l` has a clear tail**, not a plain vertical bar, so **AllMCPs** does not read as `A11` / `AII`.
- **Fallbacks:** system UI stack (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, sans-serif).
- Use moderately tight letter spacing on large headings (`letter-spacing: -0.01em` to `-0.03em`) and weights `600`–`700` for hero text (Firecrawl uses 500; we keep slightly heavier so Atkinson still reads at display size). Avoid ultra-tight tracking on the wordmark — it collapses the double-`l`.
- **Mono:** Geist Mono (`--font-geist-mono` / `--font-mono`) for ASCII, section kickers, terminal chrome, and tabular figures. Never for UI labels.
- Use `400` or `500` font weights for body text to ensure readability.
- Wordmark markup: split as `All` (gradient) + `MCPs` (solid), via the `.wordmark-all` / `.wordmark-mcps` classes.

## 4. Design System & UI Patterns ("calm precision")

Neutral surfaces, crisp hairlines, generous whitespace, and short purposeful motion. Brand cyan
is the single accent; glow is reserved for the one primary action in a view. Inspiration: Linear,
Vercel, Raycast, Stripe docs. Tokens and primitives live in `app/styles/foundation.css` (loaded after
`app/globals.css`); each area of the site has its own stylesheet in `app/styles/` (`chrome`, `home`,
`directory`, `listing`, `tools`, `content`, `account`). Build new UI from the primitives below rather
than hand-rolling one-off styles or large inline `style={{}}` objects.

### Tokens
- **Surfaces:** `--bg-color`, `--surface-1/2/3`, `--surface-hover`
- **Text:** `--text-primary`, `--text-secondary`, `--text-tertiary`
- **Lines & focus:** `--border-color`, `--border-strong`, `--border-accent`, `--ring`
- **Shape & depth:** `--radius-sm/md/lg/xl` (8/12/16/22), `--shadow-xs/sm/md/elevated/elevated-hover/popover`
- **Motion:** `--ease-out` (default), `--ease-in-out`, `--ease-spring` (things that land: popovers, toasts, chips), `--duration-fast/base/slow`

### Primitives (`app/styles/foundation.css`)
- **Buttons:** `.btn` + `.btn-primary | .btn-secondary | .btn-ghost | .btn-glass`, sizes `.btn-sm|md|lg`, `.btn-icon`. One primary per view.
- **`.chip`** (`.is-active` / `aria-pressed="true"`, `.chip-count`): the single pill style for filters and quick queries.
- **`.segmented`**: mutually exclusive toggles (sort, view mode).
- **Sections:** `.section`, `.section-tight`, `.section-head` (`--center`, `--split`), `.section-title`, `.section-sub`.
- **Surfaces:** `.surface`, `.surface-interactive` (hover lift), `.spotlight` (cursor-following accent wash; coordinates come from `components/MotionRuntime.tsx`).
- **Misc:** `.kbd`, `.divider`, `.link-arrow`, `.tabular`, `.crumbs` (breadcrumbs), `.fade-x` + `.scroll-x` (mobile chip rows), `.skeleton` (loading shimmer).

### Motion
- Route changes cross-fade via React `<ViewTransition>` in `app/template.tsx`; a 2px progress bar runs on every internal navigation (`MotionRuntime`).
- Above the fold: `.animate-in` / `.animate-fade` with a `--i` stagger. Scroll reveals: `.reveal` / `.reveal-stagger` (children set `--i`), which are pure CSS scroll-driven animations (no JS, never hidden waiting on hydration).
- Animate transform and opacity only, 120–450ms. Everything is disabled under `prefers-reduced-motion`.
- Every dynamic route gets a page-shaped `loading.tsx` skeleton so navigation feels instant.

### Brand atmosphere (use sparingly)
- `components/ui/AsciiCodeCanvas.tsx` (cyan ASCII fire, ~85ms cadence, pauses off-screen, static under reduced motion) and `components/ui/AmbientCodeBackground.tsx` back the homepage hero only.
- Avoid decorative noise and generated-looking tropes: no eyebrow/kicker labels above headings, no crosshair `+` marks, no `[ 01 / 06 ]` index tags. A heading and a one-line lead are enough.

### Shared UI Components
- **`Button`** (`components/ui/Button.tsx`): `variant="primary" | "secondary" | "glass" | "terminal"`, `size="sm" | "md" | "lg"`, `href` renders a Link.
- **`Badge`** (`components/ui/Badge.tsx`): `variant="cyan" | "official" | "verified" | "premium" | "category" | "default"`, `pulse`, `mono`.
- **`Card`** (`components/ui/Card.tsx`): `hoverable`, `surface`, `padding`, `glow`.
- **`PageShell` / `PageHeader`** (`components/PageShell.tsx`): page width variants and the standard title block.
- **`CopyBlock`** (`components/ui/CopyBlock.tsx`): code panel with one-click copy and success state.
- Area building blocks: `components/content/ArticleLayout.tsx` (guides/blog/docs), `components/tools/ToolPage.tsx` + `CodePanel.tsx` (developer tools), `components/directory/ServerRow.tsx` (listing rows/cards), `components/listing/InstallPanel.tsx` (install flow).

## 5. Logo & Assets
All official brand assets are located in the `/brand-assets/` directory.
- `logo-icon.svg` / `.png` - The standalone cyan geometric "M". Use for favicons, small spaces, and standard UI headers alongside text.
- `logo-full-light.svg` / `.png` - Icon + White Wordmark. Best for dark backgrounds.
- `logo-full-dark.svg` / `.png` - Icon + Dark Wordmark. Best for light backgrounds.
- `promo-banner.svg` / `.png` - 1200x630 card for social media and OpenGraph sharing.

**Usage:**
- Prefer the shared React component `components/BrandLogo.tsx` (icon tile + optional wordmark) so size, glow, and gradient stay consistent.
- SVG source of truth: `/public/logo-icon.svg` (also under `/brand-assets/`).
- Header: `size="md"` with wordmark. Footer / compact: `size="sm"`. Auth / empty states: `size="lg"` icon-only is fine.
