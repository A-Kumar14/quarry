# Quarry Design Philosophy

A living document that governs every UI and UX decision in this codebase.
Before implementing any prompt, check alignment with these principles.

---

## Core Mandate

Quarry is a **research AI** — not a consumer chatbot. Every design decision must reinforce credibility, clarity, and speed. Complexity lives in the backend; the surface must feel effortless.

---

## 1. Color Palette

- **Maximum 3–4 colors.** Current palette: parchment background (`#EDE8DF`), warm dark text (`#1a130a`), amber/orange accent (`#f97316`), muted secondary (`#9a8570`).
- No neon, no gradients for decoration, no "AI purple/blue" clichés.
- Color is used to **signal meaning** (green = positive, red = error, orange = interactive), never for visual flair.
- Dark mode mirrors the same restraint — terminal black with amber, not a rainbow.

**Reject if:** a prompt introduces new brand colors, glows, or decorative gradients.

---

## 2. Typography

- **Two typefaces maximum.** A monospace face (`Courier New`) for data/labels/tickers, a humanist sans for body text. No display fonts.
- Font sizes: body `0.84–0.88rem`, labels `0.54–0.72rem`, headings `1.0–1.6rem`. Nothing larger without strong justification.
- Line height `1.6–1.8` for reading comfort. Letter-spacing only on uppercase labels.
- Hierarchy is achieved through **weight and size**, not decoration.

**Reject if:** a prompt calls for multiple font families, hero-size display text, or decorative lettering.

---

## 3. Layout & Structure

- **Content-first.** The answer, data, or visualization occupies the primary viewport. Navigation is secondary.
- Clear logical hierarchy: page title → context → primary content → supporting content → actions.
- Use whitespace to separate sections, not borders or cards everywhere.
- Cards (`GlassCard`) are for **grouping related data**, not decoration.
- Max content width: `1100px` for results, `560px` for settings/forms.

**Reject if:** a prompt adds decorative containers, nested cards with no semantic purpose, or breaks the established grid.

---

## 4. Hero / Landing State

- The idle/home state must immediately demonstrate capability — trending research cards with real images and headlines, a prominent search bar, no login wall.
- "Above the fold" = the search interface. Users should be able to start a query within 2 seconds of landing.
- No splash screens, loading animations on initial paint, or marketing copy in the primary viewport.

**Reject if:** a prompt adds onboarding modals, hero banners, or delays the search experience.

---

## 5. Interactivity & Components

- Every interactive element must have a **clear purpose**. Tabs only when content genuinely branches. Toggles only for binary settings. Chips only for actionable shortcuts.
- Hover states: subtle opacity or background shifts (`0.12–0.15s` transitions). No dramatic transforms or bounces.
- Icons: `lucide-react` only, 12–16px, used sparingly to label — not decorate.
- No animations except: streaming cursor blink, marquee scroll, skeleton pulse, and spinner for async states.

**Reject if:** a prompt introduces animations for decoration, icon-heavy layouts, or components that exist purely for visual interest.

---

## 6. Trust & Credibility Signals

- Source citations are always visible and linkable.
- Contradictions, confidence levels, and data freshness are surfaced — not hidden.
- The Finance Terminal shows live prices with timestamps. Research results show source domains.
- No fabricated metrics, placeholder "partner logos," or testimonial sections.

**Reject if:** a prompt adds decorative trust badges, fake social proof, or hides source attribution.

---

## 7. Data Visualization

- Charts and diagrams live in **clean, distinct containers** with clear labels.
- Sparklines: `80×30px` SVG, two-color (green/red), no axis clutter.
- No 3D charts, pie charts, or decorative data art.
- Visualizations must be functional — they answer a question the user has.

**Reject if:** a prompt adds charts for visual richness rather than insight.

---

## 8. Mobile & Accessibility

- All layouts must be responsive. Primary breakpoint: `xs` (mobile-first) → `md` (desktop).
- Tap targets minimum `44×44px`. Font sizes never below `0.62rem` on mobile.
- Semantic HTML where possible (`<form>`, `<button>`, `<a>` with `href`). No `div` click handlers where a native element works.
- Color is never the sole indicator of meaning — always paired with text or icon.

**Reject if:** a prompt introduces fixed pixel layouts, mouse-only interactions, or removes semantic structure.

---

## 9. Performance

- Lazy-load heavy components (e.g., KnowledgeGraph was lazy-loaded, heavy charts should be too).
- No blocking fetches on initial render.
- Images: `object-fit: cover`, defined dimensions, `onError` fallback always present.
- SSE streaming preferred over polling for all AI responses.

**Reject if:** a prompt adds synchronous data dependencies that block page paint, or loads large assets eagerly.

---

## 10. What Quarry Is Not

- Not a marketing site — no hero banners, feature grids, or pricing tables.
- Not a social platform — no likes, shares, follower counts, or feeds.
- Not a dashboard — no KPI cards with vanity metrics, no sidebar navigation trees.
- Not a typical AI chatbot — the interface is a **research terminal**, not a conversation UI.

---

## Decision Checklist

Before implementing any prompt, ask:

1. Does it use only existing palette colors?
2. Does it stay within the two-typeface system?
3. Does it add genuine value to a research workflow, or is it decorative?
4. Does it maintain content hierarchy (answer first, chrome second)?
5. Is every interactive element purposeful?
6. Does it work on mobile?
7. Does it load fast?

If any answer is **no**, push back or propose a compliant alternative.

---

## 11. README Philosophy

A README is the front door of a project. It is the first thing a developer, collaborator, or user reads — and it must earn their attention immediately. These principles govern how Quarry's README should be written and maintained.

### The README has one job: reduce time-to-understanding
Every sentence must answer one of three questions: *What does this do? Why should I care? How do I run it?* If a sentence answers none of these, cut it.

### Lead with a visual and a one-liner
Before any prose, the reader needs a screenshot or demo GIF showing the product in action, and a single sentence that explains what it does. Don't bury the lede in setup instructions.

### Badges are functional, not decorative
Shields (build status, license, version) communicate health and credibility at a glance. Only include badges that are live and accurate. Stale or broken badges are worse than no badges — they signal abandonment.

### Structure follows the reader's journey
The natural reading order mirrors the user's decision funnel:
1. **What is it?** (name, tagline, screenshot)
2. **What can it do?** (feature list or surface overview)
3. **How do I run it?** (prerequisites, installation, env vars)
4. **How do I use it?** (usage examples, command reference)
5. **What's coming?** (roadmap)
6. **Who made it / how do I contribute?** (contact, contributing)

Never frontload installation steps before the reader has decided they want the thing.

### Getting Started must be copy-pasteable
Every command in the installation section must work verbatim on a clean machine. If a step requires prior context, explain it inline. Number the steps. Use code blocks for every shell command.

### Tech stack belongs in "Built With", not the intro
The intro describes the *product experience*. The tech stack is a detail for developers — it belongs in a dedicated section with recognizable shield badges. Don't lead with implementation choices.

### Roadmap is a contract with the reader
A roadmap section builds trust by showing the project is alive and has direction. Use checkboxes: checked for shipped, unchecked for planned. Keep it honest — don't list things you have no intention of building.

### One README per project, kept current
A README that is out of date is misleading. When the product changes (new features, new setup steps, deprecated commands), update the README in the same commit. Treat it as code, not documentation afterthought.

### Length: as short as possible, as long as necessary
The Best-README-Template is comprehensive — but not every section applies to every project. Include a section only if it genuinely helps the reader. A focused 150-line README is better than a padded 400-line one.
