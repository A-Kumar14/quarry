# Homepage Redesign — Design Spec

**Date:** 2026-04-14
**Scope:** Logged-in homepage only (logged-out state deferred)
**Branch:** overhaul/epistemic-pipeline

---

## Goals

- Better utility for logged-in users
- Stronger first impression
- Continuity — no blank-slate feeling (recent research history surfaced)
- All components use IBM Plex Sans as the primary UI font (matching the prompt bar textarea)

---

## 1. Top Nav Bar

**No structural changes.** Size fix only.

- Nav pill: `height: 52px`, `padding: 6px`
- Nav items: `height: 40px`, `min-width: 44px`, `padding: 0 12px`
- Icons: `22px`, `stroke-width: 2`
- Active state: orange pill background `rgba(249,115,22,0.15)`, orange text/icon, label expands via spring animation (existing `BottomNavBar` behaviour)
- Items: Home · Notes · Sources · Artifacts · Settings · Account (unchanged)

---

## 2. Prompt Bar (`ai-prompt-box.jsx`)

### Renames
- `Canvas` button → **Notes** (pencil/edit icon)
- `Think` button → **Deep** (brain icon, unchanged)

### Notes mode — new behaviour
1. Clicking **Notes** opens a slash-command picker floating above the bar
2. Picker shows user's notes as `/Note title` rows with relative timestamps
3. Keyboard: `↑↓` navigate, `↵` insert, `Esc` close
4. Selecting a note closes the picker and inserts a **pill token** into the input:
   - Pill style: `background: rgba(249,115,22,0.15)`, `border: 1px solid rgba(249,115,22,0.35)`, `border-radius: 5px`, IBM Plex Mono, orange text
   - Format: `/Note title` (slash dimmed, title orange)
5. Input area must switch from `<textarea>` to `contentEditable` div to support inline styled tokens
6. On submit: backend receives note body as context + user's query → AI response is note-aware (suggestions, gaps, updates relative to existing note content — not a fresh search)

### Picker UI
- Floats above bar (`bottom: calc(100% + 8px)`)
- Dark shell: `background: #1A1410`, `border: 1px solid rgba(249,115,22,0.22)`, `border-radius: 14px`
- Header row: mono label "Your notes" + keyboard hint `↑↓ navigate · ↵ insert`
- Each row: `/` slash (dimmed orange) + note title + relative timestamp
- Active row: `background: rgba(249,115,22,0.08)`

---

## 3. Globe Card (`InlineGlobeMap`)

### Visual
- Real cobe globe, exact existing config preserved:
  - Dark: `baseColor [0.10,0.12,0.15]`, `markerColor [0.98,0.45,0.09]`, `glowColor [0.05,0.06,0.09]`, `dark:1`, `diffuse:1.05`, `mapBrightness:4`
  - Light: `baseColor [0.90,0.88,0.84]`, `glowColor [0.88,0.84,0.78]`, `dark:0`, `diffuse:1.35`, `mapBrightness:6`
- `border-radius: 50%` on canvas
- `canvas` width = `canvas.offsetWidth` (CSS px) — cobe handles DPR internally

### Pin bar font change
- Location label: `font-family: IBM Plex Sans` (was IBM Plex Serif), `font-weight: 600`, `0.86rem`
- Type label: IBM Plex Mono, uppercase, dim — unchanged
- Description: IBM Plex Sans, `0.67rem`, dim — unchanged

---

## 4. Globe Modal (`GlobeMapModal`)

### Layout
- Full-width dark modal: `width: min(680px, 96vw)`, expands to `min(1040px, 96vw)` when detail panel opens
- Header: 🌐 icon + "World Signals" title + incident count (no "live GDELT feed" subtitle) + close button
- Body: globe pane (left, flex:1) + signal list pane (right, `width: 260px`)
- **No** "On-globe signals" header row inside the list

### Signal list
- Each row: numbered badge + signal name + type pill (conflict/famine/politics) + 1-line description
- Hover: orange tint background + **Explore ›** button appears
- Type pills use badge-1 dark-mode oklch tokens

### Detail panel (slides in on Explore)
- Animates in from right: `width: 0 → 360px`, modal expands simultaneously
- Header: `← Back` + signal headline
- Body sections: **What happened** / **Background** / **Key facts** (key-value rows) / **Sources reporting** (gray pills)
- Footer: **Start Researching** (orange) + **Open in Notes** (outline)
- `← Back` collapses panel, modal contracts

---

## 5. Today's Topics Card (`DailyTopicsCard`)

- Card shell: `background: rgba(20,14,8,0.92)`, `border: 1px solid rgba(249,115,22,0.22)` — dark in both modes
- All text: IBM Plex Sans (was IBM Plex Serif for title)
- Urgency badges: badge-1 pill components — Breaking (red) / Developing (amber) / Analysis (blue) / Feature (purple)
- No "Live" button
- No "Personalised to your tracked topics" subtitle

---

## 6. Daily Briefing Modal (`DailyTopicsModal`)

### Layout
- Dark modal: `max-width: 680px`, `height: 640px`
- Header: ⚡ zap icon + "Daily Briefing" + date·topic subtitle + Refresh + Close
- Body: scrollable — summary block → 2-col card grid
- Footer: refine bar (PromptInputBox style, pill input, orange send button)

### Summary block
- Left orange border (`3px solid #F97316`)
- Label: IBM Plex Sans, uppercase, `0.60rem`, dim — **not** IBM Plex Mono
- Body text: IBM Plex Sans, `0.85rem`, `font-weight: 400`, `line-height: 1.7`
- Meta: IBM Plex Sans, `0.62rem`, dim

### Topic cards
- Badge-1 pills (Breaking/Developing/Analysis) + relevance pill (High/Medium)
- Track button (bookmark icon)
- Headline: IBM Plex Sans `0.90rem` weight 600
- Summary: IBM Plex Sans `0.74rem` weight 300, 3-line clamp
- Hook quote: orange left border, italic, `0.68rem`
- Footer: source in IBM Plex Mono + **Explore Topic ›** orange button

### Story Plan panel (on Explore Topic)
- Slides in from right (same expand pattern as globe modal)
- Sections: What happened / Background / Key facts / Sources reporting
- Footer: Start Researching + Open in Notes

---

## 7. Notes Card (`HomeNotesCard`)

- Glass card shell (existing `GlassCard`)
- Header: SVG pencil-stroke icon in tinted box + "Notes" title + "View all" link — no emoji, no subtitle
- Body: 2 recent note previews (title + 1-line excerpt + timestamp)
- Footer: `+ New note` button

---

## Implementation Notes

- `contentEditable` div replaces `<textarea>` in `PromptInputBox` for pill token support
- Notes picker reads from existing `useNotes` hook / `sourceLibrary.js` is untouched
- Globe card font change is a 1-line `T.serif → T.sans` swap in `InlineGlobeMap`
- Globe modal detail panel reuses the same slide-in pattern as `StoryPlanPanel` in `DailyTopicsModal`
- All badge-1 pills already exist as a component pattern — apply consistently across cards and modals
- No new npm packages required beyond existing stack
