# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the 2026-04-14 homepage redesign spec — nav pill size fix, prompt bar Notes/Deep rename with note-picker + pill token, globe pin-bar font, globe modal redesign with detail panel, DailyTopicsCard always-dark, DailyTopicsModal label font, and HomeNotesCard header redesign.

**Architecture:** All changes are isolated to three files (`AppTopbar.js`, `ai-prompt-box.jsx`, `HomePage.js`) plus one modal file (`DailyTopicsModal.js`). No new npm packages, no backend changes, no new files.

**Tech Stack:** React 18, inline styles + Tailwind (mixed), Lucide icons, localStorage (notes), CSS transitions for slide-in panel.

---

## File Map

| File | Tasks |
|------|-------|
| `frontend/src/components/AppTopbar.js` | Task 1 |
| `frontend/src/components/ui/ai-prompt-box.jsx` | Tasks 2–3 |
| `frontend/src/pages/HomePage.js` | Tasks 4–7 |
| `frontend/src/components/DailyTopicsModal.js` | Task 8 |

---

## Task 1: AppTopbar — nav pill size fix

**Files:**
- Modify: `frontend/src/components/AppTopbar.js:72`

The current `className` on `BottomNavBar` has `h-10 p-1.5` which overrides the component's default `h-[52px] p-[6px]`. Remove those two overrides.

- [ ] **Step 1: Edit AppTopbar.js**

In `frontend/src/components/AppTopbar.js`, line 72, change:

```js
className={`min-w-0 max-w-none h-10 p-1.5 border border-border backdrop-blur-[14px] shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${
  dark ? 'bg-[rgba(20,16,14,0.42)]' : 'bg-[rgba(255,255,255,0.18)]'
}`}
```

to:

```js
className={`min-w-0 max-w-none border border-border backdrop-blur-[14px] shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${
  dark ? 'bg-[rgba(20,16,14,0.42)]' : 'bg-[rgba(255,255,255,0.18)]'
}`}
```

- [ ] **Step 2: Verify visually**

Open the app at `http://localhost:3000` and confirm the nav pill is taller (52px) with properly-sized items (40px, 22px icons).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AppTopbar.js
git commit -m "fix: restore nav pill to spec dimensions (52px pill, 40px items)"
```

---

## Task 2: Prompt bar — rename Think→Deep, Canvas→Notes, swap icon

**Files:**
- Modify: `frontend/src/components/ui/ai-prompt-box.jsx`

Changes:
1. Import `Pencil` instead of `FolderCode`
2. Rename state `showCanvas` → `showNotes`, `handleCanvasToggle` → `handleNotesToggle`
3. Change "Canvas" label → "Notes", "Think" label → "Deep"
4. Change `FolderCode` icon → `Pencil`
5. Change `[Canvas:` prefix → `[Notes:` in `handleSubmit`
6. Change placeholder "Create on canvas…" → "Add a note…"

- [ ] **Step 1: Update import line**

In `frontend/src/components/ui/ai-prompt-box.jsx`, line 4, change:

```js
import { ArrowUp, Paperclip, Square, X, StopCircle, Mic, Globe, BrainCog, FolderCode } from "lucide-react";
```

to:

```js
import { ArrowUp, Paperclip, Square, X, StopCircle, Mic, Globe, BrainCog, Pencil } from "lucide-react";
```

- [ ] **Step 2: Rename Canvas state and handler**

In `PromptInputBox`, change:

```js
const [showCanvas, setShowCanvas] = React.useState(false);
```

to:

```js
const [showNotes, setShowNotes] = React.useState(false);
```

Change:

```js
const handleCanvasToggle = () => setShowCanvas((prev) => !prev);
```

to:

```js
const handleNotesToggle = () => setShowNotes((prev) => !prev);
```

- [ ] **Step 3: Update handleSubmit prefix**

In `handleSubmit`, change:

```js
else if (showCanvas) messagePrefix = "[Canvas: ";
```

to:

```js
else if (showNotes) messagePrefix = "[Notes: ";
```

- [ ] **Step 4: Update disabled logic**

Change:

```js
disabled={isLoading || isRecording}
```

(The `PromptInput` `disabled` prop.) Also update `hasContent` computation — no change needed there.

Also in the `PromptInput` wrapper change:

```js
disabled={isLoading || isRecording}
```

No change needed here actually — just make sure `showCanvas` references are gone.

- [ ] **Step 5: Update textarea placeholder**

Change:

```js
: showCanvas
? "Create on canvas..."
```

to:

```js
: showNotes
? "Add a note..."
```

- [ ] **Step 6: Replace Canvas button with Notes button**

Replace the entire Canvas button block (the third `<button>` with `handleCanvasToggle`):

```jsx
<button
  type="button"
  onClick={handleNotesToggle}
  className={cn(
    "rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
    showNotes
      ? "bg-[#F97316]/15 border-[#F97316] text-[#F97316]"
      : "bg-transparent border-transparent text-[var(--fg-dim)] hover:text-[var(--fg-primary)]"
  )}
>
  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
    <motion.div
      animate={{ rotate: showNotes ? 360 : 0, scale: showNotes ? 1.1 : 1 }}
      whileHover={{ rotate: showNotes ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
      transition={{ type: "spring", stiffness: 260, damping: 25 }}
    >
      <Pencil className={cn("w-4 h-4", showNotes ? "text-[#F97316]" : "text-inherit")} />
    </motion.div>
  </div>
  <AnimatePresence>
    {showNotes && (
      <motion.span
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: "auto", opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="text-xs overflow-hidden whitespace-nowrap text-[#F97316] flex-shrink-0"
      >
        Notes
      </motion.span>
    )}
  </AnimatePresence>
</button>
```

- [ ] **Step 7: Rename Think→Deep**

In the Think button span, change:

```jsx
      Think
```

to:

```jsx
      Deep
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/ui/ai-prompt-box.jsx
git commit -m "feat: rename Canvas→Notes (Pencil icon), Think→Deep in prompt bar"
```

---

## Task 3: Notes mode — picker + pill chip + note context on submit

**Files:**
- Modify: `frontend/src/components/ui/ai-prompt-box.jsx`

When the user clicks Notes and a note is selected, show an orange pill chip ABOVE the textarea (using the existing file preview area pattern). On submit, prepend note body as context.

The picker reads `quarry_documents` from localStorage directly (no hook dependency — keeps the component standalone).

- [ ] **Step 1: Add helper to read notes from localStorage**

At the top of `PromptInputBox` function body (after `const [showNotes, setShowNotes]`), add:

```js
const [notesPicker, setNotesPicker] = React.useState(false);
const [selectedNote, setSelectedNote] = React.useState(null);
const [pickerIndex, setPickerIndex] = React.useState(0);
const [pickerNotes, setPickerNotes] = React.useState([]);
```

- [ ] **Step 2: Load picker notes when Notes button is clicked**

Change `handleNotesToggle` to:

```js
const handleNotesToggle = () => {
  if (!showNotes) {
    // Open picker with current notes from localStorage
    try {
      const raw = JSON.parse(localStorage.getItem('quarry_documents') || '[]');
      const sorted = raw
        .map(d => ({ id: String(d.id || ''), title: String(d.title || 'Untitled note'), body: String(d.content || d.body || ''), updatedAt: d.updatedAt || d.createdAt || Date.now() }))
        .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
      setPickerNotes(sorted);
    } catch {
      setPickerNotes([]);
    }
    setPickerIndex(0);
    setNotesPicker(true);
    setShowNotes(true);
  } else {
    setShowNotes(false);
    setNotesPicker(false);
    setSelectedNote(null);
  }
};
```

- [ ] **Step 3: Add keyboard handler for picker**

Inside the `PromptInputBox` component, add an effect for picker keyboard navigation:

```js
React.useEffect(() => {
  if (!notesPicker) return;
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setPickerIndex(i => Math.min(i + 1, pickerNotes.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setPickerIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); if (pickerNotes[pickerIndex]) selectNote(pickerNotes[pickerIndex]); }
    if (e.key === 'Escape') { setNotesPicker(false); setShowNotes(false); setSelectedNote(null); }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [notesPicker, pickerIndex, pickerNotes]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Add selectNote handler**

```js
const selectNote = (note) => {
  setSelectedNote(note);
  setNotesPicker(false);
};
```

- [ ] **Step 5: Update handleSubmit to include note context**

In `handleSubmit`, change:

```js
const formattedInput = messagePrefix ? `${messagePrefix}${input}]` : input;
onSend(formattedInput, files);
```

to:

```js
let finalInput = input;
if (selectedNote && showNotes) {
  finalInput = `[Note: ${selectedNote.title}]\n${selectedNote.body}\n\n---\n\n${input}`;
}
const formattedInput = messagePrefix ? `${messagePrefix}${finalInput}]` : finalInput;
onSend(formattedInput, files);
setSelectedNote(null);
setShowNotes(false);
setNotesPicker(false);
```

- [ ] **Step 6: Render NotesPicker floating above the bar**

Inside `PromptInputBox`'s return, BEFORE the `<PromptInput>` opening tag, add the picker and wrap everything in a `<div style={{position:'relative', width:'100%'}}>`:

```jsx
<div style={{ position: 'relative', width: '100%' }}>
  {/* Notes Picker */}
  {notesPicker && (
    <div style={{
      position: 'absolute',
      bottom: 'calc(100% + 8px)',
      left: 0, right: 0,
      background: '#1A1410',
      border: '1px solid rgba(249,115,22,0.22)',
      borderRadius: 14,
      zIndex: 50,
      overflow: 'hidden',
      boxShadow: '0 8px 30px rgba(0,0,0,0.40)',
    }}>
      <div style={{
        padding: '8px 12px 6px',
        borderBottom: '1px solid rgba(249,115,22,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.60rem', color: 'rgba(240,230,216,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Your notes
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.58rem', color: 'rgba(240,230,216,0.28)' }}>
          ↑↓ navigate · ↵ insert
        </span>
      </div>
      {pickerNotes.length === 0 ? (
        <div style={{ padding: '12px', fontFamily: "'IBM Plex Sans',sans-serif", fontSize: '0.76rem', color: 'rgba(240,230,216,0.38)' }}>
          No notes yet
        </div>
      ) : (
        pickerNotes.slice(0, 8).map((note, i) => {
          const ago = (() => {
            const ms = Date.now() - (Number(note.updatedAt) || Date.now());
            const mins = Math.floor(ms / 60000);
            if (mins < 1) return 'just now';
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            return `${Math.floor(hrs / 24)}d ago`;
          })();
          return (
            <div
              key={note.id}
              onClick={() => selectNote(note)}
              style={{
                padding: '9px 12px',
                borderBottom: '1px solid rgba(249,115,22,0.06)',
                background: pickerIndex === i ? 'rgba(249,115,22,0.08)' : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setPickerIndex(i)}
            >
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.82rem', color: '#F97316' }}>
                <span style={{ opacity: 0.55 }}>/</span>{note.title}
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '0.60rem', color: 'rgba(240,230,216,0.28)', flexShrink: 0 }}>
                {ago}
              </span>
            </div>
          );
        })
      )}
    </div>
  )}

  {/* Selected note pill chip (above textarea) */}
  {selectedNote && (
    <div style={{ padding: '4px 4px 0' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'rgba(249,115,22,0.15)',
        border: '1px solid rgba(249,115,22,0.35)',
        borderRadius: 5,
        padding: '0 8px', height: 22,
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: '0.76rem', color: '#F97316',
      }}>
        <span style={{ opacity: 0.55 }}>/</span>{selectedNote.title}
        <button
          onClick={() => { setSelectedNote(null); setShowNotes(false); }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(249,115,22,0.6)', fontSize: '0.7rem', lineHeight: 1, marginLeft: 2 }}
        >
          ×
        </button>
      </span>
    </div>
  )}

  <PromptInput
    {/* ...existing props... */}
  >
    {/* ...existing children... */}
  </PromptInput>
</div>
```

Note: The `<PromptInput>` block already exists — wrap the existing return with the outer `<div style={{ position: 'relative', width: '100%' }}>` and add the picker/chip BEFORE the `<PromptInput>` tag. The `<ImageViewDialog>` stays outside.

- [ ] **Step 7: Close picker when clicking outside**

Add a click-outside handler:

```js
const pickerRef = React.useRef(null);
React.useEffect(() => {
  if (!notesPicker) return;
  const onOutside = (e) => {
    if (pickerRef.current && !pickerRef.current.contains(e.target)) {
      setNotesPicker(false);
    }
  };
  document.addEventListener('mousedown', onOutside);
  return () => document.removeEventListener('mousedown', onOutside);
}, [notesPicker]);
```

Attach `ref={pickerRef}` to the picker `<div>`.

- [ ] **Step 8: Verify in browser**

1. Click Notes button → picker appears
2. Notes listed as `/title`
3. Arrow keys navigate, Enter selects, Esc closes
4. After selecting: orange pill chip appears above textarea
5. Type query + submit → note context prepended in onSend callback
6. `×` on chip removes selection

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/ui/ai-prompt-box.jsx
git commit -m "feat: Notes mode — slash-command picker + pill chip + note context on submit"
```

---

## Task 4: Globe pin-bar font: serif → sans

**Files:**
- Modify: `frontend/src/pages/HomePage.js:1086`

- [ ] **Step 1: Change one line**

In `InlineGlobeMap`, line 1086, change:

```js
<span style={{ fontFamily: T.serif, fontSize: '0.86rem', fontWeight: 600, color: 'var(--fg-primary)' }}>
```

to:

```js
<span style={{ fontFamily: T.sans, fontSize: '0.86rem', fontWeight: 600, color: 'var(--fg-primary)' }}>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/HomePage.js
git commit -m "fix: globe pin-bar location label font serif → sans (IBM Plex Sans)"
```

---

## Task 5: Globe modal redesign — dark shell, own signal list, detail panel

**Files:**
- Modify: `frontend/src/pages/HomePage.js:1172–1215` (replace entire `GlobeMapModal`)

Replace the current `GlobeMapModal` function entirely. The new modal has:
- Dark shell (`background: rgba(14,10,6,0.97)`, `border: 1px solid rgba(249,115,22,0.22)`, `border-radius: 18px`)
- Transitions width: 680px → 1040px when detail panel open
- Header: 🌐 + "World Signals" + pin count badge + close button
- Body: `InlineGlobeMap` (left, `flex:1`, `showSignalsList={false}`) + own signal list (right, 260px)
- Signal list rows: number badge + name + type pill + 1-line desc; hover shows "Explore ›"
- Detail panel slides in from right (width 0 → 360px)
- Detail panel content: ← Back + headline, What happened / Background / Key facts / Sources reporting sections
- Footer: Start Researching (orange) + Open in Notes (outline)

The `WORLD_PINS` data already has the fields needed. For `Key facts` and `Sources reporting`, we use hardcoded data per pin — the pin already has `desc`, `type`, `label`. Generate inline content per pin using the same fields.

- [ ] **Step 1: Replace GlobeMapModal**

Replace the entire `GlobeMapModal` function (lines 1172–1215) with:

```jsx
function GlobeMapModal({ open, onClose, pins }) {
  const [dark] = useDarkMode();
  const [activePin, setActivePin] = React.useState(null); // pin object when detail open
  const [hoveredRow, setHoveredRow] = React.useState(-1);

  React.useEffect(() => {
    if (!open) { setActivePin(null); setHoveredRow(-1); }
  }, [open]);

  if (!open) return null;

  const modalW = activePin ? 'min(1040px,96vw)' : 'min(680px,96vw)';

  const typePillColor = (type = '') => {
    const t = type.toLowerCase();
    if (t.includes('conflict') || t.includes('crisis') || t.includes('war')) return { bg: 'rgba(220,38,38,0.18)', color: '#ef4444', border: 'rgba(220,38,38,0.30)' };
    if (t.includes('famine') || t.includes('food') || t.includes('health')) return { bg: 'rgba(217,119,6,0.18)', color: '#f59e0b', border: 'rgba(217,119,6,0.30)' };
    if (t.includes('politics') || t.includes('election') || t.includes('diplomatic')) return { bg: 'rgba(124,58,237,0.18)', color: '#a78bfa', border: 'rgba(124,58,237,0.30)' };
    return { bg: 'rgba(249,115,22,0.12)', color: '#f97316', border: 'rgba(249,115,22,0.25)' };
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.68)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: modalW,
          background: 'rgba(14,10,6,0.97)',
          border: '1px solid rgba(249,115,22,0.22)',
          borderRadius: 18,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '88vh',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.60)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px 12px',
          borderBottom: '1px solid rgba(249,115,22,0.12)',
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '1.1rem' }}>🌐</span>
          <span style={{ fontFamily: T.sans, fontSize: '0.94rem', fontWeight: 600, color: 'rgba(240,230,216,0.92)', flex: 1 }}>
            World Signals
          </span>
          <span style={{
            fontFamily: T.mono, fontSize: '0.60rem', color: 'rgba(240,230,216,0.38)',
            background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.18)',
            borderRadius: 5, padding: '2px 6px',
          }}>
            {pins.length} signals
          </span>
          <button
            onClick={onClose}
            style={{
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 999,
              background: 'rgba(255,255,255,0.05)', color: 'rgba(240,230,216,0.55)',
              fontFamily: T.sans, fontSize: '0.70rem', padding: '4px 10px', cursor: 'pointer',
              transition: 'all 0.14s',
            }}
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Globe pane */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <InlineGlobeMap pins={pins} showSignalsList={false} />
          </div>

          {/* Signal list */}
          <div style={{
            width: 260, flexShrink: 0,
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            overflowY: 'auto',
          }}>
            {pins.map((pin, i) => {
              const pill = typePillColor(pin.type);
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(-1)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: hoveredRow === i ? 'rgba(249,115,22,0.07)' : 'transparent',
                    transition: 'background 0.12s',
                    cursor: 'default',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 999, flexShrink: 0,
                      background: 'rgba(249,115,22,0.14)', border: '1px solid rgba(249,115,22,0.30)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: T.mono, fontSize: '0.52rem', color: '#f3ded2', marginTop: 1,
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: T.sans, fontSize: '0.78rem', fontWeight: 600, color: 'rgba(240,230,216,0.88)' }}>
                          {pin.label.replace(new RegExp(`\\s*${pin.type}$`, 'i'), '')}
                        </span>
                        <span style={{
                          fontFamily: T.mono, fontSize: '0.54rem', textTransform: 'uppercase',
                          background: pill.bg, border: `1px solid ${pill.border}`, color: pill.color,
                          borderRadius: 4, padding: '1px 5px',
                        }}>
                          {pin.type}
                        </span>
                      </div>
                      <div style={{
                        fontFamily: T.sans, fontSize: '0.67rem', color: 'rgba(200,195,185,0.50)',
                        lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                      }}>
                        {pin.desc}
                      </div>
                      {hoveredRow === i && (
                        <button
                          onClick={() => setActivePin(pin)}
                          style={{
                            marginTop: 6, background: 'none', border: 'none', padding: 0,
                            fontFamily: T.sans, fontSize: '0.70rem', fontWeight: 600,
                            color: '#F97316', cursor: 'pointer',
                          }}
                        >
                          Explore ›
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          <div style={{
            width: activePin ? 360 : 0,
            overflow: 'hidden',
            flexShrink: 0,
            borderLeft: activePin ? '1px solid rgba(249,115,22,0.15)' : 'none',
            transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
            display: 'flex', flexDirection: 'column',
          }}>
            {activePin && (
              <div style={{ width: 360, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Panel header */}
                <div style={{
                  padding: '12px 14px 10px',
                  borderBottom: '1px solid rgba(249,115,22,0.10)',
                  flexShrink: 0,
                }}>
                  <button
                    onClick={() => setActivePin(null)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: T.sans, fontSize: '0.70rem', color: 'rgba(240,230,216,0.45)',
                      display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8,
                    }}
                  >
                    ← Back
                  </button>
                  <div style={{ fontFamily: T.sans, fontSize: '0.88rem', fontWeight: 600, color: 'rgba(240,230,216,0.92)', lineHeight: 1.3 }}>
                    {activePin.label}
                  </div>
                </div>

                {/* Panel body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
                  <DetailSection title="What happened">
                    {activePin.desc}
                  </DetailSection>
                  <DetailSection title="Background">
                    {activePin.type} activity in the {activePin.label.replace(new RegExp(`\\s*${activePin.type}$`, 'i'), '')} region. This signal is being tracked across multiple international news sources.
                  </DetailSection>
                  <DetailSection title="Key facts">
                    <div style={{ fontFamily: T.sans, fontSize: '0.72rem', color: 'rgba(200,195,185,0.70)', lineHeight: 1.5 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: 'rgba(200,195,185,0.40)', minWidth: 70 }}>Region</span>
                        <span>{activePin.label.replace(new RegExp(`\\s*${activePin.type}$`, 'i'), '')}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: 'rgba(200,195,185,0.40)', minWidth: 70 }}>Category</span>
                        <span>{activePin.type}</span>
                      </div>
                    </div>
                  </DetailSection>
                  <DetailSection title="Sources reporting">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {['Reuters', 'AP News', 'BBC', 'Al Jazeera'].map(s => (
                        <span key={s} style={{
                          fontFamily: T.mono, fontSize: '0.62rem', color: 'rgba(200,195,185,0.55)',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 5, padding: '2px 7px',
                        }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </DetailSection>
                </div>

                {/* Panel footer */}
                <div style={{
                  padding: '12px 14px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', gap: 8, flexShrink: 0,
                }}>
                  <button style={{
                    flex: 1, background: '#F97316', border: 'none', borderRadius: 10,
                    color: '#fff', fontFamily: T.sans, fontSize: '0.74rem', fontWeight: 600,
                    padding: '9px 0', cursor: 'pointer', transition: 'background 0.14s',
                  }}>
                    Start Researching
                  </button>
                  <button style={{
                    flex: 1, background: 'none', border: '1px solid rgba(249,115,22,0.35)',
                    borderRadius: 10, color: '#F97316', fontFamily: T.sans, fontSize: '0.74rem',
                    fontWeight: 500, padding: '9px 0', cursor: 'pointer',
                  }}>
                    Open in Notes
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: T.mono, fontSize: '0.58rem', color: 'rgba(240,230,216,0.35)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5,
      }}>
        {title}
      </div>
      <div style={{ fontFamily: T.sans, fontSize: '0.74rem', color: 'rgba(200,195,185,0.72)', lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify modal**

1. Open globe card → click → modal opens (680px wide, dark)
2. Header shows 🌐 World Signals + count + Close
3. Signal list: numbered rows, type pills, 1-line descriptions
4. Hover row → "Explore ›" appears
5. Click "Explore ›" → detail panel slides in (modal expands to 1040px)
6. "← Back" collapses panel

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/HomePage.js
git commit -m "feat: globe modal redesign — dark shell, signal list, detail panel slide-in"
```

---

## Task 6: DailyTopicsCard — always-dark, sans title, remove Live chip

**Files:**
- Modify: `frontend/src/pages/HomePage.js:621–670`

- [ ] **Step 1: Change background to always-dark**

Line 621, change:

```js
const bg = dark ? 'rgba(20,14,8,0.60)' : 'rgba(255,255,255,0.44)';
```

to:

```js
const bg = 'rgba(20,14,8,0.92)';
```

- [ ] **Step 2: Change title font to sans**

Line 659, change:

```js
<div style={{ fontFamily: T.serif, fontSize: '0.92rem', fontWeight: 600, color: T.fg }}>
  Today's topics
</div>
```

to:

```js
<div style={{ fontFamily: T.sans, fontSize: '0.92rem', fontWeight: 600, color: 'rgba(240,230,216,0.90)' }}>
  Today's topics
</div>
```

- [ ] **Step 3: Remove Live chip**

Remove the entire Live chip div (lines 663–670):

```js
{/* Live chip */}
<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
  <span style={{
    width: 4, height: 4, borderRadius: '50%', background: dark ? 'rgba(249,115,22,0.65)' : 'rgba(180,83,9,0.6)',
    display: 'inline-block', flexShrink: 0,
    animation: 'pinPulse 2s ease-in-out infinite',
  }} />
  <span style={{ fontFamily: T.mono, fontSize: '0.52rem', color: T.fgDim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>live</span>
</div>
```

Delete it entirely.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/HomePage.js
git commit -m "feat: DailyTopicsCard always-dark bg, sans title, no live chip"
```

---

## Task 7: DailyTopicsModal — summary label font fix

**Files:**
- Modify: `frontend/src/components/DailyTopicsModal.js:682`

Per spec: summary block label should be IBM Plex Sans, not IBM Plex Mono (`var(--font-family)` resolves to Inter per CLAUDE.md — change explicitly to IBM Plex Sans).

- [ ] **Step 1: Change label font**

Line 682, change:

```js
fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 600,
```

to:

```js
fontFamily: "'IBM Plex Sans',system-ui,sans-serif", fontSize: '0.60rem', fontWeight: 600,
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/DailyTopicsModal.js
git commit -m "fix: DailyTopicsModal summary label font → IBM Plex Sans (not Mono)"
```

---

## Task 8: HomeNotesCard — pencil icon header, Notes title, View all link

**Files:**
- Modify: `frontend/src/pages/HomePage.js:785–798`

Changes:
- Header: add SVG pencil icon in tinted box, change "Your notes" → "Notes", font T.serif → T.sans
- Replace "+ New note" header button with "View all →" link
- Add "+ New note" button in the footer (already at bottom in the empty-state, add to populated state)

- [ ] **Step 1: Update header**

Replace lines 785–798:

```jsx
<div style={{ padding: '10px 14px 8px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  <div style={{ fontFamily: T.serif, fontSize: '0.92rem', fontWeight: 600, color: T.fg }}>
    Your notes
  </div>
  <button
    onClick={(e) => { e.stopPropagation(); onNewNote?.(); }}
    style={{
      border: 'none', background: 'none', color: T.accent, cursor: 'pointer',
      fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 600, padding: 0,
    }}
  >
    + New note
  </button>
</div>
```

with:

```jsx
<div style={{ padding: '10px 14px 8px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', gap: 8 }}>
  <div style={{
    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
    background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.20)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  </div>
  <div style={{ fontFamily: T.sans, fontSize: '0.92rem', fontWeight: 600, color: T.fg, flex: 1 }}>
    Notes
  </div>
  <button
    onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
    style={{
      border: 'none', background: 'none', color: T.accent, cursor: 'pointer',
      fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 500, padding: 0,
    }}
  >
    View all →
  </button>
</div>
```

- [ ] **Step 2: Add "+ New note" button in populated state footer**

In the populated-state branch (after the `recent.map(...)` block, around line 836), the "View all notes →" button currently exists. Keep it OR replace with "+ New note". Per spec the footer should have `+ New note`. Replace:

```jsx
<button
  onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
  style={{
    alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0,
    color: T.accent, cursor: 'pointer', fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 600,
  }}
>
  View all notes →
</button>
```

with:

```jsx
<button
  onClick={(e) => { e.stopPropagation(); onNewNote?.(); }}
  style={{
    alignSelf: 'flex-start', border: 'none', borderRadius: 8,
    background: T.accent, color: '#fff',
    fontFamily: T.sans, fontSize: '0.70rem', fontWeight: 600,
    padding: '6px 12px', cursor: 'pointer',
  }}
>
  + New note
</button>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/HomePage.js
git commit -m "feat: HomeNotesCard — pencil icon, Notes title, View all link, + New note footer"
```

---

## Final Verification

- [ ] Run `CI=false npm run build` from `frontend/` — must compile with no errors (warnings OK)
- [ ] Run `cd backend && python3 -m pytest` — 169 passing tests must still pass
- [ ] Visual check: all 8 components match the spec

```bash
cd frontend && CI=false npm run build
cd ../backend && python3 -m pytest --tb=no -q
```
