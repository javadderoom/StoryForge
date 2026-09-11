# Plan 12: Story-Weaver Agent, Unified Beat Graph & Hybrid Reader

> Status: planned (agreed 2026-09-11). Decisions locked: hybrid reader,
> single unified beat graph, Beats-page weaver action, full-expansion
> authority, preview-then-approve, diceless choices allowed by default.

---

## 1. Background — how AI generates story beats today

Four generation paths in `web/src/app/api/studio/generate/route.ts`:

| Path | Edge handling | Stored in |
|---|---|---|
| `scene` (single flat beat, `beats/page.tsx:101-142`) | prompt has no `leadToSceneId`; commit drops edges | `initialStoryBeats` (append) |
| `branching_story_tree` (`beats/page.tsx:196-233`) | prompt HAS `leadToSceneId`, but commit writes **`destinationSceneId`** (`:220`) — canvas + audit only read `targetSceneId`, so edges are invisible | `initialStoryBeats` (replace) |
| `chapter_scenes` (per-act, from `narrative-arcs/page.tsx:156-239`) | prompt has no `leadToSceneId`; `mapDraftScenesToBeats` drops it entirely | `saga.chapters[].scenes` (append) |
| `epic_saga_synthesis` (`beats/page.tsx:238-302`) | correct `targetSceneId` (`:273`) + repair loop (422 on error / score<70) | `saga.chapters[].scenes` |

No path resolves AI-hallucinated IDs to real `sceneId`s. `StoryTreeCanvas`
renders edges only from `choice.targetSceneId` (`:271-309`); manual linking
exists via the inspector dropdown (`:726-741`); `LoreAuditor.auditSaga`
flags dangling edges (`LoreAuditor.ts:47-95`).

The reader is generative, not graph-traversal: a new session shows
`initialStoryBeats[0]` only (`api/play/session/route.ts:337`), each turn
sends choice text and the LLM invents fresh narrative + choices
(`api/play/action/route.ts:550-561`). Authored beats only supply
`imageUrl`/`chapterNumber` (`:546-559`). `saga.chapters[].scenes` never
render. Single-scene generation *appends*, so a user beat hides behind the
factory placeholder (`storyFactory.ts:66-74`) at `[0]`.

Arc vignettes (`chapter_scenes`) are deliberately standalone showcase
scenes: the schema has no sequence/continuation fields, each call is
stateless (act goal + world context only — no premise, no prior scenes),
temperature is 0.8, and `persistChapters` appends blindly. Related by theme
only. This is accepted as-is; the weaver (below) connects them.

---

## 2. Locked decisions

1. **Reader: hybrid** — linked choices jump to authored beat text; unlinked
   choices keep the current generative path. Strict traversal rejected;
   pure-generative rejected.
2. **Storage: single unified graph** — one beats collection with `chapterId`
   tags (`null` = opening), replacing `initialStoryBeats` +
   `saga.chapters[].scenes`. Chapters become metadata-only.
3. **Weaver placement: Beats-page action** ("Weave connected story" button;
   Oracle persona deferred).
4. **Weaver authority: full saga expansion** — vignettes stay verbatim as
   anchors; agent sequences them, writes bridges, AND grows additional
   chapters until the arc is complete.
5. **Landing: preview-then-approve** — visual diff with kind badges, per-beat
   accept/reject, approve-all. No auto-commit.
6. **Choices: diversity-driven, diceless allowed** — drop the forced
   defensive/tactical/aggressive × difficulty matrix; DCs by sense (all easy
   fine); choices without `statCheck` branch without a dice roll.

---

## 3. Quality contracts (ride inside the weaver)

- **Opener**: position 0 gets an opener contract — world-state grounding,
  protagonist situation + background hook, inciting incident, larger text
  budget. Plus placeholder-eviction so a real opener never hides behind the
  seed placeholder in the reader.
- **First introductions**: engine tracks entities introduced per beat in
  sequence order; each first appearance requires 1–2 sentences of sensory
  grounding from the bible entry. Repeat appearances stay lean. Deterministic
  check in the repair loop.
- **Choice diversity**: 3 choices maximally diverse in approach/consequence
  (different tactics, risks, story doors); DCs 5–30 as sanity bounds only;
  `statCheck` optional.

---

## 4. Phase 1 — Stop the bleeding (no migration)

1. Fix edge keys: `destinationSceneId` → `targetSceneId`
   (`beats/page.tsx:220`); add `targetSceneId` to single-scene commit
   (`:126-142`) and `mapDraftScenesToBeats` (`narrative-arcs:171-188`); add
   `leadToSceneId` to `scene` + `chapter_scenes` prompts
   (`generate/route.ts:438-441`).
2. ID resolution step after every commit: exact id → exact name → fuzzy
   match; unmatched → empty + audit warning (never persist hallucinated IDs).
3. Placeholder eviction on first real commit.

## 5. Phase 2 — Weaver engine (`weave_story` type)

- `buildWeavePrompt`: vignettes with real IDs, act goals, world digest
  (real names+ids), RPG stat IDs, existing beats (collision avoidance).
- Output: `{ sequence: [{ order, kind: anchor|bridge|expansion, ... }] }`;
  anchors referenced by real ID, text untouched; bridges name their
  carryover; expansions continue escalation; all choices chain via
  `leadToSceneId` reference keys (`anchor:<id>` / `new:<slug>`).
- `coerceWeave` assigns final `sceneId`s server-side; model never invents IDs.
- Validation reuses the repair-loop pattern: `auditSaga` + `auditSagaStats`
  + weave checks (anchors verbatim, all edges resolve, no orphans,
  opener/introduction/diversity contracts). One low-temperature retry, else
  422 with findings.
- Tests: verbatim anchors, resolvable edges, real-entity references,
  repair/422 behavior.

## 6. Phase 3 — Beats-page action + preview diff

- "Weave connected story" button with scope selector (act / whole arc).
- Preview reusing saga-preview components with kind badges (🔷 anchor,
  🔶 bridge, 🟣 expansion) plus markers (🌅 opener, ✨ introductions).
- Per-beat approve/reject, approve-all, single-bridge regenerate
  (predecessor+successor context).
- Commit via the Phase-1 ID resolver; pre-migration, writes carry chapter
  tags so the unified migration is trivial.

## 7. Phase 4 — Unified graph migration

- Merge `initialStoryBeats` + chapter scenes into one `chapterId`-tagged
  collection; chapters metadata-only.
- Update writers/readers: `StudioStoryContext`, beats + narrative-arcs
  pages, `StoryTreeCanvas` dual mode, `LoreAuditor.auditSaga`, session/action
  routes, `StoryManifestIntegrity` tests.
- Versioned, idempotent migration for Postgres manifests + localStorage
  drafts; remap legacy `destinationSceneId` data.

## 8. Phase 5 — Hybrid reader

- Choice payload carries `targetSceneId` (web `page.tsx` + `api.ts`, Flutter
  `sendAction`); server traverses to authored text when the edge resolves
  (GameEngine + memory/ledger still run); unlinked/dangling → generative
  fallback. Fixes the stuck-`currentSceneId` issue as a side effect.
- Session start: first `chapterId-null` beat (saga-chapter-1 fallback).
- Linked choices get a subtle "story path" affordance; diceless choices
  branch without a roll.

## 9. Verification

- Unit: edge mapping, ID resolver, migration order/tags, traversal
  (linked/unlinked/dangling), opener/introduction/diversity checks.
- Existing suites stay green: `publishGate`, `LoreAuditor`,
  `StoryManifestIntegrity`, `StudioGenerate`.
- Manual: 1 flat + 3 arc → canvas edges → reader walks them → unlinked
  choice still generates.

## 10. Risks

- Postgres + localStorage migration must be idempotent and versioned.
- Full-expansion outputs risk truncation: cap expansions per run, chain
  chapter-by-chapter with summaries if needed.
- Hybrid reader slightly amends the "AI is narrator" contract: linked taps
  show authored text verbatim; resolutions stay deterministic.
