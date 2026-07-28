# AllMCPs Visual System Design

**Date:** 2026-07-27  
**Status:** Approved for implementation planning  
**Scope:** Full visual system — design tokens, hybrid surfaces, shared layout shells, component library, equal polish across all public pages.

## Goals

- Cohesive enterprise-SaaS look and feel aligned with [BRAND_GUIDE.md](../../../BRAND_GUIDE.md).
- Hybrid surface model: solid slate panels for content/forms; light glass only for floating chrome.
- Equal visual polish on landing, browse, detail, forms, content, auth, and status pages.
- Reduce one-off inline styles; establish reusable shells and semantic CSS classes.

## Non-goals

- New product features or copy rewrites.
- Light mode.
- Full Tailwind migration.
- Email template redesign.
- Admin functional changes (admin may pick up tokens via shared CSS only).

## Approach

**Design-token CSS + shared shells + template pass** (Approach A):

1. Extend `app/globals.css` with a complete token layer and surface utilities.
2. Extract `SiteHeader`, `SiteFooter`, `PageShell`, and `EmptyState`.
3. Align UI primitives (`Button`, `Card`, `Input`, `Badge`) to tokens.
4. Rewrite page templates to use shells and surfaces; remove ad-hoc inline layout styles.

---

## 1. Design tokens

### Color

| Token | Value | Role |
|-------|--------|------|
| `--bg-color` | `#020617` | Page base (slate 950) |
| `--bg-elevated` | `#0f172a` | Solid cards / content panels |
| `--bg-muted` | `rgba(15, 23, 42, 0.6)` | Nested surfaces, table rows |
| `--text-primary` | `#ffffff` | Headings |
| `--text-secondary` | `#94a3b8` | Body / meta |
| `--border-color` | `rgba(255, 255, 255, 0.1)` | Default borders |
| `--brand-cyan` | `#00E5FF` | Accent, focus, active text |
| `--brand-blue` | `#007BFF` | Gradient secondary stop |
| `--brand-gradient` | `linear-gradient(135deg, #00E5FF, #007BFF)` | Primary CTAs, wordmark “All”, active segments |
| `--brand-gradient-soft` | soft cyan→blue wash | Logo tile, soft fills |
| `--accent-color` | `#00E5FF` | Alias for interactive accent |
| `--accent-secondary` | `#007BFF` | Alias for secondary brand stop |
| `--accent-glow` | `rgba(0, 229, 255, 0.28)` | Focus rings / soft highlight |

**Migration note:** Current CSS uses near-black `#050505` and zinc-like borders. Tokens must move to brand-guide slate values.

**Brand bleed fix:** Replace generic blue (`#3b82f6`, `#93c5fd`, related rgba) in tags, badges, category hovers, and markdown link underlines with brand cyan-based values.

### Type scale

| Class / role | Size | Weight | Notes |
|--------------|------|--------|-------|
| `.text-display` | `clamp(2.5rem, 5vw, 3.75rem)` | 800 | Landing hero only |
| `.text-page-title` | `clamp(1.75rem, 3vw, 2.25rem)` | 700–800 | Content/form H1 |
| `.text-section` | `1.5rem`–`1.75rem` | 700 | H2 |
| Body | `1rem` | 400–500 | Line-height ~1.6 |
| Meta | `0.875rem` | 500 | Secondary color |

**Global `h1` / `h2`:** Use page-title / section defaults (not 4rem). Landing hero opts into `.text-display` explicitly.

**Font:** Atkinson Hyperlegible Next (existing). Wordmark rules unchanged (`.wordmark-all` / `.wordmark-mcps`).

### Space, radius, elevation

- **Space:** 4px base → `--space-1` … `--space-16` (4, 8, 12, 16, …).
- **Radius:** `--radius-sm` 8px · `--radius-md` 12px · `--radius-lg` 16px · `--radius-xl` 24px · `--radius-full` 9999px.
- **Shadow:** `--shadow-sm`, `--shadow-md`, `--shadow-glow` (soft cyan brand glow).

### Ambient background

Keep dual radial glows (cyan + blue) on `body`, tuned for slate-950 so solid panels read as islands.

---

## 2. Surface system (hybrid)

| Class | Treatment | Used for |
|-------|-----------|----------|
| `.surface` | Solid `--bg-elevated`, 1px border, no blur | Content panels, forms, detail cards, about/legal body |
| `.surface-muted` | `--bg-muted`, lighter border | Nested blocks, code wells, metric rows |
| `.surface-glass` | Semi-transparent + `backdrop-filter` | Sticky header, modals, toasts, sticky filter bars |
| `.surface-interactive` | `.surface` + hover lift + cyan glow | Listing cards, category cards, feature tiles |

**Legacy aliases:** `glass-panel` and `glass-panel-static` map to the new system (or thin wrappers) during migration, then call sites switch to semantic surface classes.

**Hover policy:** Only `.surface-interactive` (and explicit card-hoverable paths) lift. Static content panels do not float on hover.

---

## 3. Layout shells

### SiteHeader

- Sticky top; chrome uses `.surface-glass`.
- Logo: `BrandLogo` size `md` with wordmark.
- Nav: Browse, Categories, primary Submit MCP.
- **Active route:** brand cyan text (optional soft underline or pill).
- Gradient hairline under header retained.
- Mobile: wrap + tokenized gaps; optional shorter CTA label on very small widths if needed.

### SiteFooter

- Replace inline styles with structured classes.
- Columns: brand blurb · Resources · For AI & Agents · Company (content unchanged).
- Brand divider top; copyright bar bottom.
- Shared `.footer-heading` and `.nav-link` styles.

### PageShell

| Variant | Layout | Used by |
|---------|--------|---------|
| `default` | container + vertical rhythm | categories, browse chrome |
| `narrow` | max-width ~720–800px, centered | contact, privacy, terms, verify-request |
| `content` | max-width ~850px + optional `.surface` panel | about, guide, blog, submit |
| `auth` | centered min-height, max-width ~440px + surface | login |
| `status` | centered empty/error card (~600px) | 404, error, global-error |

**Props (conceptual):** `title?`, `description?`, `kicker?`, `breadcrumbs?`, `children`, `width` / `variant`, `panel` (boolean).

### Breadcrumbs & rhythm

- Reuse `.breadcrumb`; padding comes from shell, not per-page magic numbers.
- Main top spacing accounts for sticky header consistently (`6rem` / `8rem` one-offs removed).

### Admin

No special marketing chrome. Admin inherits root header/footer and token CSS only.

---

## 4. Component library

| Component | Spec |
|-----------|------|
| **Button** | Variants: `primary` (gradient), `secondary` (surface + border), `glass` (legacy chrome if needed). Sizes: `sm` \| `md` \| `lg`. Optional `fullWidth`. |
| **Card** | Default solid `.surface`. Listings use `.surface-interactive`. Glass is not the default card look. |
| **Input** | Shared padding/radius; cyan focus ring; error state class. Select/textarea match. |
| **Badge** | Variants: `default`, `verified`, `premium`, `category`. Active/category accents = brand cyan. |
| **EmptyState** | Icon + title + body + optional CTA. Used by browse empty, 404, error. |
| **Listing identity** | Deterministic avatar gradients from a brand-adjacent palette (cyan/blue/slate), not full rainbow. |

Also align: **CopyBlock**, **UpvoteButton**, **directory segmented controls**, **directory tags** — same tokens and cyan active states.

---

## 5. Page templates

### Landing

- Hero uses `.text-display` + tagline with gradient “superpowers”.
- Clear hierarchy: hero → search/filters → marquee → featured → list/grid.
- Marquee and featured cards use `surface-interactive`.
- Directory list/grid styling matches browse.

### Browse

- Category header/kicker retained; re-token only.
- Filter chrome: solid by default; `surface-glass` only if sticky.
- Toolbar (sort + view + verified) reads as one unit.
- Empty filter results → `EmptyState`.

### MCP detail

- Breadcrumb → title row (name, badges) → metrics.
- Main + sticky sidebar: solid surfaces.
- Install/copy, engagement, README in clear sections.
- Repo/site actions use `Button` secondary (no ad-hoc link styles).

### Forms (submit, contact)

- `PageShell` content + surface panel.
- Consistent field spacing, labels, helper text, Turnstile placement.
- Primary submit full-width on mobile.

### Content (about, guide, blog, what-is-mcp)

- Shared prose panel treatment.
- About feature tiles: 3-up solid surface cards with cyan titles.
- CTAs only via `Button` variants.

### Auth (login, verify-request)

- `PageShell` auth; logo mark; single-column form.

### Status (404, error, global-error)

- `PageShell` status + EmptyState pattern.
- Gradient “404” (or error code) accent retained.

### Categories

- Grid of `surface-interactive` cards.
- Emoji tile: brand soft fill on hover (cyan, not generic blue).

### Claim / embed / admin

- Same tokens and surfaces; claim feels like other forms.
- No unique marketing chrome required.

---

## 6. Implementation order

1. Tokens + surface CSS + type scale in `globals.css`.
2. `SiteHeader`, `SiteFooter`, `PageShell`, `EmptyState`; wire into `layout.tsx`.
3. `Button`, `Card`, `Input`, `Badge` updates.
4. `DirectoryGrid`, `FeaturedMarquee`, `FeaturedCards`, `CategoryGrid`.
5. MCP detail page.
6. Remaining routes: forms, content, auth, status, claim.
7. Sweep: migrate off glass aliases, remove leftover inline layout styles, fix remaining brand-blue bleed.
8. Visual QA pass (desktop + mobile breakpoints already in CSS).

---

## 7. File touch map (expected)

| Area | Files |
|------|--------|
| Tokens / CSS | `app/globals.css` |
| Layout | `app/layout.tsx`, new `components/SiteHeader.tsx`, `components/SiteFooter.tsx`, `components/PageShell.tsx`, `components/EmptyState.tsx` |
| UI primitives | `components/ui/Button.tsx`, `Card.tsx`, `Input.tsx`, `Badge.tsx` (+ CSS hooks) |
| Directory | `components/DirectoryGrid.tsx`, `FeaturedCards.tsx`, `FeaturedMarquee.tsx`, `CategoryGrid.tsx` |
| Pages | `app/page.tsx` (via grid), `browse`, `categories`, `mcp/[id]`, `submit`, `contact`, `about`, `guide`, `blog`, `what-is-mcp`, `login`, `verify-request`, `privacy`, `terms`, `not-found`, `error`, `global-error`, claim flows as needed |
| Brand doc | Optional small token cross-ref in `BRAND_GUIDE.md` if implementation adds stable class names |

---

## 8. Success criteria

- [ ] All public pages share the same header/footer treatment and vertical rhythm.
- [ ] Content and form panels are solid slate surfaces; glass reserved for floating chrome.
- [ ] No generic blue (`#3b82f6` family) left in interactive UI accents.
- [ ] Typography: hero vs page title distinction is intentional; no global 4rem H1 fighting content pages.
- [ ] Buttons, cards, inputs, badges used consistently; minimal layout via inline `style={}`.
- [ ] Browse empty and error/404 use `EmptyState`.
- [ ] Mobile breakpoints still usable (directory list, detail grid, categories).
- [ ] Visual cohesion matches brand: dark slate, cyan→blue accents, Atkinson, flat vector SaaS aesthetic.

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Large CSS regression | Migrate with aliases first; then replace call sites; smoke-check key routes |
| Sticky header overlap | Consistent main padding + sticky offset tokens |
| Hover lift on non-clickable panels | Only `surface-interactive` lifts |
| Scope creep into copy/features | Non-goals list; PR review against this doc |

---

## Approval history

- Scope: Full visual system  
- Aesthetic: Hybrid (solid content + glass chrome)  
- Coverage: Equal polish everywhere  
- Approach: A — token CSS + shared shells + template pass  
- Sections 1–3: approved by product owner in design review chat  
}
