# Chat Page — Design Spec

**Date:** 2026-04-14
**Scope:** Convert `/explore` route from research tab UI to AI conversation chat interface
**Branch:** overhaul/epistemic-pipeline

---

## Goals

- Replace the 3377-line ExplorePage with a minimal AI-human conversation interface
- Preserve all existing research functionality (sources, contradictions, perspectives, citations, deep mode) behind a per-message research drawer
- Store conversations persistently with semantic search via Chroma
- Support branching conversations (fork from any AI message)
- AI auto-decides when to search the web (agentic tool use)

---

## 1. Route & File Changes

- `/explore` route → now renders `ConversePage.js` (new file)
- `ExplorePage.js` archived to `src/archived/ExplorePage.js` (not deleted — per CLAUDE.md)
- AppTopbar nav item label stays "Sources" (unchanged)
- No new npm packages required

---

## 2. Frontend Components

### `src/pages/ConversePage.js`
Top-level page. Holds session/branch state. Renders `ConverseSidebar` + `MessageThread` + `InputBar` + `ResearchDrawer`.

State:
- `sessions[]` — list of `{id, title, branches[], createdAt}`
- `activeSessionId` — current session
- `activeBranchId` — current branch within session
- `messages[]` — messages for active branch
- `drawerOpen` — bool
- `drawerMessageId` — which message's research data is shown in drawer
- `streaming` — bool (AI is responding)

### `src/components/chat/ConverseSidebar.js`
Left panel, `200px` wide, collapsible to icon rail.

- Header: "Conversations" label + "+ New" button
- List: one `ConvItem` per session showing auto-generated title + relative timestamp + message count
- Branch tree: indented beneath active session, one row per branch with `⎇` dot indicator
- Active session: orange left border `3px solid #F97316`, tinted background `rgba(249,115,22,0.06)`
- Active branch: orange dot, orange text
- Click session → load that session's default branch
- Click branch → load that branch

### `src/components/chat/MessageThread.js`
Scrollable center column. Auto-scrolls to bottom on new message.

**User message bubble:**
- Right-aligned, max-width 62%
- Background `#1a1612`, border `1px solid #2a2218`
- Border-radius `12px 12px 3px 12px`
- IBM Plex Sans, `12px`, color `#ccc`

**AI message:**
- Left-aligned, max-width 76%
- Label row above: `QUARRY` in IBM Plex Mono `9px` orange uppercase
- Bubble: background `#151310`, border `1px solid #1e1a14`, border-radius `3px 12px 12px 12px`
- Body: IBM Plex Sans `12px` `#bbb`, `line-height: 1.75`
- ReactMarkdown renders content (same remark-gfm + rehype-raw as existing)
- Action row below bubble: `⊞ Research` · `⎋ Fork` · `⎘ Copy`
  - Research button: orange tint `rgba(249,115,22,0.06)`, orange border, orange text
  - Fork/Copy: dim `#555`, subtle border

**Streaming/searching state:**
- While AI is deciding + searching: label shows `QUARRY · searching`, three animated orange dots + "Searching web…" text
- While AI is streaming text: content streams in, no action row yet

### `src/components/chat/ResearchDrawer.js`
Bottom sheet overlay. Slides up from bottom when Research button clicked.

- Overlay: `rgba(0,0,0,0.6)` backdrop, closes on click outside
- Sheet: background `#13110e`, top border `1px solid #2a2218`, border-radius `12px 12px 0 0`
- Drag handle: `36px × 3px` pill centered at top
- Tabs: Sources · Contradictions · Perspectives · Citations (IBM Plex Mono, `10px`, uppercase)
  - Active tab: `#F97316`, orange `2px` bottom border
- Body: reuses existing `CitationsPanel`, `ContradictionsTab`, `PerspectivesTab` components
  - These receive the research data attached to the specific message (`message.researchData`)
- Max height: `65vh`

### `src/components/chat/InputBar.js`
Fixed at bottom of chat area.

- Textarea: `background: #151310`, `border: 1px solid #242018`, `border-radius: 12px`, IBM Plex Sans `12px`
- Send button: `28×28px`, `border-radius: 8px`, orange `#F97316`, arrow icon
- Keyboard: `Enter` sends, `Shift+Enter` newlines
- Hint row below: `↵ send · shift+↵ newline · ⎇ fork from here` in dim IBM Plex Mono `9px`
- Disabled while `streaming === true`

---

## 3. Backend

### `backend/routers/chat.py` (new file)

**`POST /chat/message`**

Request:
```json
{
  "session_id": "uuid | null",
  "branch_id": "uuid | null",
  "message": "string",
  "history": [{"role": "user|assistant", "content": "string"}]
}
```

Response: SSE stream, same `data: JSON\n\n` format as existing `/explore/search`.

Events emitted:
1. `data: {"type": "session", "session_id": "...", "branch_id": "..."}` — first event, confirms IDs
2. `data: {"type": "searching", "query": "..."}` — emitted if AI decides to search (0 or more)
3. `data: {"type": "sources", "sources": [...]}` — after search completes
4. `data: {"type": "chunk", "text": "..."}` — streamed tokens
5. `data: {"type": "research", "contradictions": [...], "perspectives": [...]}` — after stream
6. `data: {"type": "title", "title": "..."}` — only on first message of new session
7. `data: {"type": "DONE"}` — terminal event

**Agentic loop:**
1. Build messages array: system prompt + history + new user message
2. System prompt lists one tool: `search_web(query: str) → str`
3. Add `chat_sync_with_tools(messages, tools)` to `llm.py` — thin wrapper that passes `tools=` to the OpenAI client's `chat.completions.create()` call and returns `(content, tool_calls)`
4. Call `chat_sync_with_tools(messages, tools)` — if `tool_calls` present, run `explore_the_web(query)` from `ai_service.py`, emit `searching` + `sources` events, append tool result to messages, call `stream_sync(messages)` for final streamed answer
5. If no tool calls: call `stream_sync(messages)` directly

**`POST /chat/sessions`**

Creates new session. Returns `{session_id, branch_id, title: "New conversation"}`.

**`GET /chat/sessions`**

Returns list:
```json
{
  "sessions": [
    {
      "id": "uuid",
      "title": "Sudan conflict 2024",
      "created_at": "iso",
      "branches": [
        {"id": "uuid", "label": "RSF origins", "message_count": 4, "created_at": "iso"},
        {"id": "uuid", "label": "Humanitarian impact", "message_count": 2, "created_at": "iso"}
      ]
    }
  ]
}
```

**`POST /chat/sessions/{session_id}/fork`**

Request: `{"from_message_id": "uuid", "branch_label": "string | null"}`
Creates new branch from that message point. Returns `{branch_id, label}`.
Auto-label: if `branch_label` is null, generate a 3-word label from the forked message content via `chat_sync()`.

**`GET /chat/search?q=string`**

Semantic search via Chroma. Returns top 5 matching message excerpts with `{session_id, branch_id, excerpt, score, session_title}`.

---

## 4. Chroma Storage

**Collection:** `quarry_conversations`

Each document stored on every AI response:
- `id`: `message_uuid`
- `document`: full AI response text
- `metadata`: `{session_id, branch_id, role: "assistant", timestamp, session_title}`

User messages also stored:
- `metadata`: `{session_id, branch_id, role: "user", timestamp, session_title}`

Messages also persisted to a local JSON file `backend/data/conversations.json` for fast listing/retrieval without vector queries (Chroma is used for semantic search only, not primary storage).

Structure of `conversations.json`:
```json
{
  "sessions": {
    "uuid": {
      "title": "string",
      "created_at": "iso",
      "branches": {
        "uuid": {
          "label": "string",
          "messages": [
            {"id": "uuid", "role": "user|assistant", "content": "string", "timestamp": "iso", "research_data": null}
          ]
        }
      }
    }
  }
}
```

`research_data` on assistant messages:
```json
{
  "sources": [...],
  "contradictions": [...],
  "perspectives": [...],
  "query_used": "string | null"
}
```

---

## 5. Visual Design

- Background: `#110f0d` (darker than sepia homepage — chat feels like a dedicated focused space)
- All text: IBM Plex Sans
- Sidebar: `#110f0d` bg, `#1c1813` border
- Message bubbles: dark, low contrast borders — minimal
- Orange accent `#F97316` for: active session, active branch dot, AI label, Research button, send button
- No gradients, no glass blur on chat surfaces — flat dark panels only
- Drawer is the only surface with a backdrop blur effect

---

## 6. What Does NOT Change

- `AppTopbar.js` — unchanged
- `sourceLibrary.js` — unchanged
- `CitationsPanel`, `ContradictionsTab`, `PerspectivesTab` — reused as-is inside ResearchDrawer
- SSE event format `data: JSON\n\n` — preserved
- Backend test suite (169 passing) — no existing routes modified
- `ai_service.py` `explore_the_web()` — called as-is from the agentic tool handler

---

## 7. Out of Scope

- Message editing
- Conversation sharing/export
- Multi-user / auth (no change to auth layer)
- Mobile-specific layout (responsive but not a separate mobile design)
- Image search, finance cards, knowledge graph (not in chat context)
