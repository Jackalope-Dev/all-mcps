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
- Use moderately tight letter spacing on large headings (`letter-spacing: -0.01em` to `-0.03em`) and weights `600`–`700` for hero text (Firecrawl uses 500; we keep slightly heavier so Atkinson still reads at display size). Avoid ultra-tight tracking on the wordmark — it collapses the double-`l`.
- **Mono:** Geist Mono (`--font-geist-mono` / `--font-mono`) for ASCII, section kickers, terminal chrome, and tabular figures. Never for UI labels.
- Use `400` or `500` font weights for body text to ensure readability.
- Wordmark markup: split as `All` (gradient) + `MCPs` (solid), via the `.wordmark-all` / `.wordmark-mcps` classes.

## 4. Design System & UI Patterns (Firecrawl-Inspired)

Our UI language takes direct inspiration from modern high-performance dev tools (e.g. Firecrawl), featuring generous whitespace, crisp hairline borders, elevated dark surfaces, subtle electric blue/cyan glow, structural crosshair grids, and animated ASCII code canvas backgrounds.

### Elevated Surfaces & Glass
- **Base Background:** `#030712` (`--bg-color`)
- **Elevated Surface:** `#0b1324` (`--bg-elevated`)
- **Glass Chrome:** `rgba(11, 19, 36, 0.75)` with `backdrop-filter: blur(16px)`
- **Hairline Borders:** `rgba(255, 255, 255, 0.08)` default, `rgba(0, 229, 255, 0.3)` on hover/active
- **Glow Accents:** `radial-gradient(circle, rgba(0, 229, 255, 0.25), transparent)`

### Structural Grid & Crosshairs
- **Crosshair Corners:** Use `.grid-crosshair` (`.grid-crosshair-tl`, `.grid-crosshair-tr`, `.grid-crosshair-bl`, `.grid-crosshair-br`) to place subtle monospace `+` intersection marks on container borders.
- **Full-Bleed Dividers:** `.border-grid-x` generates edge-to-edge hairline dividers framing sections.

### ASCII Code Canvas & Atmosphere
- **Component:** `components/ui/AsciiCodeCanvas.tsx`
- Classic ASCII fire, remapped onto brand cyan: heat seeds at the floor, averages upward, and maps onto a density ramp plus slate → blue → cyan → white.
- Frame rate is ~85ms (Firecrawl's flame cadence), not 60fps. Pointer proximity adds a local heat bloom. Pauses off-screen. `prefers-reduced-motion` gets a single static frame.
- Paired with `components/ui/AmbientCodeBackground.tsx` (graph-paper grid + `[ TAG ]` labels) for hero/marketing section backdrops.
- Section kickers use the Firecrawl index form: `[ 01 / 06 ] · Discovery //`.

### Shared UI Components
Always use canonical shared components instead of hand-rolling one-off styles:
- **`Button` (`components/ui/Button.tsx`)**:
  - `variant="primary"`: Electric cyan/blue gradient with specular top highlight and glow flare.
  - `variant="secondary"`: Dark glass surface with hairline border and hover lift.
  - `variant="terminal"`: Monospace dev-tool button for command/code actions.
  - `variant="glass"`: Semi-transparent frosted glass button.
- **`Badge` (`components/ui/Badge.tsx`)**:
  - `variant="cyan" | "official" | "verified" | "premium" | "category" | "default"`
  - `pulse={true}`: Displays an animated live status indicator dot.
  - `mono={true}`: Displays crisp monospace tracking for dev-tool tags.
- **`Card` (`components/ui/Card.tsx`)**:
  - `hoverable={true}`: Hover lift with shadow elevation.
  - `glow={true}`: Subtle cyan glow aura.
  - `crosshair={true}`: Adds corner intersection crosshairs.
- **`CopyBlock` (`components/ui/CopyBlock.tsx`)**:
  - Terminal window with traffic light controls (`red`, `yellow`, `green`) and one-click copy with toast feedback.

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
