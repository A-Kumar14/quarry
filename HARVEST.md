# HARVEST — what migrates forward from Quarry

Quarry is **frozen** at tag `v1-frozen` (legacy / citable). No further development.
Two pieces are worth lifting into the next (flagship) build. This file records
*what* they are and *where they're headed*, so future-me doesn't have to
re-derive the mapping from a 1140-line `ai_service.py`.

---

## 1. `detect_contradictions()` → detection heuristic for the memory-integrity tool

- **Where it lives now:** `backend/services/ai_service.py` — `detect_contradictions(sources)`
  - Input: list of `{title, url, snippet}`
  - Output: `{contradictions: [...], consensus: str}`
  - Wired to `frontend/src/components/ContradictionsTab.js`
- **Where it's headed:** the memory-integrity tool, as a **candidate detection
  heuristic** — flagging instruction-like or mutually contradictory writes
  before they land in memory. Same shape (find conflicting claims across a set),
  new domain (memory entries instead of news sources).

## 2. 4-step pipeline → report generator shape

- **Where it lives now:** the structured pipeline that replaced the single-LLM
  `explore_the_web()` call — claim extraction → reconciliation → confidence
  tagging → brief generation. See `ai_service.py` (`extract_claims`,
  `reconcile_claims`, `generate_brief`) and the SSE contract
  (`sources → chunk → [DONE]`).
- **Where it's headed:** the **report generator shape** for the flagship —
  the multi-step extract → reconcile → render structure is the reusable bone,
  independent of the news/epistemic framing.

---

## Do NOT harvest
- `sourceLibrary.js`, `citation_service.py`, `finance_service.py` — product-specific
- The Modern Newspaper / Liquid Glass design system — Quarry-specific
- ChromaDB chat integration — separate feature, not the report engine

## Citable summary (for resume / interviews)
> Quarry — epistemic research tool. Structured claim pipeline with contradiction
> detection and a 2D claim landscape. 169 passing tests. Frozen at `v1-frozen`.
