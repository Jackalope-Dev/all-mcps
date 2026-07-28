# AllMCPs Wordmark Legibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the rendered "AllMCPs" wordmark into a gradient "All" span + plain "MCPs" span, at the two places it's rendered as styled text, so the double `l` no longer reads as "11"/"II".

**Architecture:** Pure JSX markup change in `app/layout.tsx` — no new components, no CSS class changes, no logic. Reuses the existing gradient-text-clip technique already present in `app/page.tsx:50` (the "superpowers" hero word).

**Tech Stack:** Next.js App Router (React server component), inline styles (matches existing codebase convention — no CSS modules/Tailwind in this file).

## Global Constraints

- No font swap, no letter-spacing change (per spec, `docs/superpowers/specs/2026-07-27-wordmark-legibility-design.md`) — this plan touches only the two text-rendering sites.
- `.logo` and footer `h3` CSS rules in `app/globals.css` are unchanged.
- `aria-label="Go to AllMCPs Homepage"` on the navbar `Link` (`app/layout.tsx:100`) must remain unchanged.
- This codebase has no automated test runner (no `jest`/`vitest`/`playwright`, no `test` script in `package.json`) — verification is `npm run build` (typecheck + compile) plus a manual visual check via the dev server, not unit tests.

---

### Task 1: Split the wordmark into gradient "All" + plain "MCPs" in the navbar logo and footer heading

**Files:**
- Modify: `app/layout.tsx:102` (navbar logo text, inside the `Link` at `app/layout.tsx:100-103`)
- Modify: `app/layout.tsx:117` (footer `h3` text)

**Interfaces:**
- Consumes: `var(--accent-color)` (defined in `app/globals.css:6`) and the literal `#007BFF` — same two colors as the existing gradient at `app/page.tsx:50`.
- Produces: nothing consumed elsewhere; this is a leaf UI change.

- [ ] **Step 1: Edit the navbar logo**

In `app/layout.tsx`, replace lines 100-103:

```tsx
            <Link href="/" className="logo animate-fade-in" style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }} aria-label="Go to AllMCPs Homepage">
              <img src="/logo-icon.svg" alt="" width={40} height={40} aria-hidden="true" />
              AllMCPs
            </Link>
```

with:

```tsx
            <Link href="/" className="logo animate-fade-in" style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }} aria-label="Go to AllMCPs Homepage">
              <img src="/logo-icon.svg" alt="" width={40} height={40} aria-hidden="true" />
              <span style={{ background: 'linear-gradient(135deg, var(--accent-color), #007BFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>All</span>MCPs
            </Link>
```

- [ ] **Step 2: Edit the footer heading**

In `app/layout.tsx`, replace line 117:

```tsx
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>AllMCPs</h3>
```

with:

```tsx
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>
                <span style={{ background: 'linear-gradient(135deg, var(--accent-color), #007BFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>All</span>MCPs
              </h3>
```

- [ ] **Step 3: Build to verify no type/compile errors**

Run: `npm run build`
Expected: `✓ Compiled successfully`, no TypeScript errors, no new warnings about the changed lines.

- [ ] **Step 4: Visual check on the dev server**

Run: `npm run dev`, open `http://localhost:3000/`.
Confirm:
- Navbar logo (top-left) reads as "All" in the cyan/blue gradient immediately followed by "MCPs" in white — the word boundary is visually obvious, no line-wrap or spacing gap introduced between "All" and "MCPs".
- Scroll to the footer — the "AllMCPs" heading matches the same treatment.
- No layout shift compared to before (gradient text-clip only recolors existing glyphs, doesn't change box size).

Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "$(cat <<'EOF'
Split AllMCPs wordmark into gradient All + plain MCPs for legibility

The double l in "All" was reading as "11"/"II" at heavy weight and
tight tracking. Coloring "All" as its own gradient block lets it read
as a distinct chunk instead of a string of ambiguous glyphs.
EOF
)"
```

---

## Self-Review

- **Spec coverage:** the spec (`docs/superpowers/specs/2026-07-27-wordmark-legibility-design.md`) calls for exactly two edits — navbar logo and footer heading — both covered by Task 1, Steps 1-2. No font/letter-spacing/CSS-class changes are included, matching the spec's explicit exclusions.
- **Placeholder scan:** none — every step has literal before/after code.
- **Type consistency:** both spans use the identical style object (copied from `app/page.tsx:50`'s established pattern), so there's no drift between the two edit sites.
