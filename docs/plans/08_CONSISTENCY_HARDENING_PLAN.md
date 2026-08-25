# Plan 08: Narrative Consistency Hardening

> **Goal:** Make every persisted turn, memory, and saga state change provably consistent with the World Bible, the deterministic Game Engine outcome, and the player's actual history.
>
> **Golden Principle reinforced:** *"The player can change the story, but cannot change the rules of the world — and neither can a hallucinating model, a desynced client, or a failed API call."*

This plan is the output of a full audit of the existing consistency pipeline (authoring → validation → resolution → narration → persistence). Each finding cites the exact source location.

---

## 🗺️ Consistency Pipeline Today (audited)

```
Authoring        LoreAuditor (deterministic) + AI audit_world     ← on demand only
Play Turn        ActionValidator → GameEngine.resolveActionCheck
                 → applyStateMutation
Narration        buildWorldContextBlocks (UNSCOPED) → PromptAssembler → GeminiAdapter
Persistence      SessionRepository.recordTurn → TurnHistory / MemoryLog / sagaLedger (never written)
Saga Layer       StoryChapter / SagaManifest / WorldStateLedger   ← authored; not used at play time
```

---

## 🔴 P0 — Canon-Corrupting Gaps

### 1. Failed AI calls silently persist mock prose as canon
- **Evidence:** `GeminiAdapter.generateScene` (`web/src/lib/providers/GeminiAdapter.ts:71-74`) catches API errors and returns a canned dungeon scene ("ironwood door", "basalt alcove"). `/api/play/action` then persists that beat as a real turn (`src/app/api/play/action/route.ts:210-241`).
- **Impact:** Players receive off-world text regardless of their actual location/story, and it enters permanent memory + turn history.
- **Fix:** Mirror `StudioGenerate`'s honest failure: return HTTP 503 without fallback. Optionally include `isMock: true` on any degraded response so the client can discard and retry.

### 2. Client-supplied PlayerState is trusted blindly
- **Evidence:** `action/route.ts:44` assigns `playerState = incomingPlayerState` verbatim. A replayed/desynced client can claim `knownSecrets` (bypassing the ActionValidator knowledge guardrail), ghost inventory, or maxed stats.
- **Fix:** Server-authoritative state. When `sessionId` is present, load `playerState` from the session row and treat client input as display-only; merge deltas instead of overwriting.

### 3. The Living World State Ledger is never written
- **Evidence:** Plan 07 added `playthrough_sessions.sagaLedger` and `currentChapterId` columns plus repository support, but no play-time code updates them. NPC deaths, faction reputation shifts (`stateDiff.relationshipChanges`), and story-critical item gains all flow through `stateDiff` and then evaporate.
- **Impact:** The single biggest lever for 50–200+ turn coherence is inert.
- **Fix:** Derive ledger patches from each `applyStateMutation` result inside the `recordTurn` path:
  - `relationshipChanges` → `npcStatuses` notes / faction stance drift
  - `itemsAdded` (story-critical) → `keyItems`
  - death/transform outcomes → `npcStatuses.status`
  - completed chapters → append to `chapterSummaries` via `completionSummaryPrompt`

### 4. AI narrative output is never post-validated
The prompt *requests* compliance ("MUST strictly depict the pre-calculated outcome", `PromptAssembler.ts:72-76`) but nothing verifies it:

| Gap | Evidence | Fix |
| :-- | :-- | :-- |
| Choices reference stats that don't exist | `GeminiAdapter.ts:61-68` accepts any `requiredStatId`; unknown ids silently roll with modifier 0 at `GameEngine.ts:174` | Reject/clamp to `story.rpgSystem.stats` ids |
| Prompt hardcodes wrong stat examples | `'might', 'agility', 'cunning', 'arcana'` in `PromptAssembler.ts:83,99` even for noir/custom schemas | Inject the story's actual stat list into both system prompts |
| Memory importance/category untrusted | `action/route.ts:229-233` persists raw AI values | Clamp importance 0–10, whitelist categories, drop importance < 3 (match `MemoryEngine.recordMemory` policy — currently inconsistent) |
| Narrative can contradict world/outcome | No check after generation | Deterministic scan of fresh prose against ledger-dead NPCs / extinct-law creatures; flag or regenerate |

---

## 🟠 P1 — Spec'd but Missing Guardrails

### 5. Action Validator "Check 3: World Lore Check" is unimplemented
- **Evidence:** MASTER_PLAN §5.3 promises physics → inventory → lore tiers. `ActionValidator.validateAction` ships only a fragile single-match inventory regex (`ActionValidator.ts:37-76`; greedy capture, first-match-only, weak Persian coverage) and the secret-knowledge detector.
- **Minimum viable lore check:**
  - Build a banned-entity lexicon from immutable laws + bestiary (e.g. law *"Dragons are extinct"* → reject "summon a dragon").
  - Movement plausibility: actions traveling to a location must target a `connectedLocationIds` neighbor (or an already-discovered location) unless framed as a check.
- **Also:** secret detector false positives — common words (≥5 chars, e.g. "blood", "tower") appearing twice trigger rejection. Require NPC co-mention or distinctive-term overlap.

### 6. LoreAuditor blind spots (`src/lib/engines/world/LoreAuditor.ts`)
Existing checks (dangling links, one magic-ban regex, rivalry asymmetry, orphans, thin laws) miss:
- Artifacts held by **NPC** ids — only `location` holders are validated (`LoreAuditor.ts:117-128`)
- Religion `holyLocationIds` / `affiliatedFactionIds`, bestiary `habitatLocationIds`, drama-bond endpoints
- **Duplicate entity names** — two "Captain Rolan"s poison context injection and retrieval boosts
- NPCs stationed at graph-unreachable locations (connectivity check)

### 7. Nothing validates the saga graph (Plan 07 follow-up)
Committed sagas can contain: dangling `targetSceneId` edges (across chapters), duplicate `sceneId`s (breaks tree layout & edge rendering), empty chapters, unsatisfiable `prerequisiteFlags`.
- **Fix:** Extend `LoreAuditor` with saga-aware rules; run automatically on saga commit (free, deterministic) and surface warnings in Studio — do not require a manual `/studio/sandbox` audit visit.

---

## 🟡 P2 — Coherence Polish

8. **Play ignores scoped context & rollups.** `action/route.ts:103` calls `buildWorldContextBlocks(story)` unscoped; Tier 2 episodic rollups and Tier 3 ledger lines are never injected. Use `buildChapterContextString(...)` + `MemoryEngine.buildThreeTierEnvelope(...)` fed from the session row (both already exist from Plan 07).
9. **Synthetic turn sceneIds.** `scene_turn_${turnNumber}` (`action/route.ts:212`) severs memory→authored-scene linkage; carry the real scene id from the chosen beat/choice.
10. **Schema honesty.** `initialStoryBeats: z.array(z.any())` (`src/lib/types/story.ts:60`) — swap in the existing `StoryBeatSchema`; localStorage/server manifest loads parse with no schema gate.
11. **Phantom resource damage.** `mixed_success`/failure always emit `hp`/`stamina` diffs (`GameEngine.ts:277-285`) even for stories without those resources, and `applyStateMutation` defaults unknown resources to a 0–100 range (`GameEngine.ts:324`). Map consequence damage onto the story's declared primary resource pool.
12. **Memory deduplication.** Repeated discoveries stack in retrieval; add a normalized-summary similarity guard in `MemoryEngine.recordMemory`.

---

## 📁 Implementation Roadmap

| Phase | Component | Key Files | Description |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Stop canon corruption | `providers/GeminiAdapter.ts`, `api/play/action/route.ts` | Remove silent mock persistence (503); clamp/whitelist AI memories; validate choice statIds vs rpgSystem |
| **Phase 2** | Server authority | `api/play/action/route.ts`, `repositories/sessionRepository.ts` | Load PlayerState from session when sessionId present; merge client deltas |
| **Phase 3** | Ledger writes | `engines/game/GameEngine.ts` (ledger diff helper), `repositories/sessionRepository.ts` | Derive WorldStateLedger patches per turn; persist via recordTurn; read back into envelope |
| **Phase 4** | Guardrails | `engines/validator/ActionValidator.ts` | Banned-entity lexicon from immutable laws; movement plausibility via connectedLocationIds; secret-detector precision |
| **Phase 5** | Auditor v2 | `engines/world/LoreAuditor.ts` | NPC artifact holders, religion/bestiary/bond refs, duplicate names, connectivity, saga-graph rules |
| **Phase 6** | Scoped play context | `api/play/action/route.ts`, `engines/narrative/*` | Chapter-scoped lore injection + three-tier envelope at play time |
| **Phase 7** | Tests | `*.test.ts` suites | Mock-fallback rejection, stat-id validation, ledger diff derivation, new auditor rules, validator lexicon |

**Suggested order:** Phase 1 immediately (small, testable, stops active corruption) → Phase 2 → Phase 3 → Phases 4–5 → remaining polish.
