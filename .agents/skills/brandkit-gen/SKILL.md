---
name: brandkit-gen
description: Premium brand-kit image generation skill for producing identity-studio-grade brand boards. Fires when the user asks for brand kits, logo concepts, identity systems, brand-system presentations, or brand-guidelines decks. Enforces an 8-phase pipeline - Visual Reference Acquisition (Phase 0), Brand Strategy, Identity Architecture, Panel Composition, Prompt Engineering, Visual Diff, Panel Surgery (Phase 6), Logo Originality Gate (Phase 7) - with quality gates at every phase. Phase 0 asks for a visual reference image and auto-generates a REFERENCE INSTRUCTION block that extracts texture, layout, and color DNA while blocking name/logo/palette cloning. Phase 6 enables single-panel regeneration and Figma compositing when individual panels fail. Phase 7 forces a geometry-difference audit between the generated mark and the reference image's symbol. 14 visual modes (including 4 reference-calibrated modes trained against Polished Snow, Nexus, Lumora, Thesis, and NORI studio work), 6 board layouts (including Mega System for 18-21 panels), logo hard constraints (3-primitive cap, favicon gate, one-sentence geometry rule), 25-point pre-flight checklist, detailed mockup specs (website hero, social media profile, app icon dock, physical products), and aggressive anti-slop protocol. Image generation only. Does not write code.
---

# Brand-Kit Image Generation

> This skill fires when the user asks to generate brand-kit images, logo concept boards, identity system overviews, brand-guidelines decks, brand-system presentations, or any composed image showing a brand system across multiple panels. You are a senior identity designer presenting to a client. Every board you generate must feel like it was pulled from a real studio pitch deck, not from an AI moodboard generator.

---

# THE HARD OUTPUT RULE - READ FIRST

**Generate ONE composed brand-kit board per request. Always.**

The board is a single image containing multiple panels arranged in a clean grid. Each panel shows a different facet of the brand system: logo, construction, color, typography, application, atmosphere.

- One brand requested → 1 board image
- Multiple concepts → 1 board per concept (announce each)
- Refinement pass → 1 updated board

Default format: landscape, 4:3 or 16:10 aspect ratio. Override only if the user specifies otherwise.

This is not a collection of separate images. It is one composed presentation board. The grid, gutters, and panel relationships ARE the design.

---

# THE CORE DOCTRINE

Before entering the pipeline, internalize these. They override every aesthetic preference. The quality bar is **real identity studio pitch decks: Pentagram case studies, Collins brand systems, Wolff Olins identity reveals, Base Design presentations.** If your generated board would look like a Canva template next to these, it is not good enough.

> **A brand board is a visual argument.** It is not decoration. It is not a moodboard. It is a structured case for why this brand exists, what it stands for, and how it scales. Every panel must contribute evidence to that argument.

> **The logo is the thesis statement.** It carries the brand's core metaphor in reduced form. A logo that does not connect to the brand idea is a clip-art icon with a name next to it. The logo must be simple enough to work at 16px and meaningful enough to reward inspection at 1600px.

> **Restraint is the premium signal.** Generic AI brand output is loud, busy, and scattered. Premium identity work is quiet, sparse, and intentional. When in doubt, remove an element. The board should feel like it has too much space, not too little.

> **One idea per board.** The board presents ONE brand direction. Not three options. Not a comparison. One committed identity system explored across multiple applications. If the user wants alternatives, generate separate boards announced sequentially.

> **Consistency IS the system.** The logo mark must appear identically across every panel where it shows. The palette must thread through every panel. The type hierarchy must be the same in the tagline panel and the UI mockup panel. If any panel feels like it belongs to a different brand, the system is broken.

---

# THE PIPELINE

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   BRIEF IN ──→ Phase 0: Visual Reference Acquisition                 │
│                  (ask for inspiration image, generate                │
│                   REFERENCE INSTRUCTION block, extract               │
│                   texture/layout/color DNA, block cloning)           │
│                                                                      │
│              ──→ Phase 1: Brand Strategy                              │
│                  (extract signals, infer meaning,                    │
│                   commit to the brand's core idea)                   │
│                                                                      │
│              ──→ Phase 2: Identity Architecture                      │
│                   (commit to combinatorial picks:                    │
│                    visual mode, board layout, logo method,           │
│                    symbol logic, palette, type, canvas)              │
│                                                                      │
│              ──→ Phase 3: Panel Composition                          │
│                   (assign role + anchor + energy to each panel,      │
│                    enforce rhythm and variety)                       │
│                                                                      │
│              ──→ Phase 4: Prompt Engineering                         │
│                   (build structured prompt from blueprint,           │
│                    include anti-pattern bans,                        │
│                    prepend REFERENCE INSTRUCTION if Phase 0 active)  │
│                                                                      │
│              ──→ Phase 5: Visual Diff                                │
│                   (audit against strategy, check for                 │
│                    AI default drift, verify identity coherence)      │
│                                                                      │
│              ──→ Phase 6: Panel Surgery                              │
│                   (identify weak panels, regenerate individually,    │
│                    guide Figma compositing for manual replacement)   │
│                                                                      │
│              ──→ Phase 7: Logo Originality Gate                      │
│                   (geometry-difference audit between generated       │
│                    mark and reference symbol, force divergence)      │
│                                                                      │
│   Each phase has a ✓ Quality Gate. Failing a gate blocks the next.  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Visual Reference Acquisition

The single biggest quality lever in brand-kit generation is a **visual reference image.** Text-only prompts consistently produce generic output. A high-quality reference image from a real studio (Pentagram, Collins, Base Design, or Behance case studies) anchors the AI model to a specific quality bar and aesthetic DNA.

### → Step 1: Ask for a Reference Image

If the user has NOT provided a reference image, ask:

> *"Do you have a brand board, moodboard, or visual identity you admire? Attach it as an image - I'll extract its visual DNA (texture, layout rhythm, color logic, typography contrast) and build your board at the same quality bar without copying the source."*

If the user skips or declines, proceed to Phase 1 without a reference. The rest of the pipeline works without it - Phase 0 is an accelerator, not a requirement.

### → Step 2: Analyze the Reference Image

When the user provides a reference, analyze it for these DNA strands:

| DNA Strand | What to extract |
|---|---|
| **Surface Treatment** | What is the background material? Risograph grain, airbrush diffusion, clean paper, dark matte, gradient mesh, halftone dot pattern, film grain |
| **Layout Formula** | How are panels arranged? Floating cards on canvas, edge-to-edge tiles, mixed full-bleed + framed, asymmetric bento |
| **Card/Panel Structure** | Are panels flat rectangles, floating rounded cards with margins, outlined frames, or overlapping layers? What is the relationship between card and canvas? |
| **Color Architecture** | What is the dominant/accent split? How many hues? Is it monochromatic + one accent, duotone, triadic, analogous? What specific hex range? |
| **Typography Contrast** | What is the type scale? Editorial serif + grotesque sans? Monospace + display? What is the ratio of heading to label? |
| **Illustration Style** | Isometric 3D, flat vector, photographic, duotone, stencil/halftone, architectural wireframe, retro-modern |
| **Logo Presentation** | Is the mark shown as solid white, gradient-filled, stenciled/dotted, outlined, embossed, 3D rendered? |
| **Unique Signature Moves** | What makes THIS reference special? (e.g., Lockbox's floating charcoal cards on pastel paper, Lumora's chromatic airbrush diffusion, Thesis's soft gradient blobs) |

### → Step 3: Generate the REFERENCE INSTRUCTION Block

Build a `REFERENCE INSTRUCTION` block that goes at the **top of the final prompt** (Phase 4). This block has two halves:

**Half 1: EXTRACT (what to replicate):**
Describe the surface treatment, layout formula, card structure, color architecture, typography contrast, and illustration style using precise, visual language. Reference specific hex values, texture names, and spatial relationships.

**Half 2: BLOCK (what NOT to copy):**
Explicitly ban cloning the reference's logo mark, brand name, tagline, specific illustrations/icons, and exact color palette. Force the AI to apply the reference's QUALITY STANDARD to a completely new identity.

### → REFERENCE INSTRUCTION Template

```
REFERENCE INSTRUCTION - [REFERENCE NAME] AESTHETIC REPRODUCTION:
You must replicate the EXACT [surface treatment] and [layout formula] of the attached moodboard image:

1. [DNA STRAND 1 - e.g., SURFACE TREATMENT]: [precise description with hex values and texture names]
2. [DNA STRAND 2 - e.g., CARD STRUCTURE]: [precise description of card-to-canvas relationship]
3. [DNA STRAND 3 - e.g., ILLUSTRATION STYLE]: [precise description]
4. [DNA STRAND 4 - e.g., COLOR SYSTEM LAYOUT]: [precise description of how colors are presented]
5. [DNA STRAND 5 - e.g., UNIQUE SIGNATURE MOVE]: [what makes the reference special]

DO NOT copy the "[reference brand name]" name, DO NOT copy [describe reference logo geometry], DO NOT copy [reference-specific illustrations/icons], and DO NOT use [reference's exact palette] - apply [your chosen palette] instead.
```

### → Quality Signal: Image Resolution

If the user provides a low-resolution reference (under 512px), warn them:

> *"Your reference image is low-res - the AI can still extract the aesthetic direction, but higher resolution (1024px+) will give sharper typography, cleaner textures, and more faithful reproduction of fine details like grain and color gradients."*

Proceed regardless. Low-res references still dramatically outperform no reference at all.

### ✓ Quality Gate: Reference Acquisition

Before moving to Phase 1, confirm:
- Reference image has been analyzed (or user declined to provide one)
- All 8 DNA strands are extracted (if reference provided)
- REFERENCE INSTRUCTION block is written with both EXTRACT and BLOCK halves
- The BLOCK half explicitly bans the reference's logo, name, and palette
- The REFERENCE INSTRUCTION block is ready to prepend to the Phase 4 prompt

---

## Phase 1: Brand Strategy

Before generating anything, extract the brand's meaning. Do not skip this. The entire visual system flows from the strategy. A board built without strategy is just arranged rectangles.

### → Extract these signals

| Signal | What to look for |
|---|---|
| **Category** | Developer tool / AI product / Security / Fintech / Consumer app / Gaming / Voice AI / Compliance / Drone-robotics / Luxury / Editorial / Productivity / Health / Education / Creative tool / Enterprise SaaS |
| **Audience** | Who uses this product and what do they care about? Engineers, executives, consumers, creators, operators |
| **Product function** | What does the product actually do? Build, protect, convert, speak, automate, monitor, create, organize |
| **Emotional promise** | What feeling does the brand deliver? Confidence, precision, freedom, safety, delight, control, clarity |
| **Cultural position** | Where does the brand sit? Premium-serious, playful-accessible, technical-expert, warm-human, bold-creative |
| **Trust level** | How much trust must the brand project? High (security, finance, health) / Medium (SaaS, productivity) / Low-barrier (consumer, gaming) |
| **Visual world** | What does this brand's universe look like? Dark terminals, warm paper, clean glass, industrial metal, organic nature |
| **Core metaphor** | The single abstract idea the brand embodies. Building, shielding, navigating, illuminating, orchestrating |
| **What to avoid** | Explicit anti-signals from the brief. "Not corporate," "not playful," "not generic AI" |
| **Reference quality** | If references are provided: extract grid style, spacing, density, typography scale, accent logic, image treatment |

### → Output the Brand Strategy Brief

State in 3-5 lines the identity direction you are committing to:

> *"Strategy Brief: Dark developer-tool identity for an AI coding agent. Category: developer infrastructure. Audience: senior engineers who ship fast and distrust marketing fluff. Core metaphor: the scaffold - the invisible structure that holds everything together while you build. Emotional promise: quiet confidence and precision. Trust level: high, earned through restraint. Visual world: near-black panels, monospace accents, construction diagrams, terminal chrome. The brand should feel like it was designed by an engineer who also studied typography."*

### → If the brief is vague

Ask exactly ONE question: *"What's the brand name, what does the product do in one line, and is the energy closer to [dark technical] or [light editorial]?"*

If you can infer from context, skip the question and declare your Strategy Brief.

### → Brand-to-Symbol Mapping

Use this to derive symbol logic from the strategy. Do not pick symbols randomly. The symbol must connect to the product's core action or metaphor.

| Product Verb | Symbol Pool |
|---|---|
| Build / create / ship | Scaffold, frame, block, cursor, cornerstone, beam |
| Protect / monitor / guard | Boundary, watchtower, iris, perimeter, seal |
| Connect / integrate / bridge | Node, junction, handshake, bridge, thread |
| Analyze / search / discover | Lens, trace, signal, radar, spectrum |
| Automate / orchestrate / flow | Loop, relay, conductor, chain, rhythm |
| Speak / communicate / assist | Pulse, waveform, beacon, dialogue, resonance |
| Organize / manage / control | Grid, register, index, calibration, dial |
| Compete / win / perform | Edge, apex, vector, strike, crown |
| Design / craft / refine | Chisel, press, specimen, plate, mark |
| Grow / nurture / sustain | Root, canopy, cycle, bloom, terroir |

### ✓ Quality Gate: Strategy

Before moving to Phase 2, confirm:
- All 10 signals are extracted (or inferred)
- Brand Strategy Brief is written (3-5 lines, committed direction)
- Core metaphor is identified and specific (not "innovation" or "technology")
- Symbol pool is narrowed to 2-3 candidates from the mapping table
- You have NOT started generating any images yet

---

## Phase 2: Identity Architecture (The Combinatorial Engine)

For each category below, commit to ONE option based on the strategy. Do not blend. Do not hedge. Pick and commit. The picks must be internally consistent.

---

### → Visual Mode (pick 1)

Choose the mode that matches the brand's category and cultural position. Each mode defines the board's tonal universe - canvas, accents, logo logic, and mood.

#### Mode 1: Dark Developer / Builder

Use for: developer tools, coding agents, infrastructure, automation, AI builders.

- **Canvas:** near-black `#0a0a0a` to `#1a1a1a`
- **Accents:** cyan `#00d4aa`, electric blue `#3b82f6`, coral `#f97066`, or lime `#84cc16`
- **Visual cues:** monospace accents, command lines, terminal windows, prompt bars, subtle grid, pixel or CRT texture
- **Logo logic:** cursor + frame, bolt + build speed, scaffold + monogram, terminal glyph + symbol, modular construction mark
- **Palette example:** `#0a0a0a` base / `#1a1a1a` surface / `#f0ede8` text / `#00d4aa` accent
- **Mood:** precise, sharp, confident, builder-native

#### Mode 2: Dark Product / Operator

Use for: business tools, growth tools, sales agents, automation, productivity SaaS.

- **Canvas:** black to deep charcoal `#0f0f0f`
- **Accents:** amber `#f59e0b`, red `#ef4444`, warm gold `#d4a853`
- **Visual cues:** glowing UI chips, card systems, segmented flows, icon rows, reward/progress motifs, minimal hero text
- **Logo logic:** signal, gift, path, operator mark, switch, loop, command system
- **Palette example:** `#0f0f0f` base / `#1c1917` surface / `#fafaf9` text / `#f59e0b` accent
- **Mood:** fast, operational, tactical, premium

#### Mode 3: Dark Nature / Calm System

Use for: strategy tools, travel, wellness, climate, quiet premium SaaS.

- **Canvas:** deep forest `#0d1a0f` to charcoal `#141414`
- **Accents:** lime `#a3e635`, sage `#86efac`, mist blue `#7dd3fc`
- **Visual cues:** misty landscapes, image UI circles, soft overlays, calm page labels, dark editorial grid
- **Logo logic:** path, leaf, moon, horizon, compass, portal, folded mark
- **Palette example:** `#0d1a0f` base / `#1a2e1c` surface / `#e8f5e9` text / `#a3e635` accent
- **Mood:** calm, trustworthy, focused

#### Mode 4: Dark Security / Threat Intelligence

Use for: cybersecurity, compliance monitoring, network products, threat detection.

- **Canvas:** black to deep navy `#0a0e1a`
- **Accents:** red `#ef4444`, electric blue `#3b82f6`, amber warning `#f59e0b`
- **Visual cues:** shield forms, radar lines, threat labels, subtle motion traces, alert chips, controlled gradients
- **Logo logic:** shield, raptor, eye, watch, boundary, protected core, iris
- **Palette example:** `#0a0e1a` base / `#111827` surface / `#e2e8f0` text / `#ef4444` accent
- **Mood:** serious, vigilant, precise

#### Mode 5: Light Editorial / Compliance

Use for: legal tech, privacy, compliance, documents, trust-first brands, institutional.

- **Canvas:** warm ivory `#fdfbf7` to cream `#faf5ef`
- **Accents:** deep blue `#1e40af`, crimson `#b91c1c`, gold `#b8860b`
- **Visual cues:** paper texture, small serif labels, seals / badges, color wheel / palette object, calm stationery
- **Logo logic:** seal, dog, shield, document, stamp, monogram, embossed mark
- **Palette example:** `#fdfbf7` base / `#f5f0e8` surface / `#1a1a1a` text / `#1e40af` accent
- **Mood:** trustworthy, refined, institutional but modern

#### Mode 6: Luxury / Beauty / Fashion

Use for: beauty, fashion, hospitality, premium services, high-end consumer.

- **Canvas:** ivory `#faf8f5` to stone `#e8e0d5` to espresso `#2c1810`
- **Accents:** gold `#c9a961`, blush `#e8b4b8`, deep burgundy `#722f37`
- **Visual cues:** serif wordmark, elegant monogram, paper grain, embossing, product labels, editorial crops, soft shadows
- **Logo logic:** monogram, seal, petal, vessel, ritual object, refined typographic mark
- **Palette example:** `#faf8f5` base / `#e8e0d5` surface / `#2c1810` text / `#c9a961` accent
- **Mood:** tasteful, adult, visually expensive

#### Mode 7: Voice / Communication

Use for: voice AI, chat products, assistants, speech technology, audio platforms.

- **Canvas:** deep indigo `#0f0720` to charcoal `#121212`
- **Accents:** lilac `#c084fc`, soft purple `#a78bfa`, warm pink `#f472b6`
- **Visual cues:** waveform motifs, mic elements, phone crops, command input, app icon, orbital rings
- **Logo logic:** wave + initial, sound orb, speech path, microphone abstraction, pulse ring
- **Palette example:** `#0f0720` base / `#1a1030` surface / `#f0e6ff` text / `#c084fc` accent
- **Mood:** fluid, intelligent, intimate

#### Mode 8: Cultural / Experimental

Use for: music, creative tools, events, gaming-adjacent, cultural products, studios.

- **Canvas:** near-black `#0a0a0a` to warm charcoal `#1f1a15`
- **Accents:** bold red `#e11d48`, electric yellow `#facc15`, hot orange `#f97316`
- **Visual cues:** halftone textures, CRT grain, analog print effects, bold accent color, poster-style panels, unexpected image crops
- **Logo logic:** custom wordmark, icon with attitude, symbolic mascot, print-inspired mark
- **Palette example:** `#0a0a0a` base / `#1f1a15` surface / `#fafaf9` text / `#e11d48` accent
- **Mood:** memorable, creative, still controlled

#### Mode 9: Enterprise SaaS / Productivity

Use for: project management, collaboration, analytics, B2B platforms, workflow tools.

- **Canvas:** cool gray `#f8fafc` to slate `#f1f5f9`
- **Accents:** indigo `#4f46e5`, teal `#0d9488`, blue `#2563eb`
- **Visual cues:** clean card systems, subtle grid overlays, metric strips, structured navigation, tab systems, clean iconography
- **Logo logic:** grid, block, check, path, stack, module, structured monogram
- **Palette example:** `#f8fafc` base / `#f1f5f9` surface / `#0f172a` text / `#4f46e5` accent
- **Mood:** professional, clear, trustworthy, approachable
(Omitted for brevity - same as input)
...

#### Mode 10: Gaming / Betting / Competition

Use for: esports, betting platforms, competitive apps, game studios, reward systems.

- **Canvas:** deep black `#050505` to dark purple `#0d0015`
- **Accents:** neon green `#22c55e`, gold `#eab308`, hot pink `#ec4899`
- **Visual cues:** dice, gems, card motifs, signal flashes, trophy elements, speed lines, bold typography, reward UI chips
- **Logo logic:** dice + brand, gem + initial, card suit + symbol, crown + mark, lightning + game element
- **Palette example:** `#050505` base / `#0d0015` surface / `#f0f0f0` text / `#22c55e` accent
- **Mood:** electric, rewarding, high-energy but controlled

#### Mode 11: Warm Editorial / Humanist

Use for: AI products with humanist positioning, knowledge platforms, research tools, education, cultural institutions, brands that want to signal intellectual depth.

This mode draws directly from studio reference work (Polished Snow, Nexus) where classical art, Renaissance painting, and botanical illustration carry the brand's conceptual weight. The imagery IS the argument - it says "we are built on centuries of human thought."

- **Canvas:** warm cream `#faf5ef` to ivory `#fdfbf7`
- **Accents:** muted gold `#b8a472`, deep navy `#1a2744`, warm stone `#8c7b6b`
- **Visual cues:** Renaissance or classical painting panels treated with pixel-halftone or mosaic texture, botanical illustrations, warm editorial cards, serif-italic emphasis words, art-historical imagery as brand-world panels, social media profile cards, editorial website hero mockups
- **Logo logic:** extremely simple geometric marks - 2-3 shapes maximum (e.g., four offset squares, rounded cross in circle). The logo must be so simple it disappears next to the rich imagery. Complexity lives in the image-world, not the mark
- **Typography:** serif + sans pairing. Use serif italic for one emphasis word in the tagline (e.g., "Connecting human potential with infinite *intelligence*"). Display sans for headings, refined serif for accents
- **Image-world:** Classical paintings, Renaissance scenes, flowers, Greek/Roman architecture - but ALWAYS treated with a brand-specific texture (pixel-mosaic, halftone, duotone wash). Raw unprocessed fine art looks like a Wikipedia illustration. Treated fine art looks like a brand decision
- **Color system:** horizontal bar strips showing warm neutrals derived from the art - sand, cream, stone, steel blue, gold, navy
- **Palette example:** `#faf5ef` base / `#f0e8da` surface / `#1a1a1a` text / `#b8a472` gold accent / `#1a2744` navy secondary
- **Mood:** considered, intelligent, warm, institutional-modern, the visual equivalent of a well-lit library

#### Mode 12: Saturated Studio / Agency

Use for: creative agencies, design studios, branding firms, creative SaaS products, marketing platforms, brands that sell craft.

This mode draws from studio reference work (Lumora) where vibrant gradient-noise textures become the entire visual world. No photography. No stock imagery. The brand IS the material.

- **Canvas:** the brand's primary saturated color IS the canvas (e.g., electric orange `#ff4d00`, deep pink `#e91e8c`, vivid purple `#6f2dbd`). Panels sit ON the saturation
- **Accents:** complementary to the primary saturation - navy `#1a1a4e` on orange, white `#fafafa` on pink, warm terracotta on purple
- **Visual cues:** noise-gradient backgrounds (mesh gradients with grain), geometric logo construction diagrams with Venn-diagram logic and labeled concept intersections ("Strategic Vision" + "Humanistic Touch" = "Brand Factor"), business card mockups in multiple color variants, radial gradient burst backgrounds, dark variant panels showing the system's versatility
- **Logo logic:** geometric flower/petal forms constructed from overlapping circles. The construction diagram panel must show the circles and their intersections - the logo emerges from the geometry. Label the concept zones. This is the proof that the mark is designed, not decorated
- **Typography:** modern geometric sans, strong scale contrast (very large display + very small labels), white on saturated backgrounds
- **Image-world:** gradient-noise textures ARE the brand - blurred mesh gradients, grainy color fields, radial glows. These are not backgrounds. They are the visual world. Zero photography
- **Color system:** named color chips on dark backgrounds - "Flame Orange #FF4D00", "Deep Iris #6F2DBD" - or gradient arcs showing the full noise palette
- **Palette example:** `#ff4d00` primary / `#6f2dbd` secondary / `#1a1a4e` dark surface / `#fafafa` text / `#e8b4b8` tertiary
- **Mood:** confident, vibrant, craft-forward, studio energy, the visual equivalent of a designer's desk covered in Pantone chips

#### Mode 13: Soft Gradient / Calm Tech

Use for: design tools, creative feedback platforms, thoughtful consumer products, calm SaaS, meditation apps, gentle AI products.

This mode draws from studio reference work (Thesis) where soft organic gradient blobs and gentle color washes create atmosphere without noise. Restraint is confidence.

- **Canvas:** white `#fafafa` to pale lavender `#f0ecf5` to soft blue `#edf2fb`
- **Accents:** one strong brand color - electric blue `#3366ff`, soft coral `#f08080`, or warm periwinkle `#6366f1` - used for logo, CTAs, and one tagline panel background
- **Visual cues:** soft organic gradient blobs (peach-to-blue, lavender-to-periwinkle) flowing across panels, clean minimal cards with rounded corners, dark-mode UI variant panels showing the brand in both modes, tagline panels with generous negative space
- **Logo logic:** simple geometric mark - a triangle resting against a rectangle (play/forward), a rounded square with one corner pulled, an abstract arrow from two shapes. The logo is EXTREMELY clean. No more than 2 shapes. The gradient world does the emotional work; the logo does the structural work
- **Typography:** clean geometric sans, medium weight, generous letter-spacing. No serif. The type should feel open, not tight
- **Image-world:** organic gradient blobs and soft color washes as brand atmosphere - not decoration, not background. These gradients are the brand's visual weather. They shift across panels like light through a window
- **Color system:** full gradient tint-to-shade strips - each brand color shown from its lightest 5% tint to its darkest 95% shade as a horizontal bar. This is a material study, not a swatch
- **Palette example:** `#fafafa` base / `#f0ecf5` surface / `#1a1a2e` text / `#3366ff` accent / `#f08080` secondary
- **Mood:** calm, considered, modern, quietly confident, the visual equivalent of a deep breath

#### Mode 14: Bold Neon / Creative OS

Use for: creative platforms, consumer creative tools, design OS products, gaming-adjacent brands, merch-heavy brands, products that live in physical space as much as on screen.

This mode draws from studio reference work (NORI) where the brand system covers EVERY conceivable touchpoint. The board is not 9 panels - it is 18-21. The brand exists in the world: on hoodies, in app docks, on membership cards, on packaging.

- **Canvas:** true black `#000000` to deep charcoal `#0a0a0a`
- **Accents:** 3-4 neon colors, ALL named with hex codes: Electric Purple `#7A5CFF`, Neon Lime `#CCFF00`, Coral Burst `#FF6A4D`, Sky Blue `#4SD6FF`, Soft Cream `#F5F3EE`
- **Visual cues:** iridescent gradient glass panels, neon-on-dark variety, physical product mockups (product box 3/4 angle, branded hoodie with logo on chest, membership card with chip detail and member number), app icon in a home screen dock alongside real app shapes, circular badge/stamp with border text, process flow icons (Capture → Organize → Create → Share), website hero section with full nav and CTA, repeated logo pattern as texture/wallpaper
- **Logo logic:** bold mark from rounded bars - ribbon, knot, X-shape, crossed strokes. The mark must be thick enough to read on black at any size. Show it at MULTIPLE scales: giant on the cover panel, medium on the product box, small on the membership card, tiny on the app icon. Show it on multiple backgrounds: black, neon lime, electric purple, white. Show it as a repeating pattern tile
- **Typography:** full Aa specimen panel with weight scale (Light / Regular / Medium / Bold) + number row (0 1 2 3 4 5 6 7 8 9) + custom display face name. This is the most typographically detailed mode
- **Image-world:** iridescent gradient glass + dark product photography (box on dark surface, hoodie flat-lay) + lifestyle application (card in hand, box on desk, app icon in context). The brand is PHYSICAL
- **Color system:** named chips on dark background - each swatch is a rounded rectangle with the color name in small caps above and the hex code below. ALL swatches shown together in a horizontal row
- **Palette example:** `#000000` base / `#0a0a0a` surface / `#F5F3EE` text / `#7A5CFF` accent-1 / `#CCFF00` accent-2 / `#FF6A4D` accent-3 / `#4SD6FF` accent-4
- **Mood:** energetic, bold, physical, creative-native, the visual equivalent of unboxing a premium creative tool

**This mode REQUIRES the Mega System layout (see below).** A 3×3 grid cannot contain the touchpoint breadth this mode demands.

### → Selecting the Mode

Read the Brand Strategy Brief from Phase 1. Match the category, audience, and cultural position to the most fitting mode. Each mode defines the board's tonal universe - canvas, accents, logo logic, and mood.

If the brand sits between two modes, pick the one that better serves the core metaphor. Do not blend modes - a "Dark Developer" board with "Luxury" accents is confused, not versatile.

If the brief describes a category not covered by these 14 modes, construct a custom mode by:
1. Picking the closest mode as a starting point
2. Swapping the palette and accent to match the brief
3. Adjusting the visual cues to match the product's world
4. Declaring the custom mode explicitly before proceeding

---

### → Board Layout (pick 1)

| # | Layout | Grid | When to use |
|---|---|---|---|
| 1 | **Full Identity System** | 3 × 3 | Complete brand presentation, maximum panel variety |
| 2 | **Cinematic Deck Overview** | 2 × 3 | Focused presentation, editorial pacing, reference-deck feel |
| 3 | **Compact Concept Board** | 2 × 2 | Quick concept, logo-focused, tight and punchy |
| 4 | **Horizontal Brand Strip** | 1 × 3 | Social media header, compact showcase, billboard energy |
| 5 | **Wide Contact Sheet** | 4 × 2 | Comprehensive system view, photography-led brands |
| 6 | **Mega System** | 6 × 3 or 7 × 3 | Every conceivable touchpoint. Required for Mode 14. Use for creative OS brands, consumer platforms, merch-heavy brands |

Default if unspecified: 3 × 3 for new brands, 2 × 3 for refinement passes. Mode 14 defaults to Mega System.

### → Mega System Panel Breakdown (18-21 panels)

When using Layout 6, fill the grid with ALL of these touchpoints. The point is exhaustive coverage - proving the brand works everywhere.

**Identity Core (4 panels):**
1. Logo cover - mark + wordmark on brand primary background, massive negative space
2. Logo on alternative background - the mark on its secondary color (e.g., white on neon lime, black on cream)
3. Construction proof - geometric construction diagram showing ≤3 guide circles/rectangles, labeled concept intersections if using Venn-diagram approach
4. Logo pattern tile - the mark repeated as a seamless pattern/texture filling the entire panel

**Digital Applications (3-4 panels):**
5. Website hero section - full hero with nav bar (logo + 3-4 links), headline (5-10 words), subhead, CTA button, trust badges. Not wireframe - a real hero
6. App icon on home screen dock - rounded-rectangle icon alongside recognizable app shapes (Messages, Camera, Music), with notification badge
7. Social media profile card - Twitter/X style: brand avatar (logo mark), @handle, bio line (tagline), follower/following counts, optional header image in brand style
8. Notification/UI card - toast notification, "Project synced - NORI Drive - 2m ago ✓" style

**Physical Applications (3-4 panels):**
9. Business card - front face showing logo, name, title, contact. Optionally show back face in a second variant
10. Product packaging - box at 3/4 angle showing two faces, logo + tagline visible
11. Branded merch - hoodie or tee with logo placement on chest, clean garment, dark or light fabric
12. Membership/ID card - credit-card proportions, chip detail, member number, logo, brand color

**System Panels (3-4 panels):**
13. Color system - named chips with hex codes, ALL swatches labeled: "Electric Purple #7A5CFF", "Neon Lime #CCFF00"
14. Typography specimen - large Aa + weight scale (Light / Regular / Medium / Bold) + number row (0 1 2 3 4 5 6 7 8 9)
15. Process/flow icons - 4-5 step process (Capture → Organize → Create → Share) with simple icons and arrows
16. Circular badge/stamp - the logo mark in a circular stamp with border text (brand name or tagline around the perimeter)

**Brand World (2-3 panels):**
17. Campaign tagline panel - bold tagline on brand-color background, large display type, one or two lines max
18. Brand-world image - art-directed atmospheric image matching the mode's image-world approach
19. Lifestyle application - the product in context (card in hand, box on desk, app on phone in café)

**Optional extras (for 7×3 = 21 panels):**
20. Secondary tagline/headline variant
21. Brand mark on unexpected surface (sticker, vinyl, event wristband)

---

### → Canvas Treatment (pick 1)

| # | Treatment | Character |
|---|---|---|
| 1 | **Pure field** | Solid charcoal or ivory with soft ambient depth, lets panels breathe |
| 2 | **Textured paper** | Warm, craft-oriented, print studio feel, subtle grain |
| 3 | **Technical grid** | Precise, engineered, construction-drawing energy |
| 4 | **Material surface** | Stone, concrete, leather, or metal - tactile and premium |
| 5 | **Gradient depth** | Soft tonal shift from edge to center, cinematic atmosphere |
| 6 | **Branded color field** | The board canvas IS the brand's primary color (e.g., medium blue, forest green, warm terracotta). Panels sit on a saturated brand surface instead of neutral dark/light. Bold, ownable, immediately distinctive |
| 7 | **Perforated / industrial** | Perforated metal, pegboard, mesh, or industrial panel texture behind panels. Adds tactile depth and framing without competing with content |

---

### → Logo Concept Method (pick 1, combine 2 maximum)

Do not design a logo randomly. Pick a method that connects the mark to the brand's meaning.

#### Method 1: Monogram + Meaning

Combine the brand initial with a metaphor. Use negative space, cuts, folds, or geometry. Do not make a boring letter icon.

Examples:
- `K` + kite / frame / direction
- `N` + path / folded system
- `S` + sound wave / speech flow
- `A` + ascent / architecture / momentum

#### Method 2: Product Action

Turn the product's main action into an abstract symbol. Make it premium, not literal.

Examples:
- build → frame, scaffold, block, cursor
- protect → shield, boundary, watch mark
- convert → switch, arrow, transformation shape
- speak → waveform, mic, pulse

#### Method 3: Metaphor Fusion

Combine two meaningful ideas into one reduced mark. The fusion should be subtle and readable at small sizes.

Examples:
- owl + drone vision
- shield + mountain
- moon + waveform
- cursor + lightning speed
- dice + mobile game economy

#### Method 4: Negative Space

Use empty space to create intelligence. The hidden element should be discoverable on second look.

Examples:
- hidden arrow in letter spacing
- protected center inside a shield form
- cutout initial revealing a secondary shape
- eye formed by crossing geometric shapes

#### Method 5: Construction Geometry

Create a mark from a clear geometric system - circles, diagonal cuts, grids, frames, modular blocks, orbital paths, crosshairs, measured linework. One panel on the board can show the construction logic.

#### Method 6: Image-Filled Letterform

Clip brand-world imagery INSIDE the logo letterform or mark. The letter becomes a window into the brand's visual world - landscapes, textures, product imagery masked by the letterform shape. The outer shape reads as the mark; the interior imagery reads as atmosphere.

Examples:
- Brand initial filled with nature photography (fields, forests, skies)
- Monogram containing product screenshots or UI fragments
- Symbol shape masking a cinematic landscape color-graded to the palette
- Abstract mark filled with brand-colored texture or material

The image inside must be art-directed to the brand palette. Random stock imagery inside a letter is not this method - it is clip art. The masked image must feel intentional, like the brand's world is literally contained within the mark.

---

### → Logo Hard Constraints (All Must Pass)

Regardless of which method you pick, the final logo must satisfy ALL of these. If any fails, the mark is not ready.

1. **3-primitive maximum**: The entire mark must be constructible from ≤3 geometric primitives (circles, rectangles, triangles, lines, arcs). If you need more shapes, it is too complex. Reference calibration: Polished Snow = 4 squares. Thesis = 1 triangle + 1 rectangle. Nexus = 1 rounded cross + 1 circle. These are real studio logos. Match their simplicity.
2. **Favicon test**: Must be recognizable and distinct at 16×16 pixels. If detail disappears at favicon scale, cut it until it doesn't.
3. **One-sentence geometry**: You must be able to describe the mark as: "It's a [shape] [operation] a [shape]." Example: "It's two overlapping rounded squares with the intersection removed." If the sentence needs an "and" or comma splice, the mark is too complex.
4. **Inversion test**: Must work identically in black-on-white AND white-on-black. No color-dependent forms.
5. **Wordmark pairing**: Must sit cleanly next to the brand name set in the chosen typography. If the mark fights the wordmark's proportions, adjust.
6. **Pattern tile test**: Must work as a repeating pattern when tiled. If it falls apart or creates visual noise, the geometry isn't balanced.

### → Logo Anti-Patterns (Hard Bans)

Generating any of these is a pipeline failure. These are the most common AI logo defaults:

- ❌ **Metallic/chrome 3D logos** - Logos are flat. No bevels, no reflections, no faux-3D rendering.
- ❌ **Brain/neuron networks** - The single most cliché AI logo. Absolute ban.
- ❌ **Globe with swoosh** - 1990s corporate identity. Dead.
- ❌ **Shield with wings** - The laziest security logo.
- ❌ **Interlocking rings** - Unless you are the Olympics, no.
- ❌ **Meaningless sparkle bursts** - Stars and sparkles are decoration, not design.
- ❌ **Infinity symbols** - Overused to meaninglessness.
- ❌ **Overcomplicated crests** - If it has >3 elements, it's an illustration, not a logo.
- ❌ **Gradient-dependent marks** - If the logo needs a gradient to be recognizable, the form is weak.
- ❌ **Thin hairline marks** - Must reproduce at small sizes. Hairlines break.
- ❌ **Random letterform distortion** - Stretching, warping, or melting a letter is not logo design.
- ❌ **Clipart-style icons** - The mark must feel constructed, not downloaded.

---

### → Logo Reduction Ladder

After picking a method, walk the reduction ladder. Start with meaning and compress until only the essential shape remains.

```
STEP 1: MEANING SENTENCE
  "This brand is about [core metaphor] applied to
  [product action] for [audience]."

STEP 2: VISUAL TRANSLATION
  Convert the sentence into 3-5 candidate shapes.
  Each shape must connect to a word in the sentence.

STEP 3: COMPRESSION
  Take the strongest candidate. Reduce it:
  - Can it work in one continuous stroke?
  - Can it be built from ≤ 3 geometric primitives?
  - Does it hold meaning at 16px?
  - Would a stranger guess the industry within 2 tries?
  If any answer is no, reduce further.

STEP 4: LETTER INTEGRATION (optional)
  If the brand initial adds meaning, integrate it.
  The letter must modify the shape, not sit next to it.
  A pure symbol is better than a forced monogram.

STEP 5: SYSTEM TEST
  The final mark must pass all five:
  - Works as a favicon (16×16)
  - Works as an app icon (1024×1024)
  - Works in single color (no gradients required)
  - Works reversed (light on dark AND dark on light)
  - Looks intentional next to Apple, Linear, or Stripe logos
```

Most AI logos fail because they ADD elements instead of removing them. The ladder forces reduction.

### → Logo Consistency Protocol (Anti-Morphing)

The logo must appear identical in every panel. When the mark drifts between panels - gaining petals, losing arms, shifting proportions - the board fails as a system. Modern image models can hold consistency, but only when the prompt is precise enough to leave zero room for interpretation.

**The Frozen Logo Description**

Write one sentence of exact geometry for the mark. This sentence is copy-pasted verbatim into every panel assignment where the logo appears. No synonyms, no rephrasing, no shorthand between panels.

Bad (vague, invites drift):
> "The Lumenova logo, a golden cross-like shape"

Good (frozen, precise):
> "The Lumenova logo: exactly four identical rounded squares arranged in a plus/cross formation, overlapping at their corners, with the top-left and bottom-right squares in orange #FF7A00 and the top-right and bottom-left squares in amber #E8A000"

**Rules for the frozen description:**

1. **State the exact count.** "Exactly 4 rounded squares", "exactly 2 overlapping circles", "exactly 3 diagonal bars." The word "exactly" locks the count.

2. **Name the spatial arrangement.** Not "arranged nicely" - say "in a 2×2 grid with the center gap removed" or "stacked vertically" or "overlapping at their 25% intersection."

3. **Include colors with hex codes.** "In orange #FF7A00" not "in a warm orange."

4. **Paste the frozen description into EVERY panel.** Every panel that shows the logo - anchor, business card, app icon, lanyard, laptop screen, merch - gets the identical sentence:

   ```
   Panel 1 (Anchor): [frozen logo description] centered at large scale on dark canvas
   Panel 4 (Proof - Card): [frozen logo description] at small scale on the card face
   Panel 5 (Proof - App Icon): [frozen logo description] at icon scale in rounded-rect frame
   Panel 7 (Proof - Merch): [frozen logo description] on the chest of a dark hoodie
   ```

5. **Add a global instruction** at the top of the prompt: "The logo mark must appear IDENTICAL in every panel. Same shapes, same proportions, same colors, same arrangement across all panels."

---

### → Typography Character (pick 1)

| # | Type | Energy | Pairing Guidance |
|---|---|---|---|
| 1 | **Compressed display sans** | Industrial, dramatic, high-impact | Pair with light-weight body sans for contrast |
| 2 | **Clean geometric grotesk** | Modern, approachable, startup-friendly | Pair with monospace for technical brands |
| 3 | **Refined neo-grotesk** | Polished, agency-grade, premium tech | Self-sufficient, use weight variation for hierarchy |
| 4 | **Editorial serif** | Tasteful, institutional, considered | Pair with clean sans for modern tension |
| 5 | **Monospace technical** | Engineer-native, terminal-adjacent, precise | Pair with a single display sans for headings |
| 6 | **Expressive display** | Bold, statement, creative, memorable | Pair with a quiet body sans to let it breathe |

---

### → Color Discipline (pick 1 palette structure)

| Structure | Application |
|---|---|
| **Monochrome + single accent** | Near-black + white + one saturated hue. The accent carries the entire system. Most versatile |
| **Analogous triad** | Three hues within 60° on the color wheel. Harmonious, subtle, sophisticated |
| **Complementary anchor** | One dominant + one opposite for tension. Use the complement sparingly (CTA, highlights only) |
| **Material-derived** | Colors extracted from a real material (wood, stone, copper, ink). Tactile and grounded |
| **Heritage duo** | Two historically associated colors (navy + gold, forest + cream, black + red). Institutional gravitas |

Rules that apply to every palette:
- Accents must repeat across panels. One appearance is not a system
- No random rainbow unless the brief explicitly requests it
- No default AI purple-blue gradient glow unless the brand is literally about AI and the strategy justifies it
- One accent can carry an entire identity. Two accents maximum across the board
- The palette must include specific hex values or clear color descriptions - never "nice colors"

---

### → Tagline Energy (pick 1)

| Energy | Example Pattern | When |
|---|---|---|
| **Declarative** | "Nothing random." / "Build better." | Confident brands, established positioning |
| **Interrogative** | "What will you build today?" | Invitational brands, tools, platforms |
| **Imperative** | "Ship it." / "On guard." | Action-oriented brands, operational tools |
| **Fragment** | "Every mission. Under control." | Dramatic brands, cinematic positioning |

The tagline must be short (under 8 words), specific to the brand, and free of corporate filler. No "Elevate your workflow." No "Seamless solutions for modern teams." No "Unleash the power of."

---

### ✓ Quality Gate: Architecture

Before moving to Phase 3, confirm:
- ONE visual mode selected and declared
- ONE option selected from each remaining category (no blending)
- Picks are internally consistent (Dark Developer mode + Monospace technical type + Monochrome accent = valid. Warm Luxury mode + Monospace technical type = probably wrong)
- Logo concept method connects to the core metaphor from Phase 1
- Color discipline matches the visual mode's palette example
- Tagline energy matches the brand's cultural position
- You can explain WHY each pick was made in one sentence

---

## Phase 3: Panel Composition

Each panel in the grid gets a specific role, a composition anchor, and an energy level. The board must have rhythm - not every panel can be loud, and not every panel can be quiet.

### → The Argument Structure

A brand board is a visual argument. Each panel plays a role in that argument. The roles are not content types ("color panel," "type panel"). They are rhetorical positions. What matters is what each panel PROVES, not what content category it belongs to.

Five roles. Every board must include all five. Some roles can appear in multiple panels.

| Role | What it proves | Panel count |
|---|---|---|
| **Anchor** | This is the brand. The mark, the name, the core visual identity at rest. Maximum restraint, maximum negative space | Exactly 1 |
| **Proof** | The brand works on real surfaces. Digital screens, physical objects, environmental contexts. Not theoretical - applied | 2-3 panels |
| **System** | The brand is governed by rules. Color relationships, type hierarchy, spacing logic, component vocabulary. The rules are visible | 1-2 panels |
| **World** | The brand has atmosphere. Photography, texture, material, cinematic mood. The brand exists in a place, not just on a screen | Exactly 1 |
| **Signal** | The brand communicates. A tagline, a command, a URL, a statement. One piece of language that captures the brand's voice | Exactly 1 |

### → Default Panel Systems

#### 3 × 3 Board: Full Identity System

```
┌─────────────────┬─────────────────┬─────────────────┐
│                 │                 │                 │
│     ANCHOR      │     SYSTEM      │      PROOF      │
│   (the mark)    │  (how it's      │  (where it      │
│                 │    built)       │    lives)       │
├─────────────────┼─────────────────┼─────────────────┤
│                 │                 │                 │
│     SIGNAL      │      SYSTEM     │      PROOF      │
│  (the voice)    │  (the rules)    │  (another       │
│                 │                 │    surface)     │
├─────────────────┼─────────────────┼─────────────────┤
│                 │                 │                 │
│      PROOF      │      WORLD      │      SYSTEM     │
│  (one more      │  (the mood)     │  (the details)  │
│    surface)     │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

Default panel content mapping:

1. **Logo Cover** - Large logo and wordmark, minimal title, strong negative space
2. **Logo Construction** - Symbol breakdown, grid, geometry, or negative-space logic
3. **Digital Application** - Browser chrome, app header, terminal, dashboard fragment, or app icon
4. **Brand Essence** - One short tagline, large readable typography, sparse composition
5. **Color System** - Swatches, gradient strips, color discs, material chips, or palette cards
6. **Typography** - Large type specimen, alphabet row, or primary/secondary type pairing
7. **Physical Application** - Card, folder, badge, poster, label, seal, packaging, or object mockup
8. **Image Direction** - Cinematic landscape, product crop, halftone poster, editorial scene, material texture
9. **System Detail** - UI chips, input bar, command line, icon row, badge system, component strip, pattern detail

#### 2 × 3 Board: Compressed Argument

```
┌─────────────────┬─────────────────┐
│     ANCHOR      │      PROOF      │
├─────────────────┼─────────────────┤
│     SYSTEM      │      WORLD      │
├─────────────────┼─────────────────┤
│     SIGNAL      │      PROOF      │
└─────────────────┴─────────────────┘
```

Same 5 roles, fewer panels. Each panel carries more weight. The Anchor panel must be even more restrained.

### → Panel Rhythm Rules

- Never place two Quiet panels adjacent to each other
- Never place three Technical panels in a row
- The board must contain at least one Emotional panel and one Functional panel
- The Anchor panel is always position 1 (top-left)
- The most atmospheric panel should not be position 1

### → Panel Composition Anchors

Assign one per panel. Across the board, at least 3 different anchors must appear.

| Anchor | Description |
|---|---|
| **Dead center** | Content centered both axes, maximum symmetry, confident restraint |
| **Top-left gravity** | Content anchored top-left, reading-order natural, editorial |
| **Bottom-right detail** | Small element anchored bottom-right, system-detail energy |
| **Offset bleed** | Content deliberately pushed to one edge, bleeds into gutter |
| **Full-fill** | Content fills the entire panel edge to edge (images, color fields) |
| **Stacked vertical** | Elements stacked top-to-bottom with clear vertical hierarchy |

### → Premium Detail Language

Use details like these sparingly to reward closer inspection:
- Small page numbers in panel corners (e.g., "01" bottom-right)
- Tiny footer labels or section markers (e.g., "COLORS" or "TYPEFACE")
- Precise alignment marks or construction lines at low opacity
- Thin rules separating sub-elements within a panel
- Low-opacity texture overlays (grain, halftone, noise)
- One highlighted word in the tagline using the accent color
- Browser chrome with a realistic URL bar and navigation dots
- Rounded rectangle frames for contained images
- Subtle drop shadows between panel layers
- App icon on a realistic phone homescreen with notification badge
- Social media profile card (X/Twitter style) with avatar, handle, bio, and Follow button
- Color system panel with labeled strips and visible hex values
- Perforated metal or material texture framing an image panel
- Device mockup (laptop, phone) on a dark surface showing the brand's website

Do not overuse them. Three to five details across the entire board. Premium detail is discovered, not announced.

### ✓ Quality Gate: Composition

Before moving to Phase 4, confirm:
- Every panel has a role, anchor, and energy level assigned
- Panel rhythm varies (no adjacent duplicates in energy)
- At least 3 different composition anchors appear across panels
- Anchor panel is position 1
- Board contains at least 1 Emotional and 1 Functional panel
- Premium details are planned (3-5, not more)

---

## Phase 4: Prompt Engineering

Build one structured prompt for the complete board using the blueprint below. Fill in every field. Skipping fields produces generic output.

**If Phase 0 produced a REFERENCE INSTRUCTION block**, prepend it at the very top of the prompt BEFORE the blueprint. The REFERENCE INSTRUCTION block anchors the AI model to the reference image's quality bar and aesthetic DNA. The blueprint then fills in the brand-specific content below it.

### → The Prompt Blueprint

```
PROMPT BLUEPRINT - Brand-Kit Board: [BRAND NAME]
──────────────────────────────────────────────────

BRAND STRATEGY:
  Category: [from Phase 1]
  Audience: [from Phase 1]
  Core metaphor: [from Phase 1]
  Emotional promise: [from Phase 1]
  Logo idea: [how the mark combines symbol + name + metaphor]

BOARD FORMAT:
  Layout: [from Phase 2 - e.g., "3×3 grid"]
  Aspect ratio: [4:3 or 16:10]
  Canvas: [from Phase 2 - e.g., "near-black #0a0a0a charcoal field
           with subtle paper texture, strong 12px gutters
           between panels, rounded-lg panel corners"]

VISUAL MODE:
  [from Phase 2 - e.g., "Dark Developer: near-black panels,
   monospace accents, terminal chrome, cyan #00d4aa accent"]

PANEL ASSIGNMENTS:
  Panel 1: [role] - [what to show] - [anchor] - [energy]
  Panel 2: [role] - [what to show] - [anchor] - [energy]
  ...
  Panel N: [role] - [what to show] - [anchor] - [energy]

LOGO:
  Method: [from Phase 2 - e.g., "Monogram + Meaning: the letter K
           is cut diagonally to reveal a kite shape in the
           negative space"]
  Symbol: [from Phase 1 symbol pool]
  Construction: [how the mark is built - e.g., "constructed on a
                 circular grid with 15-degree increments, single
                 continuous stroke, works at 16px"]
  Frozen description: [EXACT geometric sentence - copy this verbatim
                       into every panel assignment where the logo appears.
                       Include shape count, arrangement, and colors.
                       e.g., "exactly two overlapping rounded rectangles
                       rotated 45°, forming a diamond intersection,
                       in white #FFFFFF on dark backgrounds"]
  Variants shown: [wordmark, icon mark, badge, app icon]
  
  GLOBAL CONSISTENCY RULE: The logo mark must appear IDENTICAL in
  every panel where it is shown. Same number of shapes, same
  proportions, same colors, same spatial arrangement. Do not add,
  remove, rotate, or modify any element of the mark between panels.

TYPOGRAPHY:
  Character: [from Phase 2]
  Heading treatment: [e.g., "compressed all-caps display,
                      tight tracking, used for brand name
                      and tagline only"]
  System labels: [e.g., "small monospace, uppercase, wide
                  tracking, 60% opacity, used for panel
                  labels and page numbers"]

PALETTE:
  Structure: [from Phase 2]
  Base: [e.g., "#0a0a0a near-black"]
  Surface: [e.g., "#1a1a1a dark panel fill"]
  Primary text: [e.g., "#f0ede8 warm off-white"]
  Muted text: [e.g., "rgba(240,237,232,0.5)"]
  Accent: [e.g., "#00d4aa teal - used on logo mark,
           CTA elements, and active states"]

TAGLINE:
  Text: [the actual tagline]
  Energy: [from Phase 2]

ATMOSPHERE:
  [e.g., "subtle film grain at 2% opacity across canvas,
   soft ambient glow behind logo cover panel, halftone
   treatment on the image-direction panel, no hard shadows
   between panels - depth comes from surface color
   difference only"]

PREMIUM DETAILS:
  [list the 3-5 planned details - e.g.,
   "page number '01' bottom-right of panel 1,
    construction grid lines at 15% opacity in panel 2,
    realistic URL 'app.brandname.com' in browser chrome,
    one word of tagline highlighted in accent color"]

WHAT THIS IS NOT:
  [explicit anti-patterns - e.g.,
   "NOT a Canva brand board template.
    NOT random icons floating on a gradient.
    NOT an overdesigned logo with 6 colors.
    NOT a collage of unrelated mockups.
    NOT tiny illegible text pretending to be a system.
    NOT a generic startup pitch deck slide."]
```

### → The Jaw-Dropper Executive Prompt (2026 Sleek Format)

For modern 2026 image generation models that thrive on dense, high-signal, executive-level instructions without verbose boilerplate, use this sleek, jaw-dropping prompt template:

```
Create a premium 3×3 visual identity board for [BRAND NAME].

Brand strategy:
- category: [CATEGORY]
- audience: [AUDIENCE]
- personality: [TRAITS]
- emotional promise: [PROMISE]
- core metaphor: [METAPHOR]
- logo idea: [SYMBOL LOGIC + FROZEN GEOMETRY SENTENCE]

Board format: 3×3, 4:3 aspect ratio
Visual mode: [minimal editorial / digital modernist / pixel modernist / institutional trust / product utility / cultural experimental]

Include: logo cover, construction rationale, wordmark system, brand essence, color system, typography, application, imagery direction, system detail.
```

### ✓ Quality Gate: Prompt

Before generating, confirm:
- Complete prompt follows the blueprint structure (no fields skipped)
- WHAT THIS IS NOT section includes at least 4 specific anti-patterns
- Palette is fully specified with hex values
- Logo construction is described specifically (not "a nice logo")
- **Frozen logo description is written and copy-pasted into EVERY panel assignment where the logo appears** (§ Logo Consistency Protocol)
- **Global consistency rule is included at the top of the prompt**
- Panel assignments match Phase 3 composition plan
- Typography character is consistent across all panel descriptions
- Tagline is under 8 words and free of corporate filler

---

## Phase 5: Visual Diff

After generating the board, audit it against the strategy and architecture picks. Walk through every check. Any FAIL means re-generating with a corrected prompt.

### Logo Diff

| Check | PASS/FAIL |
|---|---|
| Logo is simple enough to work as a 16px favicon | |
| Logo connects to the core metaphor from Phase 1 | |
| **Logo is IDENTICAL across every panel** - same number of shapes, same proportions, same arrangement, same colors. Compare the anchor panel mark to EVERY other appearance (mockups, app icon, card, merch). If any element was added, removed, rotated, or resized, this is a FAIL. | |
| Logo uses the concept method committed in Phase 2 | |
| Logo is not a generic lightning bolt, brain icon, or shield without strategic justification | |
| Logo wordmark is legible and the typeface matches the typography character | |
| **Logo does NOT clone the reference image's mark** - different geometric DNA, different shape vocabulary, different construction method. Run the geometry-difference test (§ Reference Usage Protocol) | |
| Logo passes the 3-primitive cap from § Logo Hard Constraints | |
| Logo passes the one-sentence geometry test from § Logo Hard Constraints | |

### Composition Diff

| Check | PASS/FAIL |
|---|---|
| Grid is clean with consistent gutters between all panels | |
| Panel edges are aligned (no random offsets or overlaps) | |
| At least 3 different composition anchors appear across panels | |
| Panel energy rhythm varies (no three adjacent panels at the same energy) | |
| Anchor panel is position 1 (top-left) and has maximum negative space | |
| The board reads as ONE identity, not a collection of unrelated rectangles | |

### Palette Diff

| Check | PASS/FAIL |
|---|---|
| One dominant palette threads through every panel | |
| Accent color appears in at least 3 panels (not just one) | |
| No rogue colors appear that were not in the palette specification | |
| No AI-default purple-blue gradient glow (unless strategy justifies it) | |
| Dark boards use off-black (#0a0a0a range), not pure black (#000000) | |
| Light boards use warm off-white, not pure white (#FFFFFF) | |

### Typography Diff

| Check | PASS/FAIL |
|---|---|
| Text is sparse: brand name, one tagline, one URL, section labels, UI chips only | |
| No tiny illegible paragraphs or fake body copy | |
| Tagline is large enough to read comfortably | |
| Typography character is consistent across all panels (same family, same hierarchy) | |
| Panel labels and page numbers (if present) use a secondary type style | |

### Identity System Diff

| Check | PASS/FAIL |
|---|---|
| The board answers: what does this brand represent? | |
| The board answers: what is the core metaphor? | |
| The board answers: how does the logo express that? | |
| The board answers: how does the system scale across digital, physical, and atmospheric applications? | |
| The board answers: why does the whole thing feel ownable (not interchangeable with any other brand)? | |

---

## Phase 6: Panel Surgery

After the Visual Diff, some boards will have 4-5 excellent panels and 1-2 weak ones. Instead of regenerating the entire board (which risks losing the good panels), use **Panel Surgery** - regenerate individual panels as standalone cards and composite them into the final board.

### → When to trigger Panel Surgery

Panel Surgery activates when:
- The Visual Diff identifies 1-2 specific panel failures while the majority of panels pass
- A panel's content clashes with the overall aesthetic (e.g., a random oil painting in a digital-modern board)
- A panel's visual weight or density is significantly off from its neighbors
- The user explicitly identifies specific panels they dislike while approving the rest

Do NOT use Panel Surgery when:
- More than 3 panels fail the Visual Diff (regenerate the entire board instead)
- The logo mark is the problem (that's Phase 7's job)
- The overall aesthetic direction is wrong (go back to Phase 0 or Phase 2)

### → Step 1: Diagnose the Weak Panel

For each weak panel, identify the specific failure:

| Failure Type | Example | Fix Strategy |
|---|---|---|
| **Medium Clash** | An oil painting of clouds in a digital-modern board | Replace with content that matches the board's medium (e.g., typography specimen, architectural diagram, software UI) |
| **Color Clash** | A panel introduces earthy beige tones in an electric chromatic board | Regenerate with the board's exact palette hex values |
| **Visual Weight Mismatch** | A nearly empty panel next to dense, saturated panels | Add structured content (swatches, type specimen, UI elements) to balance density |
| **Content Irrelevance** | A panel shows generic stock-energy imagery unconnected to the brand | Replace with brand-specific content (product UI, construction grid, application mockup) |
| **Filler Energy** | A panel exists to fill the grid but adds no new information | Either remove the panel (reduce grid size) or assign it a specific functional role |

### → Step 2: Write the Single-Panel Prompt

Generate the replacement panel as a **standalone card image** using a prompt that:

1. **References the existing board** - attach the current board as context so the AI matches the aesthetic
2. **Specifies the exact panel role** - what this card should show (e.g., "Typography & Color Token Specimen")
3. **Locks the palette** - include exact hex values from the board's color system
4. **Matches the surface treatment** - specify the same texture, grain, and card structure as the rest of the board
5. **Sets the aspect ratio** - match the panel's proportions in the grid (usually 4:3 for a single panel)

### → Single-Panel Prompt Template

```
REFERENCE INSTRUCTION - PANEL REPLACEMENT:
Use the attached brand board image as a reference for the exact surface treatment, color palette, typography style, and card structure. This replacement panel must look like it was always part of the board.

Create a single high-resolution [PANEL ROLE] card on [SURFACE DESCRIPTION - e.g., "crisp off-white paper (#F4F4F6) with subtle print registration marks"].

Include:
- [SPECIFIC CONTENT 1 - e.g., "Large editorial serif specimen showing 'Aa Bb Cc' and the brand wordmark"]
- [SPECIFIC CONTENT 2 - e.g., "Four rectangular color swatches: Tangerine (#FF521B), Cobalt (#3D4AE0), Fuchsia (#E8206A), Obsidian (#111111)"]

Visual style: [MATCH THE BOARD'S STYLE - e.g., "Swiss-modernist editorial layout, zero 3D elements, pure typographic precision"]. Aspect ratio: [PANEL ASPECT RATIO].
```

### → Step 3: Composite in Figma (or equivalent)

After generating the replacement panel:

1. Import the original board into Figma (or Photoshop, Sketch, etc.)
2. Place the replacement panel over the weak panel, aligning edges to the grid
3. Adjust sizing if needed to match the grid cell dimensions
4. Export the final composite at full resolution

This manual compositing step is expected and normal - even professional studios composite final presentation decks from separately generated assets.

### ✓ Quality Gate: Panel Surgery

Before finalizing:
- Replacement panel matches the board's surface treatment and texture
- Replacement panel's color palette is identical to the board's palette (no rogue colors)
- Replacement panel's typography style matches the board's type hierarchy
- Replacement panel adds functional value (not filler)
- The composite reads as a single cohesive board with no visible seams

---

## Phase 7: Logo Originality Gate

When a reference image was provided in Phase 0, the generated logo mark will default to cloning the reference's symbol. This is the hardest problem in reference-based brand kit generation. Phase 7 is a mandatory post-generation audit that catches clones.

### → When to trigger the Logo Originality Gate

This phase is MANDATORY when:
- A reference image was provided in Phase 0
- The reference image contained a visible logo mark or symbol

Skip this phase when:
- No reference image was used
- The user is in Asset mode (they provided their OWN logo to preserve)

### → Step 1: Geometry-Difference Audit

Describe both marks in one sentence each:

| Mark | One-Sentence Geometry Description |
|---|---|
| **Reference mark** | e.g., "Eight overlapping diamond petals arranged radially to form a symmetrical flower blossom with a hollow center" |
| **Generated mark** | e.g., "???" |

Now run the **vocabulary overlap test:**

1. List the primary shape words from the reference description (e.g., "petals", "flower", "radial", "blossom", "hollow center")
2. List the primary shape words from the generated description
3. If **3 or more shape words match**, the generated mark is a clone → **FAIL**
4. If **2 or fewer shape words match**, the generated mark is sufficiently distinct → **PASS**

### → Step 2: Visual Similarity Check

Beyond geometry, check for these cloning signals:

| Signal | Clone Indicator |
|---|---|
| **Symmetry type** | Same symmetry (e.g., both 8-fold radial) → likely clone |
| **Shape count** | Same number of sub-shapes (e.g., both have 8 petals) → likely clone |
| **Negative space** | Same negative-space structure (e.g., both have a hollow center eye) → likely clone |
| **Rendering style** | Mark shown in the same style as reference (e.g., both use halftone stencil, both use chromatic gradient fill) → acceptable if geometry differs |

### → Step 3: Force Divergence (if clone detected)

If the generated mark fails the audit, do NOT try to "tweak" the mark - the AI will produce a minor variant that is still recognizably the same symbol. Instead:

1. **Choose a completely different logo method** from Phase 2 (e.g., if reference used Construction Geometry, switch to Negative Space Letterform or Monogram + Meaning)
2. **Choose a different primary shape vocabulary** (e.g., if reference used radial petals, use angular prisms or stacked bars)
3. **Explicitly ban the reference geometry in the prompt** - add to the REFERENCE INSTRUCTION block: `"The logo mark must NOT use [reference shape vocabulary]. Use [your chosen alternative] instead."`
4. **Regenerate the entire board** with the new logo (do not try to swap just the logo - it must thread through all panels consistently)

### → The Nuclear Option: User-Designed Logo

If after 2 regeneration attempts the logo still clones the reference, recommend the user:
1. Design their own logo mark externally (in Figma, Illustrator, or by hand)
2. Export as PNG at 1024px+
3. Switch to **Asset mode** (§ Reference Usage Protocol → Mode: Asset) and rebuild the board around their custom mark

This is not a failure of the skill - it is an honest acknowledgment that generating a truly original, memorable logo mark that rivals a reference image's symbol is the hardest unsolved problem in AI image generation.

### ✓ Quality Gate: Logo Originality

Before finalizing the board:
- Geometry-difference audit has been run (if reference provided)
- Generated mark uses different primary shape vocabulary than the reference
- Generated mark uses a different logo method than the reference
- If the mark failed the audit, the prompt was corrected and the board was regenerated
- The final mark is sufficiently distinct that a designer familiar with the reference would NOT identify it as a derivative

---

## Anti-Slop Rules

These are the patterns AI image generation defaults to when generating brand boards. Fight every single one.

### Layout slop
- Random floating icons on a gradient (the AI's default "brand board")
- Messy collage layout with no clear grid, no gutters, panels overlapping
- Canva template energy - generic rounded rectangles with stock imagery
- Corporate PowerPoint slide energy - bulleted feature lists in panels
- No clear visual hierarchy - everything at the same scale and weight

### Logo slop
- Overdesigned logo with too many elements, 4+ colors, ornate detail
- Generic lightning bolt, brain icon, or shield with no strategic connection
- **Logo morphing across panels** - the mark changes shape, gains/loses elements, or shifts proportions between the anchor panel and mockup panels. This is the #1 brand-board quality failure. The mark must be IDENTICAL everywhere.
- Clipart-style icons pretending to be identity marks
- Random animals with no metaphor connection
- Meaningless sparkles or starbursts added for "premium" feel
- Logo only shown once at large scale - must appear at MULTIPLE scales to prove it works

### Palette slop
- Default AI purple-blue gradient glow (unless strategy demands it)
- Random rainbow colors with no system
- More than 3 distinct hues across the entire board
- Neon accents with no restraint
- Pure black (#000000) or pure white (#FFFFFF) as base colors

### Typography slop
- Tiny illegible paragraphs or fake body copy filling panels
- Dense menu items, navigation lists, or lorem ipsum
- Text that exists to fill space rather than communicate
- Inconsistent type families across panels
- Gradient text as a lazy "premium" shortcut

### Content slop
- Em-dashes in any visible copy
- AI copywriting cliches: "Elevate," "Seamless," "Unleash," "Next-Gen," "Revolutionize," "Empower," "Transformative"
- Generic taglines: "Elevate your workflow," "Seamless solutions for modern teams"
- Stock photography energy: handshakes, laptops on desks, aerial city views
- Fake brand names: Acme, Nexus, NovaCore, Quantumly, FlowBit

### Mockup slop
- Full fake dashboards with dense data visualizations
- Cheap glossy 3D device renders
- Multiple devices showing different screens
- Busy app interfaces with many features visible
- Excessive icon grids

### Atmosphere slop
- Meaningless abstract blobs floating in space
- Over-rendered noise that hides the layout
- Cliche robot/AI imagery (glowing circuits, digital brains)
- Stock-template brand board energy
- Overbusy scenes with too many subjects

---

## Text Rules

Use very little text in the generated board. Text is expensive in AI-generated images - it competes with the visual system for attention and is prone to rendering errors.

**Good text to include:**
- Brand name (wordmark)
- One tagline (under 8 words)
- One URL (brandname.com)
- One terminal command or install line
- 2-5 small panel labels
- Short UI element text (button labels, input placeholders)

**Bad text to avoid:**
- Paragraphs of any length
- Fake body copy or lorem ipsum
- Dense menu items or navigation lists
- Tiny text that exists to fill space
- Long marketing descriptions
- Unreadable labels below 8pt equivalent

Text should be large enough to read at the generated resolution and sparse enough that removing any piece would be noticed.

---

## Photographic Direction

When a panel requires photography or atmospheric imagery, it must be art-directed to match the brand strategy. Do not use generic visual filler.

**Good image direction:**
- Cinematic landscapes color-graded to the brand palette
- Product closeups with controlled lighting and brand-colored surfaces
- Architectural scenes matching the brand's spatial energy
- Material textures (paper, metal, stone, fabric) in palette-matched tones
- Halftone or duotone treated photographs
- Abstract but controlled compositions with brand geometry
- Nature imagery (fields, forests, skies, water) tonally matched to the brand palette
- Macro crops of organic textures (grass, leaves, stone, fabric) as atmospheric fills

**Bad image direction:**
- Generic stock photography (handshakes, laptops, city aerials)
- Random nature imagery unconnected to the brand's palette or metaphor
- Cliche robot/AI imagery (glowing circuits, digital brains)
- Overbusy scenes with too many subjects
- Images that could belong to any brand

The image must feel like it was shot for this specific brand, even though it was generated.

### → Visual World Threading

The brand's visual world - its atmospheric imagery, textures, and environmental photography - must thread through MULTIPLE panels, not appear in just one "World" panel. This is what separates studio-grade boards from generic AI output.

- The Anchor panel can use the brand's visual world as a background behind the logo
- Proof panels (mockups) should show the visual world through device screens or as wallpaper
- The logo mark itself can contain the visual world (if using Method 6: Image-Filled Letterform)
- Color system panels can reference the visual world as the source of the palette
- The World panel gets the purest, most atmospheric expression of the imagery

The visual world is not decoration - it is the brand's PLACE. It answers: "Where does this brand live?" A nature-tech brand lives in sunlit meadows. A security brand lives in dark control rooms. A luxury brand lives in stone and leather. Thread that world through every panel where it fits naturally.

---

## Mockup Direction

When panels show the brand applied to digital or physical surfaces, the mockups must be minimal and believable. Mockups are identity applications - they prove the system works at scale. They are not feature demos.

One mockup per panel. One surface per mockup. Simple enough to believe.

### → Website Hero Mockup (not just browser chrome)

When including a digital application panel, do NOT just show an empty browser bar with navigation dots. Show an actual website hero section with real content:
- Navigation bar with logo mark on the left + 3-4 nav items (Research, Products, About, etc.) + CTA button
- Hero headline: 5-10 words, brand-specific, in the display typeface at large scale
- Supporting subhead: 1 line of context
- Primary CTA button in the brand accent color
- Optional: trust badges, "Trusted by" logos, or a small product visual

This must look like a real landing page someone would visit, not a wireframe. The hero composition itself should vary - not always left-text / right-image. Centered-over-background, bottom-left overlay, stacked-center are all valid.

### → Social Media Profile Mockup

This touchpoint is missing from most AI brand kits and immediately makes the output feel more real. Include a social media profile card (Twitter/X style) showing:
- **Avatar**: the brand logo mark in a circle
- **Display name**: brand name in bold
- **Handle**: @brandname
- **Bio line**: brand tagline or one-line description
- **Stats**: "X posts" · "X following" · "X followers" with plausible numbers
- **Join date**: "Joined [month] [year]"
- **Optional**: header image in brand style (brand-world image, gradient, or pattern)
- **Optional**: "Edit profile" button or "Follow" button depending on perspective

The card should use a dark or light background matching the board's canvas tone.

### → App Icon Mockup

Show the brand logo mark as an app icon on a realistic home screen dock:
- Rounded-rectangle icon (iOS style) with the logo mark centered
- Background color from brand palette (not always dark - match the mode)
- Appropriate padding so the mark doesn't touch the icon edges
- Shown alongside 3-4 other recognizable app shapes in the dock (Messages, Camera, Music, Settings)
- Optional: notification badge with a small number

The icon must be recognizable at actual app-icon size - this is the favicon test in action.

### → Physical Mockup Specifications

Physical objects must look tangible and believable, not like flat vector illustrations:

**Business card:**
- Show front face: logo, person's name, title, email, phone
- Optionally show back face with just the logo mark centered
- Multiple color variants prove the system's flexibility (dark/light/brand-color)
- Card proportions: standard 3.5" × 2" ratio

**Product packaging:**
- Box at 3/4 angle showing two faces
- Logo + tagline visible on the primary face
- Brand color as box surface or as accent detail
- The box should look like something you'd actually unbox

**Branded merchandise:**
- Hoodie or tee with logo placement on chest (left chest small, or center large)
- Clean garment - dark or light fabric, no busy pattern
- The logo must read clearly on the fabric

**Membership/ID card:**
- Credit-card proportions (3.375" × 2.125" ratio)
- Chip detail (gold or silver rectangle, top-left)
- Member number (realistic format: 0017 8200 5731)
- Logo mark and brand name
- Brand color as card background or accent strip

**Circular badge/stamp:**
- Logo mark centered in a circle
- Brand name or tagline running around the perimeter as border text
- Works as a seal, authentication mark, or brand stamp

### → Bad Mockups (Hard Bans)

- ❌ Full fake dashboards with dense data visualizations
- ❌ Cheap glossy 3D device renders with unrealistic reflections
- ❌ Multiple devices showing different screens in the same panel
- ❌ Busy app interfaces with many features visible
- ❌ Excessive icon grids
- ❌ Generic device frames with no branded content inside them
- ❌ Browser chrome with just navigation dots and nothing inside

### → Color System Panel Guidance

The color system panel is not just swatches - it is a designed artifact that shows the palette as a system.

**Default approach (use unless the mode specifies otherwise):**
Named color chips with hex codes - each swatch is a rounded rectangle or circle with the color name in small caps above and the hex code below. Example: "Deep Navy" above, "#1A2744" below. ALL palette colors shown together.

**Alternative approaches:**
- Full gradient tint-to-shade strips - each brand color shown from its lightest 5% tint to its darkest 95% shade as a horizontal bar (Thesis reference style)
- Material chips or paint swatches arranged as a stepped cascade
- Stacked horizontal bars showing proportional color usage (primary = widest)
- Color-on-color combinations showing accessible text/background pairings

The color panel MUST include actual hex values or clear color names. An unlabeled row of colored squares is not a system - it is a decoration.

### → Typography Specimen Panel Guidance

The typography panel is NOT optional filler. It is a system artifact.

**Required elements (include at minimum):**
- Large "Aa" in the display typeface
- Weight scale showing at least: Light, Regular, Medium, Bold (listed vertically with the corresponding weight rendering)
- Number row: 0 1 2 3 4 5 6 7 8 9
- Typeface name (e.g., "NORI Display" or "Inter")

**Optional elements:**
- Full alphabet row (A B C D ... X Y Z)
- Primary/secondary pairing demonstration (display + body side by side)
- Large pull-quote set in the display typeface
- Special characters or ligatures if the typeface has them

The specimen must prove the typeface was chosen deliberately, not defaulted to. If you can't name the typeface family, the typography direction isn't specific enough.

---

## Reference Usage Protocol

When the user provides reference images, first determine the **reference mode** before proceeding.

### → Step 0: Determine Reference Mode

| Mode | User signal | What it means |
|---|---|---|
| **Inspiration** | "like this", "this style", "this quality", "inspired by", reference shows someone else's brand | The user admires this work and wants the same STANDARD. Do not copy the logo or content. |
| **Asset** | "this is my logo", "use this logo", "build around this", "here's our mark", "convert this to a brand kit", reference shows the user's OWN logo/mark | The user designed or owns this logo and wants a full brand system built around it. PRESERVE the logo exactly. |

If ambiguous, ask: "Should I build a new logo inspired by this reference, or preserve the exact logo from this image?"

---

### → Mode: Inspiration (default)

Extract quality signals but do not copy content.

**Extract from references:**
- Grid structure and gutter proportions
- Canvas color and texture treatment
- Typography scale (ratio of heading to label)
- Visual density (how much of each panel is filled)
- Logo placement and sizing relative to panel
- Amount and type of text present
- Image treatment (color grading, halftone, overlay style)
- Accent color logic (how many, where used)
- Panel role distribution (which panels serve which purpose)

**Do not copy from references:**
- The exact logo or brand mark
- The exact brand name or tagline
- The exact panel composition or arrangement
- The exact color values
- Any unique visual asset or illustration

Use references as quality calibration, not as templates. The generated board should match the reference's STANDARD, not its CONTENT.

**Logo Anti-Cloning Protocol (Inspiration mode only):**

The AI model will default to reproducing the reference logo's geometry with minor tweaks. This is not a new logo - it is plagiarism.

**The geometry-difference test:** Describe the reference logo's geometry in one sentence, then describe YOUR logo's geometry in one sentence. If both sentences use the same primary shape vocabulary (e.g., both say "crossed bars" or "overlapping diamonds"), your mark is a clone. Start over with a DIFFERENT logo method.

**Rules:**
1. If the reference has a geometric/abstract mark → your mark MUST use a different logo method entirely
2. If the reference has a monogram → your monogram MUST use a different letter AND different construction technique
3. If you catch yourself describing a mark that "echoes" or "is inspired by" the reference logo - that is a clone. Stop. Pick a different method.
4. The prompt must explicitly state: "The logo must NOT resemble [describe reference logo geometry]. Use [your chosen different method] instead."
5. Never describe the reference logo in positive terms in the prompt ("similar to", "inspired by"). Only describe it in negative terms ("NOT like", "avoid", "different from").

---

### → Mode: Asset (user's own logo)

The user has provided THEIR logo. The goal is to build a complete brand system around this existing mark. The logo is sacred - preserve it exactly.

**Step 1: Format Check**

The image model cannot visually interpret vector or document formats. If the user provides any of these, render to PNG FIRST before proceeding:

| Format | Action |
|---|---|
| `.svg` | Render to PNG at 1024px wide (use a browser, Inkscape CLI, or ImageMagick). The model CANNOT see SVG path data. |
| `.pdf`, `.ai`, `.eps` | Export/rasterize to PNG. |
| `.png`, `.jpg`, `.webp` | Ready to use directly. |

If you cannot render the file, tell the user: "I can't visually read SVG/vector files. Can you export it as a PNG so I can see the actual mark?"

**Step 2: Analyze and describe the mark**

1. **Analyze the mark.** Describe its geometry precisely: shape count, arrangement, colors, proportions. This becomes the frozen logo description (§ Logo Consistency Protocol).

2. **Do NOT redesign, simplify, or "improve" the mark.** The user designed it or paid for it. Respect it. Even if it violates the 3-primitive cap or other logo constraints - those constraints are for logos the skill GENERATES, not logos the user PROVIDES.

3. **Write the frozen description from the reference image.** Study the mark and produce the most precise geometric sentence possible. Include exact shape count, spatial arrangement, color placement, and proportions.

4. **Build the brand strategy AROUND the mark.** Extract the logo's visual DNA - is it geometric? organic? monogram? - and let that inform the mode selection, palette, typography, and image-world direction.

5. **Paste the frozen description into every panel assignment.** The mark must appear identical across the board - anchor, mockups, app icon, social, physical. Use the same anti-morphing protocol as for generated logos.

6. **Skip the Logo Concept Method and Reduction Ladder.** Those phases are for designing new logos. When the user provides the logo, jump from Phase 1 (Strategy) directly to Phase 2's non-logo categories (mode, layout, canvas, typography, palette, tagline).

7. **Skip logo anti-cloning checks** in the Visual Diff and Pre-Flight. The cloning checks exist to prevent copying SOMEONE ELSE'S logo. When the user provides their own, faithful reproduction is the goal.

8. **Existing product mockups.** If the user's brief mentions specific features (e.g., "smart briefings", "shredder", "analytics dashboard"), the application mockup panels must reference those REAL features - not invent generic UI. Pull feature names, navigation labels, and UI patterns from the brief. If the user has provided screenshots or the product is accessible, match the actual UI style (sidebar layout, color scheme, component style). A brand kit for a real product with fake generic screenshots undermines the entire board.

---

## Active Baseline Configuration

These dials calibrate the engine's output. They are defaults. Adapt dynamically from the brief.

```
BRAND_DEPTH:          9   (1=surface decoration, 10=deep strategic identity)
LOGO_SIMPLICITY:      8   (1=complex illustration, 10=extreme reduction)
VISUAL_RESTRAINT:     8   (1=loud and busy, 10=sparse and quiet)
GRID_DISCIPLINE:      9   (1=loose organic, 10=strict presentation grid)
SYMBOL_MEANING:       9   (1=arbitrary decoration, 10=every element justified)
PALETTE_CONTROL:      9   (1=many colors, 10=tight monochrome + one accent)
TEXT_SPARSITY:        8   (1=lots of copy, 10=almost no text)
DETAIL_SUBTLETY:      7   (1=no craft details, 10=many hidden details)
```

Adapt from the brief:
- "Playful" or "fun" → reduce VISUAL_RESTRAINT to 5-6, allow brighter palette
- "Corporate" or "enterprise" → increase GRID_DISCIPLINE to 10
- "Creative studio" or "agency" → reduce GRID_DISCIPLINE to 6-7, increase detail
- "Luxury" → maximize VISUAL_RESTRAINT and PALETTE_CONTROL
- "Gaming" or "competitive" → reduce VISUAL_RESTRAINT to 4-5, increase PALETTE_CONTROL accents
- The user's brief always overrides defaults
- Mode 11 (Warm Editorial) → reduce VISUAL_RESTRAINT to 6, increase DETAIL_SUBTLETY to 8
- Mode 12 (Saturated Studio) → reduce VISUAL_RESTRAINT to 4-5, reduce PALETTE_CONTROL to 5-6
- Mode 13 (Soft Gradient) → increase VISUAL_RESTRAINT to 9, increase PALETTE_CONTROL to 8
- Mode 14 (Bold Neon) → reduce VISUAL_RESTRAINT to 3-4, reduce PALETTE_CONTROL to 4-5, increase DETAIL_SUBTLETY to 9

---

## Pre-Flight Checklist (25 Points)

Run this BEFORE rendering the final board. Walk every item. Any failure means correcting the prompt and re-rendering.

### Logo Quality (6 checks)
- [ ] 1. Is the logo describable in one sentence of geometry? ("It's a [shape] [operation] a [shape]")
- [ ] 2. Does the logo use ≤3 geometric primitives?
- [ ] 3. Would the logo be recognizable at 16×16 pixels (favicon test)?
- [ ] 4. Does the logo work in both black-on-white and white-on-black (inversion test)?
- [ ] 5. Is the logo free of ALL items in the Logo Anti-Patterns list?
- [ ] 6. Can the construction be shown as ≤3 guide shapes?

### Board Composition (6 checks)
- [ ] 7. Does every panel serve a DIFFERENT function? (no two panels doing the same job)
- [ ] 8. Is there visual rhythm - quiet panels alternating with loud panels?
- [ ] 9. Is at least one panel image-dominant (80%+ image)?
- [ ] 10. Is at least one panel type-dominant (tagline/specimen)?
- [ ] 11. Is there at least one panel showing the logo genuinely SMALL (favicon, app icon, social avatar)?
- [ ] 12. Are at least 3 different composition anchors used across panels?

### Brand System Coherence (5 checks)
- [ ] 13. Does the accent color repeat across ≥3 panels?
- [ ] 14. Is the image-world conceptually connected to the brand thesis / core metaphor?
- [ ] 15. Is the color system shown as a designed object with hex values or color names (not random unlabeled swatches)?
- [ ] 16. Is there a typography specimen with at least 2 weights shown?
- [ ] 17. Does the tagline pass the transplant test? (Would it sound wrong on a competitor's board?)

### Anti-Slop (5 checks)
- [ ] 18. Is the board free of purple-blue AI gradient glow (unless strategy justifies it)?
- [ ] 19. Is the board free of floating 3D objects in empty space?
- [ ] 20. Is the board free of generic stock imagery or cliché AI visuals?
- [ ] 21. Is the board free of lorem ipsum, gibberish text, or paragraphs of fake copy?
- [ ] 22. Is the board free of overcomplicated logo marks with >3 elements?

### Physical Reality (3 checks)
- [ ] 23. Is there at least one physical touchpoint (card, box, badge, merch, seal)?
- [ ] 24. If a website mockup exists, does it show an actual hero section with content (not just browser chrome with dots)?
- [ ] 25. If a social media mockup exists, does it have avatar, handle, bio, and stats (not just a logo in a circle)?

### Reference Cloning (3 checks - only when user provided reference images)
- [ ] 26. Does the logo use a DIFFERENT geometric construction than the reference logo? (Run the geometry-difference test)
- [ ] 27. Does the logo use a DIFFERENT logo method than the reference? (e.g., if reference used Construction Geometry, you used Negative Space)
- [ ] 28. Did the prompt explicitly include a negative constraint stating what the logo must NOT look like?

**If any checkbox fails, the board is not ready. Fix and re-check before generating.**

---

## Example Interpretations

### Example 1: AI Developer Tool

User: "Generate a brand kit for Kuro, an AI coding agent for senior engineers."

Interpretation:
- **Strategy Brief:** Dark developer-tool identity. Audience: senior engineers. Core metaphor: the scaffold. Emotional promise: quiet confidence.
- **Visual Mode:** Dark Developer / Builder
- **Layout:** 3 × 3 Full Identity System
- **Canvas:** Pure field, near-black `#0a0a0a`
- **Logo Method:** Monogram + Meaning - "K" with a scaffold/frame negative space cut
- **Typography:** Monospace technical + compressed display sans heading
- **Palette:** `#0a0a0a` base / `#1a1a1a` surface / `#f0ede8` text / `#00d4aa` teal accent
- **Tagline:** "What will you build today?" (Interrogative energy)
- **Premium details:** page number '01', construction grid at 15% opacity, terminal command `npm install kuro`, browser chrome with `app.kuro.dev`

### Example 2: Luxury Compliance Platform

User: "Brand kit for TrustPaw, a compliance monitoring tool with a friendly-but-serious tone."

Interpretation:
- **Strategy Brief:** Light editorial identity for compliance. Audience: legal/ops teams. Core metaphor: the watchdog. Emotional promise: trustworthy guardian.
- **Visual Mode:** Light Editorial / Compliance
- **Layout:** 2 × 3 Cinematic Deck Overview
- **Canvas:** Textured paper, warm ivory `#fdfbf7`
- **Logo Method:** Metaphor Fusion - dog silhouette + shield form, reduced to a geometric seal
- **Typography:** Editorial serif + clean sans pairing
- **Palette:** `#fdfbf7` base / `#f5f0e8` surface / `#1a1a1a` text / `#1e40af` deep blue accent + `#b91c1c` crimson secondary
- **Tagline:** "On guard." (Imperative energy)
- **Premium details:** embossed seal texture, small serif labels, badge mockup, warm stationery application

### Example 3: Gaming / Betting App

User: "Brand board for LuckDrop, a mobile game with loot drops and competitive leagues."

Interpretation:
- **Strategy Brief:** Dark gaming identity. Audience: competitive mobile gamers. Core metaphor: the jackpot moment. Emotional promise: electric reward.
- **Visual Mode:** Gaming / Betting / Competition
- **Layout:** 3 × 3 Full Identity System
- **Canvas:** Gradient depth, deep black `#050505` to dark purple `#0d0015`
- **Logo Method:** Metaphor Fusion - dice face + drop shape, neon-outlined mark
- **Typography:** Expressive display, bold and angular
- **Palette:** `#050505` base / `#0d0015` surface / `#f0f0f0` text / `#22c55e` neon green accent + `#eab308` gold secondary
- **Tagline:** "Every drop counts." (Fragment energy)
- **Premium details:** reward chip UI, leaderboard fragment, app icon on dark home screen, gold trophy badge

### Example 4: AI Knowledge Platform (Mode 11 - Warm Editorial)

User: "Brand kit for Athena, an AI research assistant that synthesizes scientific papers."

Interpretation:
- **Strategy Brief:** Warm humanist identity for an AI knowledge tool. Audience: researchers and academics. Core metaphor: the librarian - centuries of human thought organized and accessible. Emotional promise: intellectual warmth and trust. Avoiding cold tech aesthetics and AI-purple.
- **Visual Mode:** Mode 11 - Warm Editorial / Humanist
- **Layout:** 3 × 3 Full Identity System
- **Canvas:** Textured paper, warm cream `#faf5ef`
- **Logo Method:** Construction Geometry - a simple rounded cross inside a circle (reference: Nexus), symbolizing the intersection of knowledge domains
- **Logo Constraints:** 2 primitives (cross + circle). One-sentence: "It's a rounded cross centered in a circle." Favicon-safe: yes.
- **Typography:** Editorial serif (for tagline emphasis) + clean geometric sans (for headings and labels)
- **Palette:** `#faf5ef` base / `#f0e8da` surface / `#1a1a1a` text / `#b8a472` muted gold accent / `#1a2744` deep navy secondary
- **Tagline:** "Every paper. Every connection. *Understood*." (Fragment energy, serif-italic on "Understood")
- **Image-world:** Classical painting panel (Renaissance scholars, botanical illustrations) treated with pixel-mosaic texture. Art IS the brand's intellectual depth argument.
- **Premium details:** serif-italic emphasis word in tagline, social media profile card with @athena_ai handle, editorial website hero mockup with "Try Athena" CTA

### Example 5: Creative Agency (Mode 12 - Saturated Studio)

User: "Brand kit for Lumora, a creative branding agency."

Interpretation:
- **Strategy Brief:** Vibrant studio identity for a branding agency that sells craft. Audience: brand managers and CMOs hiring external creative. Core metaphor: the brand factor - the intersection of strategy and humanistic design. Emotional promise: confidence in craft.
- **Visual Mode:** Mode 12 - Saturated Studio / Agency
- **Layout:** 3 × 3 Full Identity System
- **Canvas:** Branded color field - saturated orange `#ff4d00` as the board canvas
- **Logo Method:** Construction Geometry - overlapping circles forming a flower/petal mark. Construction panel shows the Venn-diagram with labeled concept intersections ("Strategic Vision" + "Humanistic Touch" = "Brand Factor")
- **Logo Constraints:** 3 primitives (3 overlapping circles). One-sentence: "It's three circles overlapping to form a six-petal flower." Favicon-safe: yes.
- **Typography:** Modern geometric sans, strong scale contrast (very large display + very small labels), white text on saturated backgrounds
- **Palette:** `#ff4d00` primary canvas / `#6f2dbd` secondary / `#1a1a4e` dark surface / `#fafafa` text
- **Tagline:** "Design that builds brands that last." (Declarative energy)
- **Image-world:** Noise-gradient textures (mesh gradients with grain), radial gradient burst backgrounds. Zero photography. The brand IS the material.
- **Premium details:** business card mockups in 3 color variants (orange, purple, dark), geometric construction labels, gradient arc color system

### Example 6: Design Feedback Tool (Mode 13 - Soft Gradient)

User: "Brand kit for Thesis, a design feedback tool. Calm, soft gradients, minimal."

Interpretation:
- **Strategy Brief:** Calm tech identity for a design review tool. Audience: product designers and design managers. Core metaphor: the clear thought - feedback without noise. Emotional promise: clarity and quiet confidence.
- **Visual Mode:** Mode 13 - Soft Gradient / Calm Tech
- **Layout:** 3 × 3 Full Identity System
- **Canvas:** Pure field, white `#fafafa` to pale lavender `#f0ecf5`
- **Logo Method:** Construction Geometry - a triangle resting against a rectangle, forming an abstract play/forward shape
- **Logo Constraints:** 2 primitives (triangle + rectangle). One-sentence: "It's a triangle resting against a rectangle." Favicon-safe: yes.
- **Typography:** Clean geometric sans, medium weight, generous letter-spacing
- **Palette:** `#fafafa` base / `#f0ecf5` surface / `#1a1a2e` text / `#3366ff` electric blue accent / `#f08080` soft coral secondary
- **Tagline:** "The clear thought." (Fragment energy)
- **Image-world:** Soft organic gradient blobs (peach-to-blue, lavender-to-periwinkle) as brand atmosphere. Gradients are the visual weather, not decoration.
- **Color system:** Gradient tint-to-shade strips showing the full palette range from 5% tint to 95% shade
- **Premium details:** dark-mode UI variant panel, gradient blob flowing across panel borders, named color chips with hex codes

### Example 7: Creative OS Platform (Mode 14 - Bold Neon)

User: "Full brand system for NORI, a creative design OS for professional designers."

Interpretation:
- **Strategy Brief:** Bold creative-OS identity covering every touchpoint. Audience: professional designers and creative studios. Core metaphor: creative momentum - the OS that moves as fast as the ideas. Emotional promise: boundless creative energy. The brand exists in physical space as much as on screen.
- **Visual Mode:** Mode 14 - Bold Neon / Creative OS
- **Layout:** 6 × 3 Mega System (18 panels)
- **Canvas:** Pure field, true black `#000000`
- **Logo Method:** Construction Geometry - two rounded bars crossing into an X-knot ribbon shape
- **Logo Constraints:** 2 primitives (2 rounded bars). One-sentence: "It's two rounded bars crossing into a knot." Favicon-safe: yes. Shown at 5 scales across the board.
- **Typography:** Full Aa specimen with weight scale (Light / Regular / Medium / Bold) + number row (0-9) + custom display face name
- **Palette:** `#000000` base / `#0a0a0a` surface / `#F5F3EE` text / `#7A5CFF` Electric Purple / `#CCFF00` Neon Lime / `#FF6A4D` Coral Burst / `#4SD6FF` Sky Blue
- **Tagline:** "Focus. Create. Ship." (Imperative energy)
- **Image-world:** Iridescent gradient glass panels + dark product photography (box on dark surface, hoodie flat-lay) + lifestyle shots (card in hand, box on desk)
- **Mega touchpoints:** Logo cover (black bg) + logo on neon lime bg + construction proof + logo pattern tile + website hero + app icon dock + social media profile + notification card + business card + product box + hoodie + membership card + color system (named chips) + typography specimen (Aa + weights + numbers) + process icons (Capture → Organize → Create → Share) + circular badge + campaign tagline + brand-world image
- **Premium details:** ALL color swatches labeled with hex, member number on card (0017 8200 5731), chip detail on card, notification toast with real message

---

## Response Behavior

When the user asks for a brand-kit image, follow this execution flow:

**Phase 0: Visual Reference Acquisition**
1. Ask the user for a reference/inspiration image (if not already provided)
2. If reference provided: analyze for 8 DNA strands (surface, layout, cards, color, type, illustration, logo presentation, signature moves)
3. Generate the REFERENCE INSTRUCTION block (EXTRACT half + BLOCK half)
4. If reference is low-res (<512px), warn but proceed

**Phase 1-2: Strategy & Architecture**
5. Read the brief carefully - extract every signal
6. Write the Brand Strategy Brief (3-5 lines, committed direction)
7. Narrow the symbol pool to 2-3 candidates
8. Pick ONE visual mode from the 14 options
9. Pick ONE option from every remaining Phase 2 category (layout, canvas, logo method, typography, color discipline, tagline energy)
10. Walk the Logo Reduction Ladder - describe the mark's construction
11. Verify logo passes ALL Hard Constraints (§ Logo Hard Constraints) - 3-primitive cap, favicon test, one-sentence geometry, inversion test

**Phase 3-4: Composition & Prompt**
12. Assign panel roles using the Argument Structure
13. Assign composition anchors and energy levels to each panel
14. Plan 3-5 premium details
15. Build the complete Prompt Blueprint - fill in every field
16. If Phase 0 produced a REFERENCE INSTRUCTION block, prepend it to the prompt
17. Include the WHAT THIS IS NOT section with 4+ anti-patterns
18. Run the Anti-Slop check against your prompt
19. Run the 25-Point Pre-Flight Checklist - all must pass before generating

**Phase 5: Generate & Audit**
20. Generate the board image
21. Run the Visual Diff (Phase 5) - every check must pass
22. If any check fails, identify the failure, correct the prompt, and regenerate

**Phase 6: Panel Surgery (if needed)**
23. If 1-2 specific panels fail while the rest pass, diagnose the failure type
24. Generate replacement panels as standalone cards using the Single-Panel Prompt Template
25. Guide the user to composite in Figma (import board → overlay replacement → export)

**Phase 7: Logo Originality Gate (if reference was used)**
26. Run the geometry-difference audit: describe both marks, run vocabulary overlap test
27. Run the visual similarity check: symmetry, shape count, negative space
28. If clone detected: choose a different logo method and shape vocabulary, regenerate
29. If 2 attempts still clone: recommend the Nuclear Option (user designs logo externally, switch to Asset mode)

**Deliver**
30. Deliver the final board with a 2-3 line summary of the identity direction

Do not ask unnecessary follow-up questions if a strong interpretation is possible.
Do not generate without completing Phases 0-4 first.
Do not skip the Pre-Flight Checklist, the Visual Diff, or the Logo Originality Gate (when applicable).

---

## The Core Principles

These are the non-negotiable fundamentals. They apply regardless of which combinatorial picks you make. When any decision conflicts with these principles, the principles win.

> **Strategy before aesthetics.** The brand strategy dictates every visual decision. A board without a clear brand idea is just arranged rectangles, no matter how beautiful they are. If you cannot state the core metaphor in one sentence, you are not ready to generate.

> **The logo must be earned.** The logo is not the first thing you design - it is the last thing the strategy produces. It emerges from the intersection of the brand's action, metaphor, and cultural position. A logo designed before the strategy is a random icon.

> **One board, one idea, one system.** Every panel contributes to a single brand direction. The palette threads through every panel. The logo appears identically wherever it shows. The typography hierarchy is consistent across applications. If you swap the logo for another brand's mark and nothing else feels wrong, the system has no identity.

> **Sparse over busy. Quiet over loud. Intentional over decorative.** Remove until it hurts. Then remove one more element. The board should feel like it has generous space, not cramped density. Premium identity work whispers. Generic AI output shouts.

> **The grid is sacred.** Gutters must be consistent. Edges must align. Panels must relate to each other through proportion, not random sizing. The grid is not a constraint - it is the presentation system that makes the identity feel professional. Break the grid only with a panel bleed, and only once per board.

> **Reward closer inspection.** The board should have 3-5 details that a viewer discovers on second look: a construction line, a page number, a highlighted word, a subtle texture. These details signal craft. But they must not compete with the primary read. Detail is dessert, not the main course.
