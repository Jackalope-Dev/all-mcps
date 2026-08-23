---
name: awwwards-sections
description: Below-the-fold landing page sections pipeline. Companion to awwwards-hero. Covers feature showcases, social proof, pricing, process/how-it-works, case studies, stats/metrics, CTA banners, FAQs, footers, and visual break sections. Enforces the same Awwwards/FWA-tier quality gates - no generic 3-card grids, no icon+heading+paragraph repeats, no stock photography, no AI-purple gradients. Each section has named architectures with CSS blueprints, a page-level sequencing system, and a final composition diff.
---

# Awwwards-Tier Landing Page Sections

> This skill covers EVERYTHING BELOW THE HERO. It does not govern hero sections (use `awwwards-hero` for that) or animations/micro-interactions (use `awwwards-motion` for those). It fires when the user asks for a full landing page, additional sections, feature blocks, pricing, testimonials, footers, or any below-the-fold content.

> **Pairing rule:** When building a full landing page, run `awwwards-hero` for the hero, then this skill for every section below it. If motion is requested, layer `awwwards-motion` on top of both.

---

## The Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   BRIEF IN ──→ Phase 1: Page Read ──→ Phase 2: Section Sequence         │
│                  (extract page goals,    (pick sections, order them,     │
│                   audience, conversion    assign architectures)          │
│                   intent)                                                │
│                                                                          │
│                              ──→ Phase 3: Build Section by Section       │
│                                   (typography, layout, content,          │
│                                    transitions between sections)         │
│                                                                          │
│                              ──→ Phase 4: Page Composition Diff          │
│                                   (rhythm, variety, conversion flow,     │
│                                    anti-slop audit)                      │
│                                                                          │
│   Each phase has a ✓ Quality Gate. Failing a gate blocks the next.       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Page Read

Before choosing sections, understand the PAGE as a whole. A landing page is a persuasion sequence, not a stack of unrelated blocks.

### → Extract these page signals

| Signal | What to determine |
|---|---|
| **Conversion goal** | What does this page want the visitor to DO? (Sign up, book a call, buy, download, explore portfolio) |
| **Visitor sophistication** | Technical buyers who need specs? Consumers who need emotion? Investors who need traction? |
| **Objection sequence** | What stops the visitor from converting? (Trust, price, complexity, "is this legit?", "will this work for me?") |
| **Content density** | Does the product/service have 3 features or 30? Simple value prop or complex platform? |
| **Visual assets available** | Product screenshots, case study images, team photos, client logos, video? Or text-only? |
| **Hero handoff** | What did the hero establish? (mood, palette, typography, focal element) - sections must continue this, not restart |

### → Output a Page Read before selecting sections

> *"Page Read: SaaS landing for technical PMs. Conversion goal: start free trial. Objection sequence: (1) 'what does it actually do?' → feature showcase needed, (2) 'who else uses this?' → social proof needed, (3) 'what does it cost?' → pricing needed, (4) 'is the team legit?' → brief about section. Hero established: dark mode, Geist typography, muted indigo accent, cinematic center architecture. Sections must continue this palette and type system."*

### ✓ Quality Gate: Page Read

Before moving to Phase 2, confirm:
- You know the conversion goal
- You have identified the top 3 visitor objections in order
- You understand what the hero already established (palette, typography, mood)
- You will NOT reset the design language below the fold

---

## Phase 2: Section Sequence

Select and ORDER sections. The sequence matters more than individual section quality - a page is a narrative, not a parts bin.

### → The Persuasion Sequence Framework

Landing pages follow a conversion psychology order. Not every page needs every section, but the ORDER is non-negotiable:

```
HERO (handled by awwwards-hero)
  ↓
1. WHAT - Feature/Value showcase (answer "what does this do?")
  ↓
2. PROOF - Social proof, logos, testimonials (answer "who else trusts this?")
  ↓
3. HOW - Process/How-it-works (answer "how does it actually work?")
  ↓
4. RESULTS - Case studies, stats, metrics (answer "what results does it get?")
  ↓
5. PRICING - Tiers, plans, comparison (answer "what does it cost?")
  ↓
6. OBJECTION KILLER - FAQ, comparison vs alternatives (answer remaining doubts)
  ↓
7. FINAL CTA - Conversion banner (last push before they leave)
  ↓
8. FOOTER - Navigation, legal, social links
```

### → Section selection rules

| Page type | Minimum sections | Recommended |
|---|---|---|
| **SaaS landing** | Feature + Proof + Pricing + CTA + Footer | + How-it-works + Stats |
| **Agency/studio** | Feature (portfolio) + Proof + Process + CTA + Footer | + Case studies + Pricing |
| **Personal portfolio** | Work showcase + About + CTA + Footer | + Testimonials + Process |
| **Product launch** | Feature + Proof + CTA + Footer | + Stats + Pricing |
| **Event/conference** | Speakers + Schedule + CTA + Footer | + Proof + FAQ |

### → Visual Rhythm Rules

These prevent the "wall of same" problem where every section looks identical:

| Rule | Why |
|---|---|
| **Alternate layout direction** | If Section A has content-left / visual-right, Section B must NOT repeat this. Alternate, center, or use full-width |
| **Alternate background tone every 2-3 sections** | Dark → slightly lighter dark → dark. Or light → very subtle tint → light. Never 5+ sections on identical backgrounds |
| **One "visual break" section per page** | A full-bleed image, a single giant stat, or a horizontal scroll strip. Breaks the grid pattern |
| **Typography scale shifts** | Feature headings might be `text-4xl`. The next section heading drops to `text-2xl` with a different weight. Then the CTA banner goes back to `text-5xl`. Monotone scale = monotone page |
| **Max 2 grid-based sections in a row** | If you used a 3-column grid for features, the next section CANNOT be another 3-column grid. Use asymmetric split, full-width, or centered single-column |

### ✓ Quality Gate: Sequence

Before moving to Phase 3, confirm:
- Sections follow the persuasion sequence order
- No two adjacent sections share the same layout pattern
- Background tones alternate appropriately
- At least one visual break exists in the page
- The section count matches the content density (don't pad a simple product with 12 sections)

---

## Phase 3: Build - Section Architectures

Each section type below has named architectures. Pick ONE architecture per section. Do not blend.

---

### SECTION TYPE: Feature / Value Showcase

Shows WHAT the product/service does. This is the first section below the hero - it must answer the visitor's #1 question immediately.

---

#### Feature Architecture A: The Bento Grid

*Best for: products with 4-6 distinct features of varying importance*

An asymmetric grid where the primary feature gets 2x the space. NOT a uniform grid - one cell dominates, others support.

```
[section container: py-24 lg:py-32, max-w-7xl mx-auto px-6]
  [section eyebrow: small mono label, muted]
  [section heading: text-4xl lg:text-5xl, max-w-3xl, mb-16]
  [bento grid: grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6]
    [primary cell: col-span-2, row-span-2, rounded-2xl, p-8-12, bg-subtle]
      [feature visual: product screenshot or illustration, 60% of cell]
      [feature text: heading + 1-2 line description below]
    [secondary cell: rounded-2xl, p-6-8, bg-subtle]
      [icon or small visual]
      [heading + description]
    [secondary cell: ...]
    [accent cell: different bg tone or bordered, same structure]
```

```css
/* BLUEPRINT: Bento grid
   WHY: auto-rows with minmax prevents cells from collapsing.
   The primary cell uses col-span-2 to dominate without explicit px widths.
   gap-4 is tight enough to feel connected, loose enough to breathe. */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: minmax(200px, auto);
  gap: 1rem;
}
.bento-primary {
  grid-column: span 2;
  grid-row: span 2;
}

/* Mobile: stack to single column */
@media (max-width: 768px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }
  .bento-primary {
    grid-column: span 1;
    grid-row: span 1;
  }
}
```

⚠ **Drift Warning:** Bento grids fail when all cells are the same size with the same padding and the same icon-heading-text pattern. ONE cell must dominate. Vary cell heights. Use different content types (visual in one, stat in another, testimonial quote in a third).

---

#### Feature Architecture B: The Stacked Showcase

*Best for: products with 2-3 major features that each deserve dedicated space*

Each feature gets its own full-width row with alternating layout direction. Left-right, right-left, left-right. Each row is a mini-split with a large visual on one side and text on the other.

```
[section container: py-24 lg:py-32, space-y-24 lg:space-y-32]
  [feature row 1: grid grid-cols-1 lg:grid-cols-2 gap-12 items-center]
    [text side: heading + description + optional bullet points]
    [visual side: product screenshot, rounded-2xl, shadow-xl]
  [feature row 2: grid grid-cols-1 lg:grid-cols-2 gap-12 items-center]
    [visual side: product screenshot] ← ORDER REVERSED
    [text side: heading + description]
  [feature row 3: repeat pattern]
```

⚠ **Drift Warning:** The alternation MUST be visual, not just CSS order. On desktop, the image physically sits on the opposite side. Use `lg:order-1` / `lg:order-2` to control visual placement independent of DOM order (DOM order should be text-first for accessibility).

---

#### Feature Architecture C: The Single Spotlight

*Best for: one hero feature that defines the product, or a product demo/video section*

One massive visual (product screenshot, video embed, interactive demo) centered with minimal text above. The visual IS the section.

```
[section container: py-24 lg:py-32, max-w-6xl mx-auto px-6, text-center]
  [eyebrow: mono label]
  [heading: text-3xl lg:text-4xl, max-w-2xl mx-auto, mb-4]
  [subtext: text-lg, muted, max-w-xl mx-auto, mb-12]
  [visual: rounded-2xl overflow-hidden, shadow-2xl, border border-white/10]
    [product screenshot or video, full-width within container]
  [optional floating detail cards: absolute positioned, showing UI details]
```

---

### SECTION TYPE: Social Proof

Answers "who else trusts this?" - the single most powerful conversion element after the hero.

---

#### Proof Architecture A: The Logo Strip

*Best for: B2B SaaS with recognizable client logos*

A single horizontal row of client logos, muted to grayscale, on a slightly different background tone. NO "Trusted by" heading in large text - the logos speak for themselves.

```
[section: py-12 lg:py-16, border-y border-white/5 (dark) or border-black/5 (light)]
  [optional small label: "Trusted by teams at" - text-xs, muted, uppercase, tracking-wide, mb-6, text-center]
  [logo row: flex items-center justify-center gap-12 lg:gap-16, flex-wrap]
    [each logo: h-6 lg:h-8, opacity-40 hover:opacity-80, transition, grayscale]
```

```css
/* BLUEPRINT: Logo strip
   WHY: Grayscale + low opacity prevents logos from competing with 
   the page's own brand colors. Hover reveals the real logo color, 
   adding a subtle interactive layer. The strip sits in a band 
   (border-y) to visually separate it without heavy background changes. */
.logo-strip img {
  height: 2rem;
  filter: grayscale(100%);
  opacity: 0.4;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.logo-strip img:hover {
  filter: grayscale(0%);
  opacity: 0.8;
}
```

---

#### Proof Architecture B: The Testimonial Cascade

*Best for: service businesses, agencies, consumer products - where human voice sells*

2-3 large testimonial cards in an asymmetric layout. NOT a uniform grid. One testimonial is larger/featured. Include real names, real titles, real photos (or quality avatars).

```
[section container: py-24 lg:py-32, max-w-7xl mx-auto px-6]
  [section heading: left-aligned or centered, mb-16]
  [testimonial grid: grid grid-cols-1 lg:grid-cols-3 gap-6]
    [featured card: lg:col-span-2, bg-subtle, rounded-2xl, p-8-10]
      [large quote: text-xl lg:text-2xl, font-medium, leading-relaxed, mb-6]
      [author row: flex items-center gap-4]
        [avatar: w-12 h-12 rounded-full]
        [name + title: text-sm]
    [secondary card: bg-subtle, rounded-2xl, p-8]
      [quote: text-base, mb-6]
      [author row]
    [secondary card: bg-subtle, rounded-2xl, p-8]
      [quote: text-base, mb-6]
      [author row]
```

⚠ **Drift Warning:** Testimonial cards that all look identical with the same padding, same text size, and centered alignment are the #1 AI slop pattern for proof sections. ONE card must be visually dominant. Vary sizes. Consider pulling a single powerful sentence as a large display quote above the grid.

---

#### Proof Architecture C: The Metric Bar

*Best for: products with impressive numbers - users, revenue processed, uptime, speed*

3-4 large numbers in a horizontal strip, each with a tiny label below. Numbers are the largest text on the page outside the hero heading. Let the numbers breathe.

```
[section: py-16 lg:py-24, border-y border-white/5]
  [metrics row: grid grid-cols-2 lg:grid-cols-4 gap-8, max-w-5xl mx-auto, text-center]
    [metric]
      [number: text-4xl lg:text-5xl, font-semibold, tracking-tight]
      [label: text-sm, muted, mt-2]
    [metric]
      [number] [label]
    ...
```

```css
/* BLUEPRINT: Metric counter
   WHY: Tabular figures prevent layout shift during count-up animations.
   The numbers should feel monumental - they are social proof encoded 
   as typography. */
.metric-number {
  font-variant-numeric: tabular-nums;
  font-size: clamp(2rem, 4vw, 4rem);
  font-weight: 600;
  letter-spacing: -0.02em;
}
```

---

### SECTION TYPE: Process / How It Works

Answers "how does this actually work?" - reduces perceived complexity.

---

#### Process Architecture A: The Numbered Steps

*Best for: 3-5 step processes, onboarding flows, service delivery timelines*

Vertically stacked steps with large step numbers, connected by a subtle vertical line. Each step has a heading and 1-2 line description. Optionally, a visual on the side that changes per step.

```
[section container: py-24 lg:py-32, max-w-5xl mx-auto px-6]
  [section heading + subtext, centered, mb-16]
  [steps: relative, space-y-16]
    [vertical line: absolute left-6 top-0 bottom-0 w-px bg-white/10 (dark)]
    [step: flex gap-8 items-start]
      [number circle: w-12 h-12 rounded-full border-2, flex items-center justify-center, relative z-10, bg-background]
        [number: text-lg font-semibold]
      [content]
        [heading: text-xl font-medium, mb-2]
        [description: text-base muted, max-w-lg]
```

---

#### Process Architecture B: The Horizontal Flow

*Best for: simple 3-step processes, visual learners, SaaS onboarding*

3 steps laid out horizontally with connecting arrows or lines between them. Each step has an icon or small visual, a heading, and a short description.

```
[section: py-24 lg:py-32]
  [heading, centered, mb-16]
  [flow: grid grid-cols-1 md:grid-cols-3 gap-0, max-w-5xl mx-auto]
    [step: px-8, relative]
      [icon or visual: w-12 h-12, mb-4]
      [heading: text-lg font-medium, mb-2]
      [description: text-sm muted]
      [connector arrow: hidden on mobile, absolute right-0 top-1/4] ← between steps only
```

⚠ **Drift Warning:** This is the highest-risk architecture for AI slop - three identical boxes with icons is the default bad output. Save it ONLY for genuinely simple 3-step flows. If you have more than 3 steps, or complex steps, use Architecture A instead.

---

### SECTION TYPE: Case Studies / Results

Answers "what results does this actually get?" - proof with depth.

---

#### Case Study Architecture A: The Card Gallery

*Best for: agencies, studios, portfolios with visual work*

Large image cards in a 2-column asymmetric grid. One card is taller, creating visual tension. Each card shows a project image with the client name and a one-line result overlaid or below.

```
[section: py-24 lg:py-32, max-w-7xl mx-auto px-6]
  [heading + subtext, mb-16]
  [gallery: grid grid-cols-1 lg:grid-cols-2 gap-6]
    [card: group, rounded-2xl, overflow-hidden, aspect-[4/3] or aspect-[3/4] - VARY]
      [image: w-full h-full object-cover, transition group-hover:scale-105]
      [overlay: absolute bottom-0 inset-x-0, p-6, bg-gradient-to-t from-black/60 to-transparent]
        [client name: text-lg font-semibold, text-white]
        [result line: text-sm text-white/70]
```

---

#### Case Study Architecture B: The Single Deep Dive

*Best for: one flagship case study that tells a story*

Full-width section dedicated to a single client story. Large hero image for the case study, followed by a 2-column layout with the challenge on one side and the results (with metrics) on the other.

```
[section: py-24 lg:py-32]
  [case study image: full-width, max-h-[60vh], object-cover, rounded-2xl mx-6]
  [content: grid grid-cols-1 lg:grid-cols-2 gap-12, max-w-6xl mx-auto, px-6, mt-12]
    [left: challenge]
      [label: "THE CHALLENGE", mono, muted, mb-4]
      [text: leading-relaxed]
    [right: results]
      [label: "THE RESULTS", mono, muted, mb-4]
      [metrics: 2-3 large numbers with labels]
      [text: brief summary]
```

---

### SECTION TYPE: Pricing

Answers "what does it cost?" - must feel transparent, not overwhelming.

---

#### Pricing Architecture A: The Clean Tiers

*Best for: SaaS with 2-3 plans*

2-3 pricing cards side by side. The recommended plan is visually elevated (different background, subtle border glow, or "Popular" badge). Cards are NOT identical height - the popular plan can be slightly taller.

```
[section: py-24 lg:py-32, max-w-5xl mx-auto px-6]
  [heading + subtext, centered, mb-4]
  [optional billing toggle: monthly/annual, centered, mb-12]
  [pricing grid: grid grid-cols-1 md:grid-cols-3 gap-6 items-start]
    [plan card: rounded-2xl, border, p-8]
      [plan name: text-lg font-medium, mb-2]
      [plan description: text-sm muted, mb-6]
      [price: text-4xl font-semibold + period label, mb-8]
      [feature list: space-y-3, text-sm]
        [feature: flex items-center gap-3, check icon + text]
      [CTA button: w-full, mt-8]
    [popular plan: same structure but - bg-accent/5, border-accent/20, ring-1 ring-accent/10]
      [badge: "Most popular" - absolute or inline, small pill]
```

⚠ **Drift Warning:** Pricing cards with 15+ features listed in tiny text are unreadable. Max 6-8 features per card. Lead with the differentiating features, not the ones shared across all plans.

---

#### Pricing Architecture B: The Comparison Table

*Best for: complex products with many differentiating features*

A full comparison matrix below simplified plan cards. The cards show price + CTA only. The table below shows detailed feature comparisons with checkmarks.

```
[plan summary: grid grid-cols-3, each card minimal - name + price + CTA]
[comparison table: mt-12, w-full]
  [table head: plan names as columns]
  [table body: feature categories as groups]
    [category heading: font-semibold, bg-subtle, full-width]
    [feature rows: text-sm, check/x/dash per plan]
```

---

### SECTION TYPE: FAQ

Kills remaining objections. The last defense before the final CTA.

---

#### FAQ Architecture A: The Accordion

*Best for: 5-8 common questions*

Single-column accordion with smooth expand/collapse. Questions are left-aligned, answers expand below with gentle height animation. A subtle rotation on the chevron/plus icon.

```
[section: py-24 lg:py-32, max-w-3xl mx-auto px-6]
  [heading, centered or left, mb-12]
  [accordion: divide-y divide-white/10]
    [item: py-5]
      [trigger: flex justify-between items-center, cursor-pointer, w-full]
        [question: text-base font-medium, text-left]
        [icon: w-5 h-5, transition rotate, text-muted]
      [answer panel: overflow-hidden, transition max-height]
        [answer text: text-sm muted, pt-4, leading-relaxed, max-w-2xl]
```

```css
/* BLUEPRINT: Accordion animation
   WHY: max-height transition is the simplest pure-CSS accordion.
   grid-template-rows: 0fr → 1fr is smoother but requires 
   wrapping content in an inner div with overflow:hidden.
   The cubic-bezier gives a snappy open, gentle close. */
.faq-answer {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.faq-answer[data-open="true"] {
  grid-template-rows: 1fr;
}
.faq-answer > div {
  overflow: hidden;
}
```

---

### SECTION TYPE: Final CTA Banner

The last conversion push. This section exists ONLY to get the click.

---

#### CTA Architecture A: The Full-Width Banner

*Best for: any page - this is the universal closer*

A full-width band with a contrasting background (if the page is dark, consider a slightly lighter dark or a subtle gradient). Large heading, short subtext, single prominent CTA button.

```
[section: py-20 lg:py-28, text-center]
  [optional subtle background: bg-gradient or slightly shifted tone]
  [heading: text-3xl lg:text-5xl, font-semibold, tracking-tight, mb-4]
  [subtext: text-lg muted, max-w-xl mx-auto, mb-8]
  [CTA button: large pill, px-10 py-4, font-medium]
```

⚠ **Drift Warning:** CTA banners with 3 buttons, a form, social links, and a paragraph of text are anti-patterns. ONE heading. ONE button. That's it. The simplicity is the persuasion.

---

#### CTA Architecture B: The Split CTA

*Best for: pages where you want to show a visual alongside the final push*

Two-column split: compelling visual (product shot, illustration, or abstract) on one side, heading + CTA on the other. The visual reinforces the value prop one last time.

```
[section: py-24 lg:py-32, grid grid-cols-1 lg:grid-cols-2 gap-12 items-center, max-w-6xl mx-auto px-6]
  [visual side: rounded-2xl, overflow-hidden]
  [text side]
    [heading: text-3xl lg:text-4xl, font-semibold, mb-4]
    [subtext: muted, mb-8]
    [CTA button]
```

---

### SECTION TYPE: Footer

Not an afterthought. The footer is the last thing a visitor sees if they scroll to the bottom without converting.

---

#### Footer Architecture A: The Minimal Strip

*Best for: landing pages, product launches - pages with a single conversion goal*

A single row: logo on the left, essential links in the center, social icons on the right. No multi-column mega-footer.

```
[footer: border-t border-white/10, py-8 lg:py-12, px-6]
  [inner: max-w-7xl mx-auto, flex flex-col lg:flex-row items-center justify-between gap-6]
    [logo: h-6 or text-lg font-semibold]
    [links: flex gap-6, text-sm, muted, hover:text-white transition]
    [right: flex items-center gap-4]
      [social icons: w-5 h-5 each, muted, hover:text-white]
  [copyright: text-center lg:text-left, text-xs, muted, mt-8 lg:mt-0]
```

---

#### Footer Architecture B: The Structured Footer

*Best for: multi-page sites, SaaS products, agencies - where navigation matters*

Multi-column grid with link categories. Logo + tagline on the far left, 3-4 link columns, newsletter signup on the far right.

```
[footer: border-t border-white/10, py-16 lg:py-20, px-6]
  [inner: max-w-7xl mx-auto, grid grid-cols-2 lg:grid-cols-5 gap-8]
    [brand col: lg:col-span-1]
      [logo]
      [tagline: text-sm muted, mt-3, max-w-xs]
    [link col: space-y-3]
      [column heading: text-sm font-semibold, mb-4]
      [link: text-sm muted hover:text-white]
      ...
    [link col] [link col]
    [newsletter col: lg:col-span-1]
      [heading: text-sm font-semibold, mb-4]
      [email input + submit button: flex]
  [bottom bar: mt-12 pt-8 border-t border-white/5, flex justify-between, text-xs muted]
    [copyright]
    [legal links: privacy, terms]
```

---

### SECTION TYPE: Visual Break

Prevents "wall of same" - a breathing moment in the page.

---

#### Break Architecture A: The Full-Bleed Image

A single full-width atmospheric image with no text overlay. Serves as a palette cleanser between content-heavy sections.

```
[section: py-0, -mx-6 or full-bleed via 100vw trick]
  [image: w-full, h-[40vh] lg:h-[60vh], object-cover]
```

---

#### Break Architecture B: The Giant Stat

One massive number or statement centered in a generous vertical space. Nothing else.

```
[section: py-24 lg:py-40, text-center]
  [stat: text-6xl lg:text-8xl, font-semibold, tracking-tight]
  [label: text-sm muted, mt-4]
```

---

#### Break Architecture C: The Horizontal Marquee

A continuous scrolling strip of text, logos, or tags. CSS-only, no JS required.

```
[section: py-6, overflow-hidden, border-y border-white/5]
  [marquee track: flex gap-8, animate-scroll]
    [items repeated 2x for seamless loop]
```

```css
/* BLUEPRINT: CSS marquee
   WHY: Translating the full width then resetting creates a seamless loop.
   Duplicating the content ensures no gaps during the loop.
   30s is slow enough to be ambient. */
@keyframes marquee-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.marquee-track {
  animation: marquee-scroll 30s linear infinite;
  width: max-content;
}
```

---

### ✓ Quality Gate: Build

Before moving to Phase 4, confirm for EACH section:
- Architecture was followed without blending
- Content is realistic (no "Lorem ipsum", no "[Feature Name]" placeholders)
- Section heading uses a DIFFERENT scale than the previous section's heading
- Background tone is NOT identical to the adjacent section
- The section could stand alone on Awwwards SOTD nominees

---

## Phase 4: Page Composition Diff

After all sections are built, audit the FULL PAGE as a composition. This catches problems that only appear when sections are stacked together.

### Visual Rhythm Diff

| Check | PASS/FAIL |
|---|---|
| No two adjacent sections share the same layout direction (both left-aligned, both centered, etc.) | |
| No two adjacent sections have identical background colors | |
| At least ONE visual break section exists somewhere in the page | |
| Section headings vary in scale (not all `text-4xl`) | |
| Grid sections are separated by non-grid sections | |

### Content Quality Diff

| Check | PASS/FAIL |
|---|---|
| No placeholder text ("Lorem ipsum", "[Feature Name]", "Description goes here") | |
| No AI cliches ("Elevate", "Seamless", "Unleash", "Next-Gen", "Revolutionize") | |
| Feature descriptions are specific, not generic ("Process 10k API calls/sec" not "Lightning fast performance") | |
| Testimonial quotes sound human, not corporate | |
| Stats use specific numbers, not rounded ("12,847 teams" not "10,000+ teams") | |

### Conversion Flow Diff

| Check | PASS/FAIL |
|---|---|
| Persuasion sequence order is maintained (WHAT → PROOF → HOW → RESULTS → PRICE → OBJECTIONS → CTA) | |
| CTA is repeated max 2-3 times across the full page (hero CTA + final CTA + optionally one mid-page) | |
| The final CTA section exists and is NOT the footer | |
| No more than 3 sections exist between the hero CTA and the next CTA opportunity | |

### Anti-Slop Diff

| Check | PASS/FAIL |
|---|---|
| No section uses the icon + heading + paragraph × 3 equal columns pattern (the #1 AI default) | |
| No generic stock photography (use product screenshots, illustrations, or `picsum.photos/seed/{keyword}/{w}/{h}`) | |
| No AI-purple/blue gradient backgrounds | |
| No "gradient mesh blob" backgrounds | |
| No cards-inside-cards-inside-cards nesting | |
| No section has more than 3 competing CTAs | |
| Feature cards are NOT all the same height with the same padding and the same structure | |

### Mobile Composition Diff

| Check | PASS/FAIL |
|---|---|
| All multi-column layouts collapse to single column below 768px | |
| Section spacing reduces proportionally on mobile (`py-24 → py-16`) | |
| No horizontal overflow on any section | |
| Images scale or hide appropriately | |
| Touch targets minimum 44px | |

---

## Section Transition Patterns

How sections connect to each other is as important as the sections themselves. Do NOT just stack sections with identical padding.

### → Background Transitions

| Pattern | When to use |
|---|---|
| **Subtle tone shift** | `bg-[#0a0a0a]` → `bg-[#111111]` → `bg-[#0a0a0a]`. 90% of transitions. Nearly invisible but prevents flatness |
| **Border separator** | `border-t border-white/5` between sections. Clean, editorial |
| **Gradient bleed** | Section A's background gradient bleeds into Section B's top edge. Creates flow |
| **Hard contrast** | Dark section → light section or vice versa. Use sparingly (max once per page) for dramatic effect |

### → Spacing Rhythm

| Section type | Vertical padding |
|---|---|
| Content-heavy (features, pricing, FAQ) | `py-24 lg:py-32` |
| Visual break (image, stat, marquee) | `py-8 lg:py-16` or `py-0` |
| Proof strip (logos) | `py-12 lg:py-16` |
| CTA banner | `py-20 lg:py-28` |
| Footer | `py-12 lg:py-20` |

---

## The Core Principles (Sections)

These apply to every section regardless of architecture:

> **Sections are not islands.** Every section must feel like it belongs to the same page as the hero. Same palette, same type system, same visual language. A section that could be dropped into any random landing page is a generic section.

> **Show, don't tell.** Product screenshots beat feature lists. Real metrics beat adjectives. Client logos beat "trusted by thousands." Visual evidence converts harder than written claims.

> **Vary the rhythm.** A page where every section is `py-32, centered heading, 3-column grid, repeat` is a wall. Alternate densities, layout directions, background tones, and content types.

> **Kill the third card.** If you catch yourself making a 3-equal-card grid for the third time on the same page, stop. Use a different architecture. The 3-card grid is the most overused pattern in web design.

> **One section, one job.** Each section answers ONE visitor question. If a section is trying to showcase features AND display testimonials AND show pricing, split it into separate sections.
