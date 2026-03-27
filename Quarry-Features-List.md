# Quarry — Feature Ideas & Improvements

---

## Research → Writing Flow

**1. Claim Assembly Board**
Before writing, drag claims from your research onto a kanban-style board with columns: *Include / Maybe / Exclude*. Once you're happy with the arrangement, hit "Build Draft" and the AI writes a structured piece using only the claims you approved — in the order you placed them.

**2. Evidence Pairing**
Each paragraph in the Write editor gets a small "needs evidence" indicator. You drag a source pill from the research tray and *drop it onto a paragraph* to link them. The editor then shows which paragraphs are sourced vs unsourced at a glance — like a coverage map for your writing.

**3. Claim Sequencer**
A timeline-style view where you drag claims into chronological or logical order before writing. The AI then generates a narrative that follows *your* sequence rather than its own, so the story structure is yours.

**4. Contradiction Resolver**
When two sources contradict each other, instead of just flagging it, show a "resolve this" card with three draggable options: *Trust Source A / Trust Source B / Present both views*. Drag your choice into the card, and the AI incorporates your decision into the brief.

**5. Source Weighting**
Before generating a brief, let the user drag sources into a priority stack — most trusted at the top, least trusted at the bottom. The AI weights its answer accordingly and tells you which sources it leaned on most.

---

## Follow-Up Improvements

**6. Follow-Up Builder**
Instead of a plain text input, the follow-up area becomes a structured builder with three drag-and-drop slots:
- *Angle* (e.g. "Focus on humanitarian impact")
- *Lens* (e.g. "Through the perspective of NGOs")
- *Constraint* (e.g. "Only use verified claims")

Fill the slots, hit Ask, and the follow-up is precisely scoped rather than a vague question.

**7. Branching Follow-Ups**
After each result, show 3 follow-up suggestions as before — but let the user *combine two of them* by dragging one onto another. The merged follow-up gets sent as a single compound question ("What is the humanitarian impact AND what do NGOs say about it?").

**8. Follow-Up Chain View**
Show a visual thread of all follow-ups in a session as a chain — each question linked to its parent. You can click any node in the chain to branch off from that point instead of the latest answer, so you can explore different angles from the same starting point without losing your trail.

**9. Confidence-Gated Follow-Ups**
Follow-up suggestions are tagged by what they'd resolve — e.g. "This would upgrade 2 contested claims to corroborated." Clicking it runs the search specifically to resolve those gaps. The user sees exactly what epistemic value each follow-up adds before clicking.

**10. Follow-Up Scoped to a Sentence**
In the result view, highlight any sentence and a "dig deeper" button appears. Clicking it pre-fills the follow-up with that exact sentence as context — so the follow-up is always tightly scoped to the specific claim you're uncertain about, not the whole query.

---

## Bigger Interaction Ideas

**11. Story Blueprint**
A pre-writing canvas where you place labeled boxes (*Lede / Background / Evidence / Counterargument / Conclusion*) and drag claims into each box. Once all boxes are filled, "Generate from Blueprint" writes the full piece following your exact structure.

**12. Source Debate Mode**
Pick two sources that disagree. Quarry runs them as a structured debate — Source A's position, Source B's rebuttal, then an AI synthesis of where they actually agree. Useful for contested policy topics.

**13. Research Completeness Score**
A live score (0–100) that updates as you research, based on: source diversity, claim verification rate, topic coverage, and contradiction resolution. Tells you when you have *enough* to write confidently vs when you're still missing angles.

---

## Search — Making It More Meaningful for Journalists

The current search gives a short AI summary. Here's what it should give instead:

**14. Story Angle Extractor**
After retrieving sources, AI identifies 3–5 distinct *story angles* a journalist could take — not just what happened, but what's surprising, what's underreported, what's the human story, what's the systemic issue. Each angle links to the claims and sources that would support it. The journalist picks an angle before reading the full brief.

**15. Who Said What Matrix**
A table showing every major actor mentioned across sources (governments, NGOs, individuals, companies) with what each one *said or did* according to each source. Contradictions between actors are highlighted. Journalists covering press conferences or political statements would use this constantly.

**16. Timeline Auto-Builder**
From the retrieved sources, AI extracts all dated events and builds a scrollable timeline. Events are colour-coded by source so you can see which outlet reported what first, and which events only appear in a single source (flagged as unverified).

**17. Gap Analysis**
After generating the brief, AI explicitly lists what it *couldn't find* — questions raised by the sources that no source answers, data that's referenced but not provided, voices that are notably absent. This tells the journalist exactly where their original reporting needs to go.

**18. Quote Bank**
A dedicated tab (alongside Citations, Images, Contradictions) that extracts all direct quotes from the scraped sources — attributed, dated, and source-tagged. The journalist can drag any quote directly into the Write editor as a formatted blockquote with citation.

**19. Entity Tracker**
Every named person, organisation, location, and law mentioned across sources is extracted and listed as a sidebar panel. Click any entity to see every mention across all sources, what was said about them, and whether accounts are consistent. Useful for tracking who keeps appearing across a complex story.

**20. Confidence Heatmap on the Brief**
Instead of just inline badges, show a heatmap overlay on the full brief where sentence background colour intensity reflects verification confidence. Deeply verified passages are a neutral colour; contested or single-source passages glow amber/red. Toggle it on/off. Gives the journalist an immediate visual sense of where the brief is solid vs shaky.

**21. Source Perspective Breakdown**
A visual bar or pie showing the editorial lean distribution of the sources used — e.g. "3 left-leaning, 1 centrist, 1 state-affiliated." If the brief is based heavily on one type of source, a warning banner appears: *"This result is dominated by [X] sources — consider broadening."*

**22. Primary vs Secondary Source Flag**
Distinguish between sources that are reporting original information (eyewitness accounts, official statements, data releases) vs sources that are aggregating or summarising other reporting. Flag each source accordingly. Journalists need to know when they're reading the original record vs a summary of it.

**23. Newsworthiness Score per Claim**
Each extracted claim gets a newsworthiness tag: *Breaking / Developing / Background / Historical*. This helps journalists quickly triage what's actually new in a story vs what's context they already know, especially on ongoing topics they've been covering for months.

**24. Read the Primary Sources Button**
For each claim tagged as coming from an official document, report, or statement — show a "Read original" button that opens the primary source directly, not the news article covering it. Forces the journalist to verify at the source level rather than trusting the intermediary.

---

## MCP Integrations

### Gmail

**25. Source Alert Monitor**
Set up a Gmail filter/label for specific topics (e.g. "Gaza ceasefire"). Quarry monitors that label and when new emails arrive (press releases, newsletter briefings, journalist tips), it pulls them into your Source Library automatically — treated as a new source with credibility tagged as *Primary* if it's an official press release.

**26. Story Brief to Email**
One-click export of your current research brief as a formatted email draft in Gmail — pre-addressed if you're filing to an editor. Includes the confidence badges, source list, and word count inline.

**27. Interview Request Generator**
From the Entity Tracker (#19), click any person or organisation and Quarry drafts a Gmail interview request — pre-filled with context from what the sources say about them, and questions generated from the Gap Analysis (#17).

---

### Google Calendar

**28. Story Deadline Tracker**
When you save a story in Write, optionally set a publish deadline. Quarry creates a Google Calendar event with reminder milestones — *"Research complete," "First draft," "Final edit"* — spaced automatically based on the deadline.

**29. Event-Triggered Research**
Pull upcoming events from your Google Calendar (press conferences, UN sessions, elections, earnings calls) and surface them on the Quarry home page as *"Coming up — start researching now"* prompts. Click one to pre-fill a search.

**30. Source Follow-Up Reminders**
When a source is flagged as *single source* or *contested*, Quarry lets you set a Google Calendar reminder to recheck it in X days — useful for developing stories where new information is expected.

---

### Canva

**31. Infographic from Timeline**
The Timeline Auto-Builder (#16) gets an "Export to Canva" button that sends the timeline data to Canva and generates a publication-ready visual timeline infographic — formatted for social, print, or web.

**32. Who Said What Card**
The Who Said What Matrix (#15) can be exported to Canva as a designed comparison card — useful for social media explainers or article illustrations.

**33. Story Cover Generator**
When you finish a Write document, a "Create cover" button sends the headline and lede to Canva and generates a featured image / article header graphic with Quarry's visual style applied.