---
name: awwwards-motion-design
description: Motion design pipeline for building Awwwards/Apple-tier animations, micro-interactions, scroll sequences, page transitions, and kinetic typography. Enforces the principles that separate award-winning motion from generic CSS transitions - intentional easing, scroll-linked choreography, staggered reveals, magnetic interactions, text splitting, parallax depth, morphing state transitions, and the invisible micro-animations that make interfaces feel alive. Every animation must justify its existence, respect reduced-motion, and run at 60fps. Motion is choreography, not decoration.
---

# Awwwards-Tier Motion Design

> This skill fires when the user asks for animations, transitions, micro-interactions, scroll effects, page transitions, kinetic typography, parallax, hover physics, loading sequences, or anything that involves making a web interface feel alive and premium. Motion is the language of quality - the difference between a static page and an experience that feels like it was hand-crafted by a studio charging $200k per project.

---

## The Pipeline

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│   BRIEF IN ──→ Phase 1: Motion Audit ──→ Phase 2: Choreography      │
│                  (classify, extract        (sequence map, timing      │
│                   motion intent)            sheet, easing palette)    │
│                                                                       │
│                              ──→ Phase 3: Build                       │
│                                   (implement layer by layer:          │
│                                    entry → scroll → hover →          │
│                                    transitions → ambient)            │
│                                                                       │
│                              ──→ Phase 4: Motion Diff                 │
│                                   (60fps check, feel check,          │
│                                    reduced-motion audit)             │
│                                                                       │
│   Each phase has a ✓ Quality Gate. Failing a gate blocks the next.    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## The Core Doctrine

Before touching any code, internalize these. They override every aesthetic preference. The quality bar is **Apple keynote presentations, Linear app, Stripe homepage, Vercel dashboard, Raycast.** If your animation would look out of place on apple.com, it is not good enough.

> **The Apple Standard.** Apple does not use generic CSS transitions. Apple uses spring physics - animations that overshoot, settle, and breathe like physical objects. Every interaction on iOS feels like touching a real thing: buttons compress, sheets slide with momentum, elements settle with a gentle bounce. Your animations must achieve this same physical, tangible quality. If an element moves and it feels "digital" or "computed" rather than "physical" or "alive," the easing is wrong.

> **Every animation must have a reason.** If you cannot answer "why does this move?" with a functional answer (guides attention, communicates state change, provides feedback, establishes spatial relationship), remove the animation. Motion without purpose is noise.

> **The best animations are invisible.** The user should not think "that's a nice animation." They should think "this feels good." If the animation draws attention to ITSELF rather than to the CONTENT, it is too much. Apple never makes you wait for an animation to finish. The animation serves the interaction, not the other way around.

> **Cohesion is everything.** A page where every animation uses the same easing family, the same intensity level, and the same motion language feels like one studio built it. A page where fade-ups coexist with bouncy springs, slide-lefts, and scale-pops feels like a committee. **Pick ONE motion personality and enforce it everywhere.** Cohesion with fewer animations will always beat variety with full coverage. If forced to choose, sacrifice coverage for consistency - a page with 8 beautifully coordinated animations beats a page with 30 mismatched ones.

> **Spring physics over cubic-bezier.** The era of `cubic-bezier(0.25, 0.1, 0.25, 1)` as the pinnacle of easing is over. Material Design 3 Expressive has moved to spring-based motion. Apple has used spring animations since iOS 7. The web has caught up: CSS `linear()` enables true spring physics with overshoot and settle. Use spring-derived easing for EVERY primary animation. Reserve cubic-bezier only for ambient/background motion where spring overshoot would be inappropriate.

> **Easing IS the animation.** A 300ms linear transition and a 300ms spring transition have the same duration but completely different character. The curve is what separates a $200k studio site from a template. There is no such thing as a "default" ease. Every curve is a deliberate, conscious choice with a specific emotional character.

> **Stagger creates hierarchy.** When multiple elements animate, they cannot all move at once. Stagger is the motion equivalent of visual hierarchy - it tells the eye where to look first, second, third. Apple staggers with millisecond precision. So do you.

> **Motion respects the user.** Every animation gates behind `prefers-reduced-motion`. No exceptions. Users who set this flag have vestibular disorders, motion sensitivity, or simply prefer stillness. Reduced motion does not mean no animation - it means no translation, no parallax, no scale, no spring overshoot. Opacity-only fades at reduced duration are acceptable.

> **Every element earns its motion budget.** On marketing/landing pages, this means full coverage - every visible element gets at least one form of motion (entry, scroll reveal, hover, or ambient). A static element in an animated page is a dead pixel in a living display. On functional app UI, motion follows a frequency gate:
>
> | Usage frequency | Motion budget |
> |---|---|
> | 100+ times/day (keyboard shortcuts, command palette, core nav) | **ZERO animation. Ever.** Speed is the experience. |
> | Tens of times/day (hover states, list navigation, toggles) | Minimal - fast, nearly imperceptible feedback only |
> | Occasional (modals, drawers, toasts, settings panels) | Standard motion from the easing palette |
> | Rare / first-time (onboarding, empty states, success, celebration) | Full delight budget - springs, bounce, stagger generosity |
>
> **Hard rule:** Keyboard-initiated actions NEVER animate. A command palette that animates open/closed 200 times a day trains users to hate it. The fastest interface wins.

---

## The Animation Coverage Mandate

This is the non-negotiable rule: **every visible element gets motion.** Not "most elements." Not "the important ones." Every element. Walk through the page element by element and assign motion from this table. If an element does not appear in this table, it still gets at minimum a scroll-triggered fade-in.

### → Mandatory Element Animation Map

Fill this table for EVERY element on the page. Every row must have at least one ✓. Any empty row = incomplete implementation.

| Element | Entry Animation | Scroll Reveal | Hover/Focus State | Ambient/Micro | Assigned |
|---|---|---|---|---|---|
| **Navigation bar** | Slide down + fade from top | - | Link underline slide, spring-scale menu items | - | ✓ |
| **Logo** | Fade in (first element, 0ms delay) | - | Subtle scale(1.05) on hover | - | ✓ |
| **Nav links** | Stagger fade-in left-to-right | - | Sliding underline + color shift | - | ✓ |
| **Hero heading** | Word-by-word masked reveal OR char split | - | - | - | ✓ |
| **Hero subtext** | Fade-up-deblur (stagger after heading) | - | - | - | ✓ |
| **Hero CTA button** | Scale-in + fade (last hero element) | - | Pressure depth (compress + inner shadow) + lift + ripple on click | Subtle glow pulse | ✓ |
| **Hero background** | Scale(1.05→1) + fade (Ken Burns settle) | Parallax slow | - | Gradient shift OR grain movement | ✓ |
| **Section headings** | - | Word-by-word masked reveal OR fade-up-deblur | - | - | ✓ |
| **Section subtext** | - | Fade-up (stagger 80ms after heading) | - | - | ✓ |
| **Body paragraphs** | - | Line-by-line reveal OR fade-up | - | - | ✓ |
| **Cards** | - | Stagger fade-up (80ms increment per card) | Lift(-4px) + shadow expand + border glow + 3D tilt | - | ✓ |
| **Card icons/images** | - | Scale-in (after card reveals) | Subtle rotate or color shift on card hover | - | ✓ |
| **Card titles** | - | Part of card reveal | Color shift on card hover | - | ✓ |
| **Card descriptions** | - | Part of card reveal | Opacity increase on card hover | - | ✓ |
| **Images** | - | Clip-path wipe reveal OR scale-in | Ken Burns zoom on hover | - | ✓ |
| **Buttons (all)** | - | Fade-up with parent | Pressure depth + lift + shadow + ripple click | - | ✓ |
| **Links (inline)** | - | Part of parent reveal | Sliding underline + color shift | - | ✓ |
| **Input fields** | - | Fade-up with parent | Border glow on focus + label float | - | ✓ |
| **Badges/pills** | - | Scale-in + fade | Background color shift on hover | Subtle bounce float | ✓ |
| **Dividers/lines** | - | Width expand from center (scaleX 0→1) | - | - | ✓ |
| **Testimonial quotes** | - | Fade-up-deblur + slide | - | - | ✓ |
| **Avatars** | - | Scale-in with border ring animation | Ring pulse on hover | - | ✓ |
| **Stats/numbers** | - | Counter animation (count up from 0) | - | - | ✓ |
| **Footer** | - | Fade-up (last section) | Link underline slides | - | ✓ |
| **Footer links** | - | Stagger reveal | Underline slide + color shift | - | ✓ |
| **Social icons** | - | Stagger scale-in | Lift + color shift to brand color | - | ✓ |
| **Background shapes** | - | - | - | Floating animation + parallax | ✓ |
| **Decorative elements** | - | Rotate-in or scale-in | - | Slow spin or float | ✓ |
| **Scroll indicator** | Fade-in after hero loads | - | - | Gentle bounce loop | ✓ |
| **Progress bars** | - | Width expand (scaleX 0→1) with easing | - | - | ✓ |
| **Tooltips** | - | - | Float up + fade from trigger | - | ✓ |
| **Accordions** | - | Fade-up with parent | Border/bg shift on hover | Smooth height expand | ✓ |
| **Tabs** | - | Fade-up with parent | Background shift | Sliding indicator + content crossfade | ✓ |
| **Modals** | - | - | - | Backdrop fade + content scale-in | ✓ |
| **Toast/notifications** | - | - | - | Slide-in from edge + auto-dismiss | ✓ |

⚠ **Drift Warning:** The #1 failure is animating the hero and first section, then leaving everything below the fold completely static. EVERY section must have scroll-triggered reveals. EVERY interactive element must have hover feedback. Walk the page top-to-bottom and verify coverage. If you scroll and find a section that just "sits there" without animating in, the implementation is broken.

### → Coverage Verification Sweep

After building all animations, perform this sweep. Open the page and scroll top to bottom at a natural reading pace. For EVERY element that enters the viewport:

1. **Does it animate into view?** If no → add a scroll reveal
2. **Can you hover it?** If yes → does it have hover feedback? If no → add hover state
3. **Is it interactive (clickable, focusable)?** If yes → does it have active/focus states? If no → add them
4. **Is it decorative?** If yes → does it have ambient motion (float, rotate, pulse)? If no → add it
5. **Is it a text element?** If yes → does it have at minimum a fade-up reveal? If no → add it

A page with 100% animation coverage feels alive. A page with 80% coverage has dead spots that the eye catches immediately.

---

## Phase 1: Motion Audit

Before writing any code, classify the motion requirements.

### → Classify the Motion Context

| Field | Your answer |
|---|---|
| **Page type** | Marketing landing page / Product app / Portfolio / E-commerce / Editorial / Dashboard |
| **Motion density** | Minimal (Apple-style restraint) / Moderate (Stripe-level) / Rich (Awwwards experimental) |
| **Primary motion purpose** | Guide attention / Communicate state / Create atmosphere / Reveal content / Delight |
| **Scroll behavior** | Standard scroll / Scroll-linked animations / Scroll-jacked sections / Sticky reveals |
| **Page transitions** | None (SPA with instant swap) / Crossfade / Slide / Morph / Custom sequence |
| **Framework** | Vanilla CSS/JS / Framer Motion (React) / GSAP / Motion One / CSS-only |

### → Lock the Motion Personality (MANDATORY)

This is the single most important decision in the entire pipeline. Every animation on the page must belong to the SAME personality. A page that mixes personalities feels like three different developers animated it.

Pick ONE:

| Personality | Character | Easing core | Duration range | Signature move | Reference |
|---|---|---|---|---|---|
| **Surgical** | Crisp, fast, zero overshoot. Every motion is functional, nothing decorative. Clean as a scalpel. | `--ease-out` + `--ease-snap` | 100-250ms | Instant feedback, razor-sharp stagger | Linear app, Raycast, Vercel dashboard |
| **Physical** | Spring-based, tactile, objects have weight. Motion has overshoot, settle, momentum. Feels like touching real things. | `--spring-snappy` + `--spring-smooth` | 300-600ms (spring settle) | Spring entries, momentum drag, press compression | Apple.com, iOS, Dynamic Island |
| **Cinematic** | Dramatic, slow-build, theatrical reveals. The page IS the show. Scroll-linked narratives. | `--ease-dramatic` + `--spring-smooth` | 500-900ms | Clip-path reveals, text splitting, scroll-pinned sequences | Stripe homepage, Awwwards experimental |

Once locked, the personality constrains EVERYTHING downstream: which curves to use, how fast, how much stagger, whether to use springs, whether to use ambient motion. **Do not mix personalities.** A surgical page with one bouncy spring element is broken. A cinematic page with a 100ms tooltip snap is broken. Consistency is what makes motion feel like "one mind designed this."

### → Identify Motion Layers

Walk through the page and tag every element that should move. Classify each into one of these layers:

| Motion Layer | What it covers | Priority |
|---|---|---|
| **Entry** | First-paint reveals, above-the-fold load animation | P0 - must have |
| **Scroll** | Elements revealing as user scrolls, parallax, sticky sequences | P0 - must have |
| **Hover/Focus** | Button lifts, card tilts, link underlines, pressure depth effects | P0 - must have |
| **State** | Page transitions, tab switches, modal open/close, accordion, menu | P1 - should have |
| **Ambient** | Floating elements, gradient shifts, particle systems, cursor glow | P2 - polish layer |
| **Kinetic** | Text splitting, character-by-character reveals, word rotators | P2 - polish layer |

### → Output the Motion Brief

State in 2-3 lines the motion strategy. **Must include the locked personality name.**

> *"Motion Brief: PHYSICAL personality. Staggered spring entries on all sections (--spring-snappy). Scroll-triggered reveals with 20% viewport threshold. Press compression on all interactive elements. Spring-smooth text reveals on section headings. No ambient particles (personality conflict). Easing core: spring-snappy for entries, spring-smooth for state changes, ease-snap for hover only."*

### ✓ Quality Gate: Audit

Before moving to Phase 2, confirm:
- Motion context is classified (page type, density, purpose)
- **Motion Personality is locked** (Surgical / Physical / Cinematic)
- Every moving element is tagged to a motion layer
- The Element Animation Map is filled for EVERY element on the page - no empty rows
- Motion Brief is written (includes personality name)
- Framework is selected

---

## Phase 2: Choreography

Motion is choreography. Every element has an entrance cue, a duration, an easing curve, and a relationship to the elements around it. This phase creates the timing sheet - the musical score of the page.

### → The Easing Palette

This is the single most important section in the entire skill. The easing palette defines the emotional language of every animation on the page. Using the wrong curve is like playing a wrong note in a symphony - even non-musicians can feel it.

The palette has THREE tiers, ordered by quality. Use the highest tier your browser support allows.

---

**TIER 1: Spring Physics via CSS `linear()` - THE GOLD STANDARD**

This is what Apple uses. This is what Material Design 3 Expressive uses. This is what separates $200k studio sites from templates. CSS `linear()` enables true spring physics with overshoot and settle - something `cubic-bezier()` fundamentally cannot achieve.

```css
/* BLUEPRINT: Spring-based easing palette via CSS linear()
   WHY: Real spring physics create motion that feels PHYSICAL.
   Objects in the real world don't follow cubic-bezier curves -
   they have mass, momentum, and elasticity. Springs overshoot
   their target and settle back, which reads as "alive" to the
   human eye. This is why every iOS animation feels tangible.

   These curves were generated from spring physics simulations
   with specific mass/stiffness/damping parameters. The linear()
   function plots the spring's position at discrete time steps,
   which the browser interpolates smoothly between. */

:root {
  /* 1. APPLE SNAPPY SPRING - Primary entrance/reveal easing
     Physics: mass=1, stiffness=400, damping=30
     Character: Explosive start, tiny overshoot (~2%), soft settle.
     This is the iOS sheet-present / notification-arrive curve.
     Use on: hero entries, scroll reveals, modal opens, everything
     that "arrives" on screen. This is your DEFAULT curve. */
  --spring-snappy: linear(
    0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 12.9%,
    0.938 16.7%, 1.017 19.4%, 1.067 22.5%, 1.089 26.0%,
    1.079 30.3%, 1.049 36.0%, 1.024 42.6%, 1.011 50.3%,
    1.004 59.2%, 1.001 69.3%, 1
  );
  --spring-snappy-duration: 0.55s;

  /* 2. APPLE SMOOTH SPRING - State changes, position shifts
     Physics: mass=1, stiffness=200, damping=24
     Character: Gentle acceleration, visible overshoot (~5%),
     two-phase settle. Feels like a precision instrument.
     This is the iOS page-transition / tab-switch curve.
     Use on: page transitions, tab switches, carousel slides,
     anything moving from position A to position B. */
  --spring-smooth: linear(
    0, 0.004, 0.016 2.3%, 0.063 4.7%, 0.141 7.2%,
    0.25 9.9%, 0.601 16.5%, 0.815 21.0%, 0.929 25.2%,
    0.987 29.0%, 1.025 33.5%, 1.042 38.0%, 1.04 43.5%,
    1.027 50.0%, 1.013 57.5%, 1.005 67.0%, 1.001 79.0%, 1
  );
  --spring-smooth-duration: 0.7s;

  /* 3. APPLE BOUNCY SPRING - Playful micro-interactions
     Physics: mass=1, stiffness=500, damping=18
     Character: Very fast, pronounced overshoot (~12%), visible
     bounce-settle. Feels playful, energetic, delightful.
     Use SPARINGLY on: toggles, like buttons, notification pops,
     small badges, emoji reactions. NEVER on large elements. */
  --spring-bouncy: linear(
    0, 0.014, 0.055 1.8%, 0.218 3.7%, 0.867 8.5%,
    1.085 10.7%, 1.212 12.9%, 1.264 15.0%, 1.262 17.0%,
    1.217 19.5%, 1.098 24.0%, 1.035 28.5%, 0.993 33.0%,
    0.981 38.0%, 0.988 45.0%, 0.998 55.0%, 1.001 68.0%, 1
  );
  --spring-bouncy-duration: 0.5s;

  /* 4. MATERIAL 3 EMPHASIZED - Google's expressive motion standard
     Source: Material Design 3 motion spec (legacy cubic-bezier fallback)
     Character: Very slow start, dramatic acceleration, gentle decelerate.
     This is the M3 "emphasized" transition for container transforms,
     shared element transitions, and FAB expansions.
     Use on: container morphs, expand/collapse, shared transitions. */
  --m3-emphasized: cubic-bezier(0.05, 0.7, 0.1, 1.0);
  --m3-emphasized-duration: 0.5s;

  /* 5. MATERIAL 3 EMPHASIZED as SPRING - for spring-capable contexts
     Physics: mass=1, stiffness=300, damping=22
     The spring equivalent of M3 Emphasized - with the overshoot
     that Google's spec now recommends via their spring system. */
  --m3-spring: linear(
    0, 0.007, 0.029 2.0%, 0.118 4.2%, 0.508 10.9%,
    0.797 15.4%, 0.951 19.2%, 1.029 22.2%, 1.074 25.6%,
    1.088 29.2%, 1.075 33.6%, 1.045 39.5%, 1.02 46.5%,
    1.007 55.0%, 1.001 66.0%, 1
  );
  --m3-spring-duration: 0.6s;
}
```

---

**TIER 2: Premium Cubic-Bezier Curves - STRONG FALLBACK**

For browsers that don't support `linear()`, or for secondary animations where spring overshoot would be inappropriate (ambient motion, background transitions, color shifts).

```css
:root {
  /* 6. SNAPPY DECEL - Tier 2 fallback for spring-snappy
     The best cubic-bezier approximation of the Apple snappy spring,
     minus the overshoot. Still far better than CSS keyword easings.
     Use when linear() is unavailable, or for secondary reveals. */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);

  /* 7. SMOOTH IN-OUT - for ambient position shifts
     Neither Material 3 nor Apple style - this is the Awwwards
     agency standard for smooth lateral movements, carousel
     auto-play, and background panning. */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* 8. ENERGETIC SNAP - for hover responses, interactive feedback
     Faster than --ease-out, designed for immediate tactile response.
     The curve front-loads 80% of the motion into the first 30% of
     the duration, creating a "snap" sensation. */
  --ease-snap: cubic-bezier(0.22, 1, 0.36, 1);

  /* 9. DRAMATIC IN-OUT - for hero reveals, cinematic entrances
     Extremely slow start ("winding up"), explosive middle,
     graceful deceleration. Use for the ONE theatrical moment
     per page - the hero heading reveal, a page transition wipe. */
  --ease-dramatic: cubic-bezier(0.77, 0, 0.175, 1);

  /* 10. CUBIC SPRING APPROXIMATION - bouncy without linear()
      The y2 value exceeds 1.0, causing overshoot. This is the
      closest cubic-bezier can get to a spring. Less natural than
      linear() springs but works everywhere. */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

**TIER 3: CSS Keyword Easings - BANNED**

`ease`, `ease-in`, `ease-out`, `ease-in-out`, `linear` - these CSS keywords are the typographic equivalent of Comic Sans. They have zero character, zero intentionality, zero soul. They exist because browsers needed a default, not because any designer chose them.

| CSS Keyword | Why it's banned | What to use instead |
|---|---|---|
| `ease` | Generic curve that matches nothing. The "I didn't think about this" easing. | `--spring-snappy` or `--ease-out` |
| `ease-in` | Slow start, fast end - objects accelerating into a wall. Almost never what you want. | `--ease-dramatic` (if you need a slow start) |
| `ease-out` | Better than `ease`, but still a bland, characterless deceleration. | `--spring-snappy` or `--ease-out` (the custom one) |
| `ease-in-out` | The "I want this to look smooth" default that looks like nothing. | `--spring-smooth` or `--ease-in-out` (the custom one) |
| `linear` | Objects don't move at constant speed in nature. Feels robotic and dead. | Only acceptable for `animation-timing-function` on infinite loops (marquees, spinners) |

⚠ **Drift Warning:** If you write `transition: all 0.3s ease` ANYWHERE in the codebase, the implementation has failed the quality bar. Every transition must use a named curve from the palette. No exceptions. No shortcuts. The easing palette is the DNA of the entire motion experience.

---

**→ The Three-Curve Maximum (CRITICAL)**

This is the constraint that creates cohesion. From the 10 curves above, each project picks exactly **THREE** - one primary, one secondary, one utility. Every animation on the page uses one of these three. No exceptions. Three curves from the same family sound like one voice; ten curves sound like a committee.

| Personality | Primary (entries, reveals) | Secondary (state changes, transitions) | Utility (hover, feedback, ambient) |
|---|---|---|---|
| **Surgical** | `--ease-out` | `--ease-in-out` | `--ease-snap` |
| **Physical** | `--spring-snappy` | `--spring-smooth` | `--ease-snap` |
| **Cinematic** | `--ease-dramatic` | `--spring-smooth` | `--ease-in-out` |

These are the recommended presets. You MAY substitute one curve if the project demands it (e.g., swap `--spring-bouncy` for `--spring-snappy` on a playful product) but you MUST NOT exceed three total. If you find yourself reaching for a fourth curve, one of your first three was chosen wrong.

**→ How to choose between Tier 1 and Tier 2:**

| Animation type | Use this tier | Why |
|---|---|---|
| **Hero entry, page load reveals** | Tier 1 (`--spring-snappy`) | First impression. Must feel physical and premium. |
| **Scroll reveals** | Tier 1 (`--spring-snappy`) | User sees dozens of these. Each one must feel alive. |
| **Button/card hover** | Tier 2 (`--ease-snap`) | Hover is fast and functional. Spring overshoot on hover feels jittery. |
| **Button click/active** | Tier 1 (`--spring-bouncy`) | Click feedback benefits from the satisfying "pop" of a spring bounce. |
| **Modal/dialog open** | Tier 1 (`--spring-smooth`) | Modals are spatial - they arrive from somewhere. Springs make this feel real. |
| **Tab switch/carousel** | Tier 1 (`--spring-smooth`) | Position changes need momentum and settle. |
| **Background color shift** | Tier 2 (`--ease-in-out`) | Color doesn't have mass. Springs on color feel wrong. |
| **Gradient animation** | Tier 2 (`--ease-in-out`) or `linear` | Ambient motion. No spring needed. |
| **Page transition** | Tier 1 (`--spring-smooth`) | Page navigation is a major spatial event. Must feel physical. |
| **Tooltip appear** | Tier 2 (`--ease-snap`) | Fast, functional, non-theatrical. |
| **Accordion expand** | Tier 1 (`--spring-snappy`) or Tier 1 (`--m3-spring`) | Height changes with spring settle feel premium. |
| **Floating/ambient** | CSS `linear` keyword | Continuous loops don't need easing - constant speed IS correct. |

---

**→ Framer Motion / Motion spring equivalents:**

```tsx
/* BLUEPRINT: Framer Motion spring presets matching the CSS palette
   WHY: When using Framer Motion (React), use these spring configs
   instead of the CSS linear() values. Framer Motion's spring()
   computes physics natively, giving even smoother results than
   the CSS approximation. These match the FEEL of the CSS palette. */

const springs = {
  // Matches --spring-snappy: fast, minimal overshoot
  snappy: { type: "spring", stiffness: 400, damping: 30, mass: 1 },

  // Matches --spring-smooth: gentle, visible settle
  smooth: { type: "spring", stiffness: 200, damping: 24, mass: 1 },

  // Matches --spring-bouncy: playful pop
  bouncy: { type: "spring", stiffness: 500, damping: 18, mass: 1 },

  // Matches --m3-spring: Material 3 emphasized
  emphasized: { type: "spring", stiffness: 300, damping: 22, mass: 1 },

  // For hover responses (no spring, just fast decel)
  snap: { type: "tween", duration: 0.35, ease: [0.22, 1, 0.36, 1] },
};

// Usage:
// <motion.div transition={springs.snappy} />
// <motion.div transition={springs.smooth} />
```

---

**→ GSAP spring equivalents:**

```javascript
/* BLUEPRINT: GSAP spring-like easing
   WHY: GSAP doesn't use spring physics natively, but its
   CustomEase plugin can replicate the feel. For standard use,
   these "power" easings are the closest GSAP equivalents. */

// snappy: "power3.out" or CustomEase
// smooth: "power2.inOut"
// bouncy: "back.out(1.7)"  - the 1.7 controls overshoot amount
// dramatic: "expo.inOut"
// snap: "power4.out"

// For true springs in GSAP, use the gsap-spring plugin:
// gsap.to(".element", { x: 100, ease: "spring({stiffness: 400, damping: 30})" });
```

### → The Timing Sheet

Map every animation in sequence. This is the score.

| Element | Trigger | Delay | Duration | Easing | Transform | Notes |
|---|---|---|---|---|---|---|
| Nav | Page load | 0ms | 600ms | --ease-out | opacity 0→1, y -20→0 | First element to appear |
| Hero eyebrow | Page load | 100ms | 700ms | --ease-out | opacity 0→1, y 20→0, blur 8→0 | Stagger start |
| Hero heading | Page load | 200ms | 800ms | --ease-out | opacity 0→1, y 30→0, blur 8→0 | Core focal point |
| Hero subtext | Page load | 320ms | 700ms | --ease-out | opacity 0→1, y 20→0 | After heading lands |
| Hero CTA | Page load | 440ms | 600ms | --ease-out | opacity 0→1, y 20→0, scale 0.95→1 | Last hero element |
| Section heading | Scroll (20% visible) | 0ms | 800ms | --ease-out | opacity 0→1, y 40→0 | Per section |
| Cards | Scroll (15% visible) | 0/80/160ms | 700ms | --ease-out | opacity 0→1, y 30→0 | Stagger per card |
| CTA buttons | Hover | 0ms | 500ms | --ease-snap | y 0→-2px, shadow increase | Immediate response |
| Cards | Hover | 0ms | 400ms | --ease-snap | y 0→-4px, shadow increase | Lift effect |

**Timing Rules:**

| Rule | Value | Why |
|---|---|---|
| Maximum total entry sequence | 800ms | Beyond 800ms, the page feels slow to load |
| Stagger increment | 80-150ms | Below 80ms feels simultaneous. Above 150ms feels sluggish |
| Hover response | ≤ 150ms perceived start | The user must feel instant feedback |
| Scroll reveal duration | 600-900ms | Long enough to notice, short enough to not obstruct |
| Page transition | 300-500ms | Fast enough to not break flow, slow enough to register |
| Micro-interaction (toggle, checkbox) | 200-350ms | Functional feedback, not theatrical |

⚠ **Drift Warning:** The #1 AI animation failure is making everything too slow. A 1.5-second fade-in on every section makes the page feel like it's loading, not revealing. Keep scroll reveals under 900ms. Keep hover responses under 500ms. Keep total page entry under 800ms.

### → Stagger Choreography

Stagger is not "delay each item by 100ms." Stagger follows visual hierarchy.

**Correct stagger order (top to bottom = first to last):**
```
1. Container/background (instant or 0ms)
2. Primary content (heading, hero image) - 100ms
3. Supporting content (subtext, description) - 220ms  
4. Interactive elements (CTAs, buttons) - 340ms
5. Decorative elements (badges, accents) - 440ms
```

**Stagger within grids (cards, features):**
```
For a 3-column grid, stagger left-to-right:
  Card 1: 0ms
  Card 2: 80ms
  Card 3: 160ms

For a 2x3 grid, stagger top-left to bottom-right:
  Row 1: 0ms, 80ms, 160ms
  Row 2: 120ms, 200ms, 280ms
```

⚠ **Drift Warning:** Never stagger more than 6-8 items. If you have 12 cards, stagger the first 4-6, then bring the rest in together. A 12-item stagger takes 1.2+ seconds and the user loses patience watching items appear one by one.

### ✓ Quality Gate: Choreography

Before moving to Phase 3, confirm:
- Easing palette is defined (not using CSS keyword easings)
- Timing sheet covers every moving element
- No animation exceeds 900ms duration
- Total page entry sequence is under 800ms
- Stagger increments are 80-150ms
- Stagger follows visual hierarchy, not DOM order
- No more than 6-8 items are individually staggered

---

## Phase 3: Build the Motion (Framework-Agnostic Rules)

Implement layer by layer. Each layer builds on the previous one. Do not skip layers. **Never output massive boilerplate code blocks.** Instead, apply the following constraints when generating the actual code:

### Physical Correctness Rules

These apply to EVERY animation regardless of layer. Violations are automatic quality gate failures.

| Rule | Specification | Why |
|---|---|---|
| **Never `scale(0)`** | Start from `scale(0.9)` minimum, paired with `opacity: 0`. Range: `0.9-0.97` for UI, `0.95-0.97` for subtle entries. | Nothing in the physical world appears from absolute nothingness. `scale(0)` reads as a rendering glitch, not an entrance. |
| **Origin-aware transforms** | Popovers, tooltips, and dropdowns set `transform-origin` to the trigger element's position. **Modals are exempt** - modals stay `transform-origin: center` because they are viewport-anchored, not trigger-anchored. | Elements that grow from their source point create a spatial story. Elements that grow from their own center feel disconnected from the action that summoned them. |
| **Universal press feedback** | Every pressable element: `:active { transform: scale(0.97); transition: transform 160ms var(--ease-snap) }`. Subtle range: `0.95-0.98`. | A button that visually compresses on press confirms the interface registered the action. Missing press feedback makes the UI feel unresponsive regardless of actual latency. |
| **Ban `transition: all`** | Always specify exact properties: `transition: transform 200ms var(--ease-out), opacity 200ms var(--ease-out)`. | `transition: all` animates every property that changes - including `background-color`, `box-shadow`, `border` - causing off-GPU paint operations and visual artifacts. |
| **Asymmetric timing** | Deliberate user actions (press, hold, destructive confirm) = slow. System response (release, dismiss, confirm) = fast. Example: hold-to-delete overlay fills over `2s linear` on press, snaps back in `200ms var(--ease-out)` on release. | Slow where the user is deciding gives them control. Fast where the system responds gives them confidence. Symmetric timing feels mechanical. |

---

### Layer 1: Entry Animations (Page Load)
Every above-the-fold element needs a choreographed entrance.
- **Constraint:** Use staggered entry animations based on visual hierarchy (Containers → Headings → Subtext → CTAs → Decorators).
- **CSS:** Use `@keyframes` with `transform: translateY(24px)` and `filter: blur(6px)` to `0`, applying `--ease-out`. Stagger via `animation-delay`.
- **Framer Motion:** Use `staggerChildren: 0.12`. Children should fade-up and deblur.
- **GSAP:** Use `gsap.timeline()` with `.from()` tweens. Set `ease: "power3.out"`. Overlap tweens with `-=0.5`.

### Layer 2: Scroll-Triggered Reveals
Elements below the fold reveal as the user scrolls them into view.
- **Constraint:** Do not use scroll-jacking (preventing default scroll). Use scroll-linked (scrub) or threshold-triggered reveals.
- **Vanilla JS:** Use `IntersectionObserver` with a threshold of `0.15` and `rootMargin: "-50px"`. Unobserve after first trigger to prevent janky re-animation. Add an `is-visible` class that triggers CSS transitions.
- **GSAP:** Use `ScrollTrigger`. For sticky narrative sections, use `pin: true` and `scrub: 1` to link animation progress directly to scroll position.

### Layer 3: Interruptibility Rules

Animations that can be re-triggered before completing (toasts stacking, toggles, accordion spam, rapid hovers) MUST handle interruption gracefully. An animation that restarts from zero on re-trigger creates visual stutter.

| Mechanism | Behavior on interrupt | Use when |
|---|---|---|
| **CSS transitions** | Retargets from current value - smooth mid-flight reversal | Hovers, toggles, accordion expand/collapse, any rapidly-triggered state change |
| **CSS `@keyframes`** | Restarts from frame 0 - causes jump | One-shot reveals that fire once (scroll reveals with `unobserve`), ambient loops |
| **CSS `@starting-style`** | Defines entry state without JS - browser transitions from starting values on first render | Element entry animations without `useEffect` hacks. Modern replacement for `data-mounted` patterns |
| **WAAPI (`element.animate()`)** | JS control with CSS-thread performance. Hardware-accelerated, interruptible, zero library overhead | Programmatic sequences where you need JS timing control but CSS performance |
| **Springs (Framer Motion / GSAP)** | Carries velocity through interruption - the gold standard | Gesture-driven motion, drag interactions, anything a user can grab mid-flight |

**The 500ms rule:** If a user can trigger the same animation twice within 500ms (rapid clicking, hover flicking, toast spam), it MUST use CSS transitions or springs. Keyframes will stutter.

### Layer 8: State Transitions
Smooth transitions between UI states (modals, accordions, tabs).
- **Modals:** Use the native `<dialog>` element. Fade the `::backdrop` and scale/translate the dialog itself to create a 2-layer lifting effect. Modal scales from `scale(0.95)` + `opacity: 0`, never `scale(0)`. `transform-origin: center` (modals are viewport-anchored).
- **Accordions:** Use CSS Grid `grid-template-rows: 0fr` to `1fr` for smooth height animations without JS calculations.
- **Tabs:** Do not just crossfade active states. Use a sliding indicator (absolute positioned line) that `transform: translateX` to the active tab's coordinates for a physical connection.
- **Crossfade polish:** When two states visibly overlap during a crossfade (old content and new content both partially visible), add `filter: blur(2px)` during the mid-transition to blend them into one perceived transformation. Keep blur under `16px` - heavy blur is GPU-expensive, especially in Safari.

### Layer 8.5: Gesture & Drag Physics
For any draggable, swipeable, or dismissable surface (drawers, sheets, toasts, cards, carousels):

| Principle | Implementation |
|---|---|
| **Velocity-based dismissal** | Do not require dragging past a fixed distance threshold. Compute velocity: `Math.abs(dragDistance) / elapsedMs`. If `> 0.11`, dismiss regardless of distance. A quick flick is enough. |
| **Momentum projection** | On release, project the resting position using exponential decay: `projectedEnd = current + (velocity / 1000) * decayRate / (1 - decayRate)` where `decayRate ≈ 0.998`. Snap to the nearest target from the projected point, not the release point. |
| **Rubber-banding at boundaries** | When dragging past a natural edge (e.g., pulling a drawer above its max height), apply progressive resistance: `rubberband(overshoot, dimension, 0.55) = (overshoot * dimension * 0.55) / (dimension + 0.55 * abs(overshoot))`. Never hard-stop - the element should slow continuously like a physical object. |
| **Pointer capture** | Call `element.setPointerCapture(e.pointerId)` on drag start. This ensures tracking continues even when the pointer leaves the element's bounds. |
| **Multi-touch protection** | Once a drag begins, ignore additional touch points: `if (isDragging) return`. Switching fingers mid-drag without this causes the element to jump to the new position. |
| **Velocity handoff** | When the gesture ends and the spring animation begins, pass the finger's release velocity as the spring's initial velocity. There must be zero visual seam between the drag phase and the settle animation. |

### Layer 9: Loading and Preloader Sequences
- **Constraint:** Keep preloaders minimal. A simple expanding line (scaleX) with a numeric counter is more premium than a spinning circle.
- **Timing:** Never enforce artificial minimum load times over 2.5s. When resources (`document.fonts.ready`, images) are loaded, wipe the preloader away (e.g., via `clip-path`) and immediately trigger the Layer 1 Hero Entry.

### Layer 10: Signature Micro-Animations
Select exactly **1 to 3** of these per page. Restraint is what makes them signature - if everything is special, nothing is. Apply them only to the ONE element that deserves maximum attention (the hero heading, OR the primary CTA, OR the featured visual - not all three). The rest of the page uses the standard reveal vocabulary. This contrast is what makes the signature moment land.
1. **Text Scramble / Decode:** For hero headings or numbers. Cycle through random characters (`!<>-_\\/[]{}-=+*^?#_`) before locking into the real text.
2. **Border Draw:** Instead of fading a border, use pseudo-elements scaling from `0` to `1` on `scaleX`/`scaleY` with staggered delays to look like a pen tracing the edge.
3. **Ripple Click:** On primary buttons, spawn a radial-gradient circle exactly at `e.clientX / e.clientY` (cursor position) and scale it up to `4x` while fading opacity to `0`.
4. **Shimmer Loading:** For async data. Use a linear-gradient angled at `-20deg` moving from `200%` to `-200%` `background-position`.
5. **Morphing Blob Background:** For hero depth. Use an absolute positioned element with an 8-value `border-radius` (e.g., `60% 40% 30% 70% / 60% 30% 70% 40%`) animated over ~8 seconds.
6. **Tilt Parallax Cards:** On hover, track mouse position and apply slight `translate(x,y)` shifts to internal layers based on a `data-depth` multiplier to create a 3D diorama effect.
7. **Tooltip Float-Up:** Add a 100ms hover delay before floating tooltips up from below. Prevents accidental flashes when cursor passes by. **Skip-delay rule:** Once any tooltip in a group is already open, subsequent tooltips in the same toolbar/group open instantly with zero delay and zero animation. This makes the entire toolbar feel fast.
8. **Magnetic Cursor Elements:** Interactive elements that subtly pull toward the cursor when it enters their proximity zone (~40px). Use spring interpolation on the offset - direct mouse tracking feels robotic, spring-interpolated tracking feels alive.
8. **Gradient Border:** Use a `conic-gradient` with `@property --gradient-angle` animated linearly over 3 seconds to create a living, spinning edge.
9. **Cursor Trail:** If requested, use a small dot tracking exactly to the cursor, and a larger hollow circle that follows with a slight lerp (delay) for an elastic feel. Hide on touch devices.
10. **Clip-Path Reveals:** For major section transitions, reveal the next section by expanding a circle `clip-path: circle(0% at 50% 50%)` to `150%`.


## Phase 4: Motion Diff

Compare your animations against the Motion Brief and Timing Sheet. Walk through every category. Any FAIL blocks delivery.

### ⚡ Coverage Check (MANDATORY - Run First)

| Check | PASS/FAIL |
|---|---|
| **Every heading** on the page has a scroll reveal or entry animation | |
| **Every paragraph/body text** has at minimum a fade-up reveal | |
| **Every card** has a scroll reveal AND a hover state (lift + shadow) | |
| **Every button** has hover (lift/wipe/color) + active (press) + focus-visible states | |
| **Every link** has a hover underline animation or color shift | |
| **Every image** has a reveal animation (clip-path, scale-in, or fade) | |
| **Every input** has a focus state (glow, border shift, or label animation) | |
| **Every section** has scroll-triggered entry (no section just "sits there") | |
| **Every decorative element** has ambient motion (float, rotate, pulse) | |
| **Every divider/line** animates in (scaleX expansion or fade) | |
| **Every icon** has hover feedback (color, scale, or rotation shift) | |
| **Stats/numbers** count up from 0 when scrolled into view | |
| **Nav bar** has an entry animation on page load | |
| **Footer** has scroll-triggered stagger reveal on its contents | |
| Scroll the entire page top-to-bottom: ZERO static elements found | |

⚠ **If any row is FAIL, go back and add the missing animation before proceeding.** This is not optional. A page with 90% animation coverage has dead spots that destroy the premium feel.

### Feel Check

| Check | PASS/FAIL |
|---|---|
| Page entry completes in under 800ms total | |
| No element "pops" into existence without any animation | |
| Stagger follows visual hierarchy (heading before subtext before CTA) | |
| Scroll reveals trigger at a natural point (~15-20% element visibility) | |
| Hover feedback is immediate (perceived start ≤ 150ms) | |
| No animation feels "slow" or makes the user wait | |
| No animation draws attention to ITSELF rather than to the content | |
| **Cohesion test:** mute the page to just motion (blur your eyes). Do ALL animations feel like they belong to the same family? Same speed range, same intensity, same personality? | |
| **The compound test:** does the page feel "premium" without any single animation being showy? The goal is 20 invisible correct choices, not 1 theatrical one | |

### Easing Check

| Check | PASS/FAIL |
|---|---|
| No CSS keyword easings (ease, ease-in, ease-out) on visible animations | |
| All entry animations use --ease-out (snappy decel) | |
| All hover interactions use --ease-snap (energetic out) | |
| All state transitions use --ease-in-out (smooth) | |
| Easing palette is consistent across the entire page | |

### Performance Check

| Check | PASS/FAIL |
|---|---|
| All animations use ONLY `transform` and `opacity` (except clip-path reveals and filter:blur entries) | |
| No animations on `top`, `left`, `width`, `height`, `margin`, `padding` | |
| No `transition: all` anywhere - every transition specifies exact properties | |
| `will-change` is applied only to elements that are actively animating | |
| `will-change` is removed after animation completes (for one-shot animations) | |
| No `backdrop-filter` on scrolling elements (only fixed/sticky) | |
| Scroll listeners use `{ passive: true }` | |
| Page maintains 60fps during all animations (check DevTools → Performance) | |
| No layout thrashing (reading layout → writing layout in a loop) | |
| Framer Motion: no `x`/`y`/`scale` shorthand props on heavy pages - use `animate={{ transform: "translateX(100px)" }}` for GPU acceleration | |
| No CSS variable on a parent driving child transforms (e.g., `--swipe-amount`) - set `transform` directly on the element to avoid style recalculation storms | |

### Accessibility Check

| Check | PASS/FAIL |
|---|---|
| All motion respects `prefers-reduced-motion: reduce` | |
| Reduced motion fallback is opacity-only fade (no transforms, no parallax, no spring overshoot) | |
| Hover animations gated behind `@media (hover: hover) and (pointer: fine)` - touch devices fire hover on tap, causing false activation | |
| Split text has `aria-label` preserving the original text | |
| No essential information is conveyed ONLY through animation | |
| Focus states are visible and not obscured by animations | |
| Auto-playing animations (marquee, floats, gradients) can be paused (WCAG 2.2.2) | |
| Custom cursor does not appear on touch devices | |

### Technical Check

| Check | PASS/FAIL |
|---|---|
| Scroll reveal uses IntersectionObserver, not scroll event listener | |
| Scroll-linked animations use `scrub` (not triggered by scroll events) | |
| Touch devices have `smoothTouch: false` if using Lenis | |
| No scroll-jacking (overriding native scroll behavior) without clear justification | |
| Parallax is disabled on mobile (too janky on underpowered devices) | |
| Custom cursor is disabled on mobile/touch | |
| Preloader shows content within 3 seconds maximum | |
| No FOUC (flash of unstyled content) before animations initialize | |

### Composition Check

| Check | PASS/FAIL |
|---|---|
| Maximum 2-3 complex animations running simultaneously on screen | |
| No competing motion (two elements fighting for attention at the same time) | |
| Ambient motion (floats, gradients) does not compete with interactive motion | |
| Animation density matches the Motion Brief (minimal/moderate/rich) | |
| **Personality lock held:** every animation on the page belongs to the locked personality (Surgical/Physical/Cinematic). Zero personality drift. | |
| **Three-curve maximum held:** only 3 easing curves are used across the entire page. Grep the CSS - if you find a 4th curve, the palette leaked. | |
| **Intensity consistency:** scroll reveals all use the SAME transform distance (e.g., all `translateY(24px)`, not a mix of 20/30/40/60). Hover lifts all use the SAME offset (e.g., all `-4px`, not a mix). Stagger delays all use the SAME increment. | |
| Signature micro-animations are on at most 1-3 focal elements, not scattered everywhere | |

---

## The Anti-Patterns

These are the specific failures that turn premium motion into amateur animation. Check for all of them.

### ❌ The Franken-Motion
Different sections use different easing families - springs here, dramatic curves there, linear snaps elsewhere. Each animation is fine in isolation but the page feels like a patchwork quilt. **Fix:** Lock a personality in Phase 1 and enforce the Three-Curve Maximum. Every animation must belong to the same easing family. If the hero uses `--spring-snappy`, the scroll reveals use `--spring-snappy`. If the cards hover with `--ease-snap`, ALL interactive elements hover with `--ease-snap`. Cohesion is the #1 predictor of whether a page feels "premium" or "messy."

### ❌ The Slow Reveal
Everything fades in over 1.5 seconds. The page feels like it's buffering. **Fix:** Keep reveals under 800ms. The user came for content, not a curtain call.

### ❌ The Scroll Carnival
Every element has a different animation: this one slides left, that one bounces, this one rotates in. **Fix:** Use ONE reveal animation (fade-up-deblur) for all scroll reveals. Consistency reads as intentional.

### ❌ The Hover Disco
Buttons scale to 1.1x, cards rotate, links flash different colors. **Fix:** Hover effects should be subtle: 2px lift + shadow expansion for cards, background-color shift for buttons. The user shouldn't be startled.

### ❌ The Parallax Soup
Five layers of parallax on every section. Foreground, midground, background, all moving at different speeds. **Fix:** Maximum 2 parallax layers per viewport. One subtle background shift, one element float. More is motion sickness.

### ❌ The Text Disassembly
Every heading character-splits and reassembles from random positions. **Fix:** Character-split maximum ONE heading per page. Use word-reveal on section headings. Use simple fade-up on everything else.

### ❌ The Infinite Preloader
A 5-second preloader with elaborate animations before the content appears. **Fix:** Preloader maximum 2.5 seconds. If content loads faster, end sooner. Never add artificial delay.

### ❌ The Missing Reduced Motion
No `prefers-reduced-motion` media query anywhere. **Fix:** Every single animation must gate behind `prefers-reduced-motion: reduce` with an opacity-only fallback.

### ❌ The Layout Animator
Animating `width`, `height`, `top`, `left`, `padding`, `margin`, or `border-radius`. **Fix:** Only animate `transform` and `opacity`. Use `transform: scale()` instead of `width`/`height`. Use `transform: translate()` instead of `top`/`left`.

---

## Framework Decision Matrix

| If the project uses... | Use this motion stack |
|---|---|
| **Vanilla HTML/CSS/JS** | CSS keyframes + transitions + IntersectionObserver. Add GSAP only for scroll-pinning or complex timelines |
| **React (no framework)** | Framer Motion (`motion/react`). It handles AnimatePresence, layout animations, and gesture detection |
| **Next.js** | Framer Motion + View Transitions API for page transitions |
| **Vue** | `<Transition>` / `<TransitionGroup>` components + GSAP for scroll |
| **Astro** | View Transitions API (built-in) + CSS animations + GSAP for scroll |
| **Svelte** | Built-in `transition:` and `animate:` directives + GSAP for scroll |

**When to reach for GSAP:**
- Scroll-pinned (sticky) sequences where content changes as you scroll
- Horizontal scroll sections
- Complex timelines with overlapping animations
- Text splitting with SplitText plugin (premium, but best-in-class)

**When CSS is enough:**
- Entry animations (keyframes + animation-delay)
- Hover states (transitions)
- Simple scroll reveals (IntersectionObserver + CSS transitions)
- Floating/ambient motion (keyframes + infinite)
- Accordion/tab state changes (transitions)

---

## The Apple-Level Motion Standards

These are the non-negotiable standards that separate Apple/Awwwards motion from everything else. They apply regardless of framework. Memorize them.

> **Spring physics are mandatory.** Use CSS `linear()` spring curves or Framer Motion springs for EVERY primary animation (entries, reveals, modals, transitions). Cubic-bezier is acceptable only for secondary motion (hovers, color shifts, ambient). If the page feels "digital" instead of "physical," the easing is wrong.

> **Material 3 Expressive is the baseline.** Google's M3 Expressive easing - `cubic-bezier(0.05, 0.7, 0.1, 1.0)` - is the MINIMUM quality for any transition. If your easing is less intentional than this, replace it.

> **Every curve is a conscious choice.** The same 400ms animation with `ease`, `cubic-bezier(0.16, 1, 0.3, 1)`, and a spring `linear()` produces three completely different emotional responses: generic, professional, and alive. You must be able to justify WHY you chose each curve.

> **Stagger creates narrative.** Elements appearing simultaneously is a data dump. Elements appearing in sequence is a story. The stagger order IS your visual hierarchy. Apple staggers with 80-120ms precision.

> **Motion is restraint with intensity.** The most awarded sites have fewer animations, not more - but each one is more sophisticated. A single spring-physics text reveal with word masking is worth more than 20 generic fade-ins. Quality over quantity, always.

> **Performance is non-negotiable.** A 45fps animation is worse than no animation. Only animate `transform`, `opacity`, and `filter`. Test on a throttled CPU. If it's not 60fps, simplify until it is. Use `will-change` surgically.

> **Reduced motion is not optional.** Every animation gates behind `prefers-reduced-motion`. The reduced version uses opacity-only fades at shorter durations. No transforms, no parallax, no spring overshoot, no scroll-linked sequences.

> **The acid test.** Take a screenshot of your page. Put it next to apple.com, linear.app, vercel.com, or stripe.com. If your motion design looks like it belongs on a different planet, start over. If it looks like it could be a page on one of those sites, you've passed.
