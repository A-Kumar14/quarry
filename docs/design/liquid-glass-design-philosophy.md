# Liquid Glass: design philosophy for web UI

This document distills ideas from research into **“Liquid Glass”**—a depth-forward, light-aware glass aesthetic (often associated with recent Apple interface language)—as it can be **recreated in the browser** with CSS, SVG filters, and (optionally) purpose-built libraries. Use it as a **north star** when implementing glassmorphism, refraction, and interactive “material” UI in Quarry’s next design passes.

**Scope:** Visual and interaction *principles*; implementation is composable (vanilla filters vs. a small library). This does not replace Quarry’s **Modern Newspaper** palette and typography rules for body surfaces—use glass as a *layer* (panels, controls, modals) where depth and legibility are intentional.

---

## 1. Why depth exists in interface design

Digital UIs have long used **light, shadow, and translucency** to suggest order, focus, and physical affordance—without always simulating real physics.

| Era / motif | Idea |
|-------------|------|
| **Early desktop** (e.g. Windows 95 metaphors) | Diffused highlights and bevels imply **lift** and **press depth**. |
| **Glossy “gel” UIs** (e.g. classic OS X Aqua) | Strong **specular streaks** and saturated gradients sell **wetness** and **volume**. |
| **Frosted glass** (e.g. Windows Aero) | **Blur + tint** sells **separation** from content behind the pane—less about refraction, more about hierarchy. |
| **Modern real-time UIs** | Materials respond to **motion, orientation, and lighting**—depth feels **dynamic**, not baked into a static bitmap. |

**Design takeaway:** Glass in product UI is not decoration—it communicates **what sits in front**, **what recedes**, and **what demands attention**. Prefer purposeful hierarchy over novelty.

---

## 2. Light and refraction (conceptual anchor)

Real glass bends light at boundaries between materials. **Snell’s law** relates angles of incidence and refraction:

\[
n_1 \sin(\theta_1) = n_2 \sin(\theta_2)
\]

**Design takeaway:** You rarely need explicit numeric simulation in CSS. What matters for UX is the **mental model**: edges and curvature **predictably distort** what’s behind them; distortion should feel **continuous** and **stable** under motion—not noisy or random.

---

## 3. Pillars of browser-native “liquid glass”

### 3.1 Edge profiles (volume and curvature)

Define **functional edge profiles**—how thickness and curvature change from center to rim—so the element reads as a **lens** or **sheet**, not a flat rectangle with blur.

- **Strong rims** read as **mechanical** or **thick**; **soft rims** read as **organic** or **thin**.
- Consistent profiles across related components (cards, sheets, toggles) unify the system.

**Implementation hint:** Combine rounded geometry, inner/outer shadows, and filter regions so the **rim** carries most of the “glass” read while the **body** stays legible.

### 3.2 Displacement maps (vector fields)

A **displacement map** is a **vector field** over the element: often encoded so **red** and **green** channels drive **horizontal** and **vertical** pixel offsets (Cartesian → per-pixel shift). In SVG filter pipelines, this is what makes content **behind** glass appear **refracted**.

**Design takeaway:**

- Displacement should be **smooth**—avoid harsh discontinuities unless mimicking cracked glass (usually wrong for productivity UI).
- **Animate** displacement subtly with pointer movement or tilt so the material feels **alive** without inducing sickness (keep amplitude modest).

### 3.3 Specular highlights (dynamic light)

**Specular** response is the bright, directional reflection of a light source. For interactive UI:

- Use **rotatable or pointer-aligned highlight vectors** so highlights stay **symmetric** and **physically plausible** as the user moves.
- Separate **specular** (sharp, follows “light”) from **diffuse** (soft, follows surface tint)—mixing them cleanly avoids muddy gray plastic.

**Design takeaway:** Highlights sell **glass**; blur+tint alone sell **frost**. Liquid glass typically needs **both**, tuned so text contrast remains acceptable.

---

## 4. Interaction: precision and play

Interfaces that embody this aesthetic benefit from **tight feedback loops**:

- **Buttons, switches, sliders** can expose **small, elastic motion** so refractive distortion reads as **responsive**—not decorative lag.
- **Precision matters:** micro-interactions should reinforce **cause and effect** (e.g. slider thumb movement correlates with highlight/refraction shift).

**Design takeaway:** Motion serves **readability of causality**. Prefer short, damped transitions; avoid competing shimmer on every hover.

---

## 5. Performance and integration

- SVG/CSS filters and displacement can be **GPU-sensitive**; treat **large fullscreen blurs** and **animated displacement** as premium effects—**feature-detect** or reduce on low-power devices.
- Limit stacked filters; prefer **one coherent filter chain** per surface where possible.
- Test **legibility** of article text and citations; glass is allowed **around** reading surfaces more often than **on top of** them.

---

## 6. Implementation libraries

### 6.1 `@hashintel/refractive` (HASH Design)

[**`@hashintel/refractive`**](https://www.npmjs.com/package/@hashintel/refractive) (**HASH Refractive Filter Components** on npm) is a **React** library for **refractive glass UI**: it applies SVG-based refractive filters together with **`backdrop-filter`** so surfaces read as curved glass over whatever sits behind them—aligned with the displacement/specular mental model in §3. Expect **early semver** (`0.0.x`), API churn—confirm **version and peers** on npm before locking.

**Where to read more**

- Package registry: [npm — `@hashintel/refractive`](https://www.npmjs.com/package/@hashintel/refractive)
- Product/docs entry point: [HASH Design — Refractive](https://hash.design/libs/refractive)

**How it tends to be used (conceptually)**

- Wrap native elements or your own components with a **`refractive`** helper (e.g. higher-order component) so props control **rim curvature**, **blur**, **bezel width**, and related **refraction** parameters.
- The library exposes **different filter strategies** for different layout needs—for example a **fixed-profile** path suitable for compact controls (switches, sliders) versus approaches that scale better for **large or dynamic-size** surfaces (e.g. cards, modals) where tiling or flexible filter wiring reduces artifacts.

**Adoption caveats for Quarry**

| Topic | Note |
|--------|------|
| **React version** | Published builds target **React 19** (and matching React DOM). This repo’s app shell is **React 18** ([`CLAUDE.md`](../../CLAUDE.md)); adopting the library may require a **React upgrade** or waiting for compatibility—confirm on npm/README before installing. |
| **Browser support** | Refractive glass here depends on **`backdrop-filter`** combined with **SVG filters**. **Chrome** is the primary well-supported path today; **Firefox / Safari** may show gaps or need **documented fallbacks** (e.g. blur-only or solid tint). Treat glass as **progressive enhancement**. |
| **Layout rules** | Docs emphasize sensible relationships between **corner radius**, **bezel width**, and blur—violating them produces broken rims or clipped displacement. Match tokens to our **12px card radius** policy unless deliberately diverging. |
| **Governance** | Quarry restricts **new npm packages** without review ([`CLAUDE.md`](../../CLAUDE.md)). Propose `@hashintel/refractive` explicitly if a feature depends on it. |

**When it helps:** You want **consistent refractive chrome** (panels, floating controls) without hand-maintaining SVG filter graphs per component. **When to skip:** One-off surfaces are faster with existing **glass-morphism** tokens; full refractive stacks are easy to overuse on text-heavy research views.

### 6.2 Talk reference: `refractive` (pre-alpha narrative)

Chris Feijoo’s presentation introduced a **`refractive`** direction—**pre-alpha on npm** at the time—as a way to ship **performant**, reusable refractive building blocks for the web. **`@hashintel/refractive`** is a concrete, scoped package in that same problem space (browser SVG filters + backdrop composition); treat **version and API** as **source of truth** on npm and HASH Design, not this doc.

---

## 7. Applying this document in Quarry

Quarry optimizes for **epistemic transparency**—sources, disagreement, and provenance—not spectacle.

When implementing “liquid” surfaces:

1. **Glass signals layering:** drawers, modals, tool rails—not the primary reading column unless contrast is proven.
2. **Refraction and highlights** accent **interactive chrome** (inputs, tabs, toggles), not evidentiary text.
3. **Displacement amplitude** stays subtle on dense screens (Explore panels, chat) to preserve scanability.
4. **Motion** reinforces **state** (open/closed, active track) rather than ambient noise.

---

## 8. Checklist for new features

- [ ] Is glass serving **hierarchy** or only **style**?
- [ ] Are **edge profile**, **blur**, and **specular** balanced so **WCAG contrast** is preserved for body copy?
- [ ] Does **motion** map to **input** (pointer, keyboard, layout state)?
- [ ] Is there a **reduced-motion** or low-effect path?
- [ ] Are filters **scoped** to avoid jank on scroll-heavy views?

---

## References (conceptual)

- Historical UI depth: diffused desktop metaphors → glossy OS aesthetics → frosted compositing → dynamic materials.
- Physical basis: refraction (Snell’s law); perceptual goal is believable continuity, not textbook accuracy.
- Technical stack in-browser: SVG filter graphs, displacement maps, layered highlights; optional **[`@hashintel/refractive`](https://www.npmjs.com/package/@hashintel/refractive)** for encapsulated React refractive UI (verify React/browser constraints and team approval before adding the dependency).

---

*Document purpose: align future Quarry UI work with a shared vocabulary for glassy, refractive, motion-aware surfaces—compatible with the product’s newspaper-inspired palette and transparency-first mission.*
