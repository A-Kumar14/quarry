# UI change inventory — React Bits replacements (modern, non-background)

**Scope:** Small components only. **Do not** swap page-level backgrounds or full-screen Backgrounds from React Bits.

**Install pattern:** `npx shadcn@latest add @react-bits/<Name>-<JS-CSS|JS-TW|TS-CSS|TS-TW>` — see [reactbits.dev](https://reactbits.dev). Prefer **JS-CSS** or **TS-CSS** if Tailwind is not wired through the component tree; map colors to Quarry tokens (`--accent` / `#F97316`, glass, sepia).

**Registry categories used:** `Components`, `Animations`, `TextAnimations` — **not** `Backgrounds`.

**Stack notes:** CRA + MUI + inline/`sx` styling. Heavy bits (`FluidGlass`, WebGL-style text, large galleries) — add one at a time and measure.

---

## A. Converse / chat (`frontend/src/components/chat/`, `frontend/src/pages/ConversePage.js`)

### What reads “vibecoded” today

| Area | Location | Pattern |
|------|----------|---------|
| Streaming loader | `MessageThread.js` — `WaveLoader` | Orange bar wave + mono “thinking…” |
| Assistant chrome | `AssistantMessage` | ALL CAPS mono “Quarry · working…” label |
| Chain-of-thought | `ChainOfThought.js` | Timeline dots + ▶ chevron + green “done” spine |
| Actions | `ActionBtn` / `CopyButton` | Tiny mono pills, unicode glyphs (⎘ ⎋ ⊞) |
| Composer | `InputBar.js` | Dark slab + tiny square send + mono hints |
| Branch pill | `MessageThread` branch strip | Orange badge `⎇ branch` |
| Drawer | `ResearchDrawer.js` | Bottom sheet + underline tabs + flat source rows |
| Sidebar | `ConverseSidebar.js` | Flat list + orange “+ New” chip |

### React Bits mapping (chat)

| Priority | Current | Suggested React Bits | Notes |
|----------|---------|---------------------|-------|
| 1 | Chain-of-thought timeline | **`Stepper`** (Components) | Clearer active/complete than custom dots + pulse |
| 2 | Research drawer tabs | **`PillNav`** or **`GooeyNav`** (Components) | Segmented/pill nav vs underline tabs; **PillNav** = calmer |
| 3 | Message list entrance | **`AnimatedList`** + **`AnimatedContent`** (Animations) | Stagger/fade new rows |
| 4 | Empty thread | **`FadeContent`** (Animations) | Softer entrance for placeholder copy |
| 5 | Streaming emphasis | **`StarBorder`** or **`ElectricBorder`** (Animations) | Thin border on assistant card **while streaming**; prefer **StarBorder** if electric feels too “gamer” |
| 6 | “Working” header line | **`ShinyText`** or **`GradientText`** (TextAnimations) | Subtle shine on one line, not whole page |
| 7 | Fork / Copy / Research row | **`BubbleMenu`** (Components) | Collapse actions into one control (esp. narrow widths) |
| 8 | Composer inner shell | **`GlassSurface`** or **`FluidGlass`** (Components) | Frosted wrapper around textarea — **not** replacing page bg |
| 9 (optional) | Source rows in drawer | **`SpotlightCard`** or **`DecayCard`** (Components) | Card-like rows; keep sepia/orange, avoid neon |

### Skip / defer (chat)

- **`Backgrounds/*`** — excluded by product direction.
- **`Dock`** — high layout impact on composer unless redesigning bottom chrome.
- **`MagicBento`**, **`DomeGallery`**, **`ModelViewer`** — wrong scale for chat chrome.

### Optional (non–React Bits)

- **`ChainOfThought`** detail collapse: align with existing **`accordion`** / Radix patterns in `frontend/src/components/ui/` for a11y.

---

## B. Sources page (`frontend/src/pages/SourcesPage.js`)

### Small components and patterns

| Component / area | Lines (approx.) | What it is |
|------------------|-----------------|------------|
| **`QualityBadge`** | ~56–68 | Pill: uppercase quality label, tinted border/bg |
| **`CopyButton`** | ~70–80 | Text button + Lucide icons (duplicate of chat pattern) |
| **`SourceCard`** | ~83–184 | Glass card: favicon, title, domain, query tags, note tags (✍️), remove, copy/open |
| **`LibraryModal`** | ~187–346 | Full-screen overlay, header, search field, **pill toggles** (sort: Recent / Quality / A–Z; filter: All / High / Medium / ?), scrollable list |
| **`TopicMapModal`** | ~351–917 | Large modal: dual search inputs (highlight + focus map), **Run** button, **link-type chip** row, **CSS spinner** + “AI is mapping…”, `ForceGraph2D`, side panel with node detail, connection cards, strength dots, linked source links |
| **`EntryCard`** | ~948–1027 | Hero tiles on page: `GlassCard`, icon badge, serif title, stat row with orange dot |
| **`StatsBar`** | ~1030–1131 | KPI `GlassCard`s: big mono numbers; **segmented credibility bar**; **Top Domains** list with `#1` rank |
| **`RecentSourcesPreview`** | ~1134–1216 | Section header + “View all →”; glass rows with dot, favicon, **QualityBadge**, hover slide |
| **Inline SVGs** | ~920–945 | `LibrarySVG`, `NetworkSVG` watermarks in entry cards |

### What reads generic / “AI UI” slop

- Repeated **pill buttons** for sort/filter (same visual for three dimensions — Recent/Quality/A–Z and All/High/Medium/?).
- **Spinner + generic “AI is mapping…”** loading copy (fine functionally; visually stock).
- **Three-dot “strength” indicator** on topic links — reads like a stub widget.
- **Emoji in note chips** (`✍️`) — slightly discordant vs editorial tone.
- **Dual bordered inputs** in Topic Map header (highlight vs focus) — same chrome repeated; could be unified + labeled more clearly in layout, not just two boxes.

### React Bits mapping (sources)

| Priority | Current | Suggested React Bits | Notes |
|----------|---------|---------------------|-------|
| 1 | Library modal sort + filter pills | **`PillNav`** (Components) | One segmented control per dimension or a compact **GooeyNav**-style group — reduces “six identical pills” noise |
| 2 | Library search + Topic Map search/focus fields | **`GlassSurface`** (Components) | Single frosted **input group** pattern; pair with clear labels (Highlight vs Refocus) |
| 3 | `StatsBar` big numbers | **`Counter`** (Components) | Animated count-up on total sources / domains / notes (subtle, one-time on mount) |
| 4 | `EntryCard` hero tiles | **`SpotlightCard`** or **`TiltedCard`** (Components) | Replace flat hover lift with spotlight/tilt depth; keep orange hover border intent |
| 5 | `SourceCard` + preview rows | **`SpotlightCard`** / **`DecayCard`** (Components) | Slightly richer card treatment than plain glass + borders |
| 6 | `RecentSourcesPreview` list | **`AnimatedList`** (Animations) | Stagger row appearance when section mounts |
| 7 | Topic map loading overlay | **`FadeContent`** + lightweight loader | Keep spinner or swap for **`StarBorder`** frame around graph area during load — **do not** replace `ForceGraph2D` canvas |
| 8 | Topic map link filter chips | **`PillNav`** (Components) | Same family as Library for consistency |
| 9 | Section titles (“Recent Sources”, uppercase labels) | **`ShinyText`** or **`GradientText`** (TextAnimations) | Single accent line only — avoid decorating every label |

### Skip / defer (sources)

- **`ForceGraph2D`** graph interior — not a React Bits swap; particle links are custom D3/canvas.
- **Modal backdrop** (`rgba` + blur) — page background unchanged; OK to polish **edges** with **GlassSurface** on the sheet only.
- **`ChromaGrid`**, **`CircularGallery`**, **`Dock`** — overscale for this page.

### Optional (non–React Bits)

- Replace ✍️ with a small Lucide **`PenLine`** / **`FileText`** icon for note chips (consistent with rest of page icons).

---

## C. Notes / Write (`frontend/src/pages/WritePage.js`)

**Routes:** `/notes`, `/notes/:id`, `/write` (same component).

### Small components and patterns

| Component / area | Approx. lines | What it is |
|------------------|---------------|------------|
| **`ResearchSourcePill`** | ~264–356 | Draggable source row: favicon box, tier dot/label, colored **lean** micro-badge, hover glow |
| **`AIParagraphCard`** | ~358–414 | “AI Summary” uppercase label, **Loader2** spin, **pulse** skeleton bar, textarea, “↕ drag” hint |
| **`DrawerClaimRow`** | ~416–461 | Status dot + clamped claim + tiny **Insert** pill button |
| **`CitationPicker`** | ~465–530 | Glass popover: header, search row, empty state + `GLASS_BTN` “Search now”, claim list |
| **`AIFormatterPopup`** | ~533–610 | Fixed glass panel, **horizontal scroll** template cards, “Apply Template” bar, **dot pager** footer (inactive dots only) |
| **`NotesSidebar`** | ~613–779 | Collapsible rail, **+ New note**, grouped list (Today / Yesterday / Earlier), active row tint, **Chevron** collapse orb, **portal** context menu (Delete) |
| **Top chrome** | ~1406+ | Repeated **`GLASS_BTN`** / **`GLASS_BTN_ACTIVE`**: notes link, import, drawer toggle, export, focus mode |
| **Slim format toolbar** | ~1525–1606 | Markdown-ish buttons + image + **word count / read time / grade** + `⚑` flags + `⚠` unsourced |
| **Floating toolbar** | ~1692–1770 | Glass pill: B/I/U/H1–3/quote + link + highlight |
| **Focus overlays** | ~1772–1813 | Bottom hint toast; **focus-word-overlay** mono stats with `:has()` hover hack |
| **Drawer toggle (closed)** | ~1816–1839 | Fixed tab with **three dots** |
| **Right research drawer** | ~1843+ | “Search for your topic” orange mini-button, dashed empty state, **Selected Sources Tray**, `AIParagraphCard` stack, sections with **`SECTION_LABEL`** |

### What reads generic / “AI UI” slop

- **AI Formatter** carousel + generic “Apply Template” + undifferentiated dot indicators (not wired to scroll position).
- **Pulse** skeleton + **Loader2** for summaries — same vocabulary as every AI product.
- **Emoji-style** symbols (`⚑`, `⚠`) mixed with Lucide elsewhere.
- **Three-dot** drawer grip — reads like a placeholder affordance.

### React Bits mapping (notes)

| Priority | Current | Suggested React Bits | Notes |
|----------|---------|---------------------|-------|
| 1 | `ResearchSourcePill` rows | **`SpotlightCard`** or **`GlassIcons`** (Components) | Spotlight hover on rows; **GlassIcons** if you collapse favicon + tier into an icon strip |
| 2 | `AIFormatterPopup` template carousel | **`Carousel`** or **`ScrollStack`** (Components) | Replace hand-built horizontal scroll; keep card copy inside |
| 3 | Formatter footer dots | Tie to carousel **or** use **`Stepper`**-style progress for active template | Avoid inert dots |
| 4 | `CitationPicker` shell + search | **`GlassSurface`** (Components) | Unify blur/border with Converse composer |
| 5 | Floating selection toolbar | **`BubbleMenu`** (Components) | Optional: radial/compact menu for format actions |
| 6 | `NotesSidebar` list mounts | **`AnimatedList`** (Animations) | Stagger note rows per section |
| 7 | Slim bar stats / flags | **`ShinyText`** on one metric only — or **`CountUp`** (TextAnimations) for word count | Rest stay quiet |
| 8 | Summary loading | **`FadeContent`** for text appearance; keep skeleton minimal or **`StarBorder`** on card edge only | |
| 9 | Closed-drawer grip | **`Magnet`** or **`GlareHover`** (Animations) | Subtle affordance on the tab — or replace dots with Lucide **`PanelRightOpen`** |

### Skip / defer (notes)

- **`contentEditable`** / document surface — do not wrap in heavy 3D/card effects.
- **Research tray** drop zone — behavior-first; optional **ElectricBorder** on drag-over only.

### Optional (non–React Bits)

- Replace `⚑` / `⚠` with **`Flag`** / **`AlertTriangle`** (Lucide) for consistency.

---

## D. Settings (`frontend/src/pages/SettingsPage.js`)

**Route:** `/settings`.

### Small components and patterns

| Component / area | What it is |
|------------------|------------|
| **`Toggle`** | Custom iOS-style switch (orange when on) |
| **`Row`** | Icon + label + description + right control |
| **`SectionLabel`** | Uppercase mono-ish section header |
| **`Card`** | Glass panel wrapper |
| **`DangerRow`** | Two-tap destructive pattern + red-tint confirm button |
| **`PillSelect`** | Stacked **pill cards** for model + deep depth (label + subline per option) |
| **API key block** | Mono input + **Save** orange button + eye toggle |
| **Toast** | Fixed bottom green pill (“API key saved”, etc.) |
| **Footer** | `Quarry · AI Research Engine · v2.0` mono |

**Note:** Page uses the same **full-viewport gradient** as Profile — user asked not to change **backgrounds** in the React Bits sense; treat gradient as product chrome unless you intentionally standardize later.

### What reads generic

- **`PillSelect`** as multi-line cards can feel like pricing tiers / model-picker clone.
- **Toast** styling is fine but anonymous (same as thousands of apps).

### React Bits mapping (settings)

| Priority | Current | Suggested React Bits | Notes |
|----------|---------|---------------------|-------|
| 1 | `PillSelect` (model / depth) | **`PillNav`** or segmented **`Stepper`**-style selector (Components) | Clearer single-selection without “three product cards” |
| 2 | Settings `Card` surface | **`GlassSurface`** (Components) | Consistent frosted panels with Notes/Converse |
| 3 | `Toggle` | Keep custom or use **`ElasticSlider`** only if it matches a11y — often **Radix/shadcn Switch** is enough | React Bits has no dedicated switch |
| 4 | Success toast | **`FadeContent`** + **`AnimatedContent`** (Animations) | Enter/exit polish without new color system |
| 5 | Section headers | Leave plain or one **`GradientText`** on page title only | |

---

## E. Profile / account (`frontend/src/pages/ProfilePage.js`)

**Route:** `/profile` — this is the app’s **account / research profile** page (no separate `/account` route in `App.js`; login/signup are `/login`, `/signup`).

### Small components and patterns

| Component / area | What it is |
|------------------|------------|
| **`SectionLabel`** | Icon + uppercase label |
| **`Chip`** | Toggle pill: filled orange when active (role is single-select; interests/source types multi) |
| **Account header `GlassCard`** | Orange circle **avatar** with User icon, serif username, email, member since mono, **Sign out** red outline button |
| **Topics of focus** | Active chips with **×** remove; text input + **Add** button |
| **Save button** | Orange → green “Saved!” with **`Check`**; “Saving…” state |

### What reads generic

- **Dense chip walls** for roles + interests + source types — same pattern repeated three times (visual fatigue).
- **Solid orange avatar** — fine but undifferentiated.

### React Bits mapping (profile)

| Priority | Current | Suggested React Bits | Notes |
|----------|---------|---------------------|-------|
| 1 | Many toggle chips | **`PillNav`** / **`GooeyNav`** for **role** (single) + chip grid for multi | At minimum, **differentiate** single vs multi visually |
| 2 | Account header card | **`ProfileCard`** or **`SpotlightCard`** (Components) | Elevate identity block; keep orange accent |
| 3 | Save CTA | **`FadeContent`** for success state | Already color-changes — motion can be subtle |
| 4 | Page section title (“Research Profile”) | **`ShinyText`** (TextAnimations) | One headline only |

### Skip / defer (profile)

- **Form fields** — don’t obscure labels with flashy text effects.

---

## F. Combined implementation order (suggestion)

1. **PillNav** — chat drawer, Sources library/map, Settings model/depth, Profile role (shared visual language).  
2. **GlassSurface** — Converse composer, citation picker, Settings cards, modal search rows.  
3. **Stepper** — chat CoT; optional formatter progress.  
4. **Counter** — Sources stats; optional Write word count emphasis.  
5. **AnimatedList** — Sources recent list + Notes sidebar sections.  
6. **SpotlightCard** / **TiltedCard** — Sources entry cards, source cards, `ResearchSourcePill` rows, Profile header.  
7. **Carousel** / **ScrollStack** — AI Formatter templates.  
8. **BubbleMenu** — chat actions + optional floating toolbar.  
9. **StarBorder** / **FadeContent** — streaming, loading, toasts.  
10. **ShinyText** / **GradientText** — single headlines only (hero lines, one settings/profile title).

---

## G. Files touched when implementing

| Area | Primary files |
|------|----------------|
| Chat | `MessageThread.js`, `ChainOfThought.js`, `InputBar.js`, `ResearchDrawer.js`, `ConverseSidebar.js` |
| Sources | `SourcesPage.js` (`QualityBadge` through `RecentSourcesPreview`, both modals) |
| Notes | `WritePage.js` (`ResearchSourcePill` through right drawer; toolbars & popups) |
| Settings | `SettingsPage.js` |
| Profile / account | `ProfilePage.js` |

---

*Last updated: 2026-04-18*
