# Plan 14: AI Narrative Agent Test & Evaluation System (StoryForge Evals)

Establish an automated, multi-tiered testing and evaluation system for the StoryForge AI narrative generation agent (`PromptAssembler` + `GeminiAdapter` + `ProseValidator`). This framework detects regressions, enforces dice and choice rules, verifies world canon consistency, and provides objective benchmarks across models and prompt revisions.

---

## 1. Problem & Motivation

The StoryForge story generation agent is an emergent, non-deterministic system operating under strict mechanical constraints:
1. **Dice Mechanics & DC Scaling**: Risky actions, armed confrontations, and life-or-death standoffs must **never** be presented as diceless choices. Feat DCs must align with protagonist attributes and opposition scale (mortal vs. superhuman).
2. **Outcome Adherence (Cause & Effect)**: When a player rolls a failure or critical failure, the prose must depict the complication directly without disguising it as an effortless victory.
3. **World Lore & Canon Invariants**: Deceased NPCs must stay dead, world laws must remain inviolable, and the agent must not hallucinate unanchored entities or factions.
4. **Bilingual Literary Polish**: Prose must adhere to high-tier literary standards in both Persian and English, including proper quotation formatting (`«...»` / `"..."`) and natural direct speech.

### The Limitation of Manual QA
Previously, bugs (such as an armed sentry standoff offering a free diceless dialogue bypass, or a barricade smash being assigned DC 10) were only discovered through manual end-user playtesting. Every prompt adjustment or model switch risked silent regressions.

**The Solution: A 5-Tier Automated Evaluation System** that provides continuous verification from fast, free local CI to full multi-turn autonomous playtesting.

---

## 2. System Architecture

```
                                  [ StoryForge AI Engine ]
                                (PromptAssembler + GeminiAdapter)
                                             |
     +-------------------+-------------------+-------------------+-------------------+
     |                   |                   |                   |                   |
 [ Tier 1 ]          [ Tier 2 ]          [ Tier 3 ]          [ Tier 4 ]          [ Tier 5 ]
Deterministic       10 Canonical        Dual-Layer          Autonomous          Developer
Invariants &        Golden Scenarios    Evaluator           Playtest            Tooling &
Guardrails          Benchmark           (Rules + Judge)     Simulator           Studio UI
(CI / Zero Cost)    (Live / Replay)     (Heuristic + LLM)   (5-10 Turns)        (CLI & Bench)
```

---

## 3. Detailed Components

### Tier 1: Deterministic Invariants & Guardrail Tests (Zero Cost, CI)
- **Path**: `web/src/lib/engines/narrative/` & `web/src/lib/evals/invariants/`
- **Runs via**: Standard `npm test` in CI on every commit.
- **Scope**:
  - **Prompt Invariants**: Asserts that `PromptAssembler` correctly injects protagonist capabilities, active threat clocks, world laws, and universal base values for both English and Persian contexts.
  - **Synthetic Stress Testing of `normalizeChoices`**:
    - Feeds 50+ adversarial, edge-case choice arrays (e.g. missing IDs, extreme DCs, Persian typos, armed standoff phrases disguised as peaceful questions).
    - Verifies that standoff keywords (`sword`, `blade`, `sentry`, `guard`, `شمشیر`, `گزمه`) automatically convert diceless choices into stat checks with calibrated DCs.
  - **Synthetic Stress Testing of `validateProse`**:
    - Asserts 100% catch rate for resurrected NPCs listed in the World State Ledger.
    - Asserts detection of outcome contradiction words (e.g., `triumph` on failure).

---

### Tier 2: The 10 Canonical "Golden Scenarios" Matrix
A curated suite of versioned evaluation fixtures stored in `web/src/lib/evals/scenarios/evalScenarios.ts`. Each scenario provides a realistic `WorkingContextEnvelope` and defines strict verification assertions:

| Scenario ID | Story Setup | Core Invariant & Verification Target |
| :--- | :--- | :--- |
| `eval_standoff_sentry` | Sentries with drawn spears block an ancient bridge | **Zero diceless choices**. All choices have `requiredStatId` and DC $\ge 12$. Sentry speech is confrontational. |
| `eval_crit_failure_pickpocket` | Rogue attempts pickpocket and rolls Nat 1 | Consequence immediately depicted in opening line; guards alerted; no triumphant wording. |
| `eval_crit_success_lockpick` | Infiltrator picks ancient vault lock (Nat 20) | Lock opens cleanly; narrative immediately introduces the next interior challenge; choices explore deeper. |
| `eval_mortal_barricade` | Peasant protagonist (Might 4) at military gate | Feats are tactical/grounded (leverage, stealth, deception); barehanded brute-force smashing is forbidden. |
| `eval_heroic_barricade` | Demigod protagonist (Might 16, mythic relic) | Heroic brute-force choices unlocked with appropriate DCs ($14-18$); prose reflects immense physical scale. |
| `eval_dead_npc_ledger` | Ledger records companion "Rostam" as slain | Rostam never appears alive, speaks, or acts as a living participant in the prose. |
| `eval_immutable_law` | World Law: "Magic is forbidden upon penalty of death" | AI does not offer casual spellcasting without severe guard alert and mortal danger. |
| `eval_threat_clock_max` | Tension Clock: "Castle Alarm" hits 4/4 | AI unleashes the alarm crisis event immediately in the scene prose; stands down clock. |
| `eval_persian_literary` | Persian fantasy story at dark river docks | Direct speech enclosed in `«...»`; authentic literary Persian; zero English text leakage. |
| `eval_choice_atomicity` | Choice generation across diverse scenes | Choices describe *action intent*, never *pre-baked outcomes* (e.g. no "You escape safely"). |

---

### Tier 3: Dual-Layer Evaluator (Heuristics + LLM-as-a-Judge)

The evaluator in `web/src/lib/evals/evaluator.ts` processes scene outputs through two complementary lenses:

#### Layer A: Heuristic Rule Checker (Deterministic Pass/Fail)
- **JSON & Schema Integrity**: Conforms strictly to `GeneratedSceneResponse` with 2 to 4 choices.
- **Standoff Safety Net**: If scene prose describes weapons drawn or hostile guards, `dicelessCount === 0`.
- **Stat Whitelist**: $100\%$ of choice `requiredStatId`s match active system stats.
- **DC Range Calibration**:
  - Low-risk: $7 \le \text{DC} \le 10$ (or $6 \le \text{DC} \le 8$ in low-base systems).
  - High-risk: $14 \le \text{DC} \le 17$ (or $10 \le \text{DC} \le 12$ in low-base systems).
- **Prose Length & Tone Bounds**: 150 to 450 words; direct dialogue correctly punctuated.

#### Layer B: LLM-as-a-Judge Rubric (Scored 1 to 5)
A lightweight frontier model (e.g., `gemini-2.5-flash` or `gemini-3.5-flash-lite`) acts as an impartial literary judge evaluating:
1. **Cause-and-Effect Responsiveness** (Did the opening paragraph immediately depict the player's prior action and the direct reaction of the target NPC/environment?).
2. **Grounded Feasibility** (Are the proposed choices feasible given the protagonist's actual attributes, health, and carried gear?).
3. **Tactical Divergence & Agency** (Do choices offer meaningfully different approaches: combat vs. stealth vs. diplomacy vs. investigation?).
4. **Atmosphere & Literary Polish** (Is the prose immersive, evocative, and free of generic AI tropes like "The choice is yours"?).

---

### Tier 4: Autonomous Multi-Turn Simulation (Headless Playtest Bot)
- **Path**: `web/src/lib/evals/simulator.ts`
- Runs a multi-turn headless game loop over 5 to 10 consecutive turns without human intervention.
- **Persona Archetypes**:
  - **The Brute**: Always chooses high-risk, Might-based, or combat actions.
  - **The Shadow**: Prioritizes Agility, Cunning, stealth, and evasion.
  - **The Diplomat**: Prioritizes Charisma, persuasion, and peaceful de-escalation.
  - **The Boundary-Pusher**: Deliberately picks erratic or high-DC actions to test engine guardrails.
- **Session Trajectory Audit**:
  - Monitors HP/Resolve depletion and prevents negative health without death events.
  - Verifies threat clocks tick on complications and trigger crises when full.
  - Audits memory extraction to ensure the ledger is not flooded with duplicate entries.
  - Asserts that the story advances smoothly without looping in cyclical prose traps.

---

### Tier 5: Developer Tooling & Studio UI Integration

#### 1. CLI Runners
```bash
# Run the 10 Golden Scenarios benchmark
npm run eval:narrative

# Run benchmark against a specific model
npm run eval:narrative -- --model=gemini-3.5-flash-lite

# Run a 5-turn autonomous playtest simulation with the Brute persona
npm run eval:simulate -- --turns=5 --persona=brute
```
- Outputs an ANSI-formatted terminal summary with pass/fail badges, judge scores, token counts, and latency metrics.

#### 2. Studio Diagnostic Bench (`/studio/diagnostics/ai`)
- An interactive web interface in StoryForge Studio:
  - **Single Scenario Runner**: Run any Golden Scenario on demand and view full prose, choice breakdowns, and rule audits.
  - **Model & Prompt Diffing**: Run identical scenarios through two different models (e.g., `gemini-3.5-flash-lite` vs `gemini-2.5-flash`) or compare revised prompts against baseline.
  - **Violation Highlighting**: Visual indicators pinpointing rule violations (e.g. diceless choices in standoff, DC out of bounds).

---

## 4. Implementation Roadmap

### Phase 1: Core Engine & Golden Scenarios (Foundations)
- Create `web/src/lib/evals/evalScenarios.ts` containing the 10 Golden Scenario fixtures.
- Implement `web/src/lib/evals/evaluator.ts` with the Heuristic Rule Checker.
- Implement `web/src/lib/evals/evalRunner.ts` to orchestrate scenario execution.

### Phase 2: LLM-as-a-Judge & CLI Runner
- Implement the structured LLM-as-a-Judge evaluation prompt and parser in `evaluator.ts`.
- Build CLI entrypoint `web/scripts/evalNarrative.ts` with terminal reporting.
- Add `eval:narrative` script to `web/package.json`.

### Phase 3: Autonomous Playtest Simulator
- Implement `web/src/lib/evals/simulator.ts` and `web/scripts/evalSimulate.ts`.
- Add persona strategy logic (Brute, Shadow, Diplomat, Boundary-Pusher).
- Add trajectory auditing for health, threat clocks, and memory accumulation.

### Phase 4: Studio Diagnostic Bench UI
- Create `/studio/diagnostics/ai` page in Next.js.
- Build interactive scenario runner cards, prompt diff viewers, and rubric visualizers.

---

## 5. Implementation Status (shipped)

> Status: **implemented**. All five tiers are live, verified by `npm test`
> (48 files, 446 passing) and a clean `npm run build`.

### Prerequisite refactors (required to test the real pipeline)
- **`web/src/lib/engines/narrative/modelCall.ts`** — `SceneModelCall` injection
  seam returning the **RAW** pre-normalization payload (plus `modelUsed`), with
  `defaultSceneModelCall` preserving the production cascade.
- **`GeminiAdapter`** — optional `{ modelCall }` constructor option,
  `generateSceneRaw()`, and `generateSceneWithRaw()` (one call → raw + normalized).
  Behaviour is unchanged when no seam is injected, and an injected seam that
  yields nothing never falls through to the network.
- **`web/src/lib/engines/narrative/narrativeTurn.ts`** — envelope assembly,
  prompt building, model call, prose validation + up to two repairs, and secret
  sanitization extracted from `POST /api/play/action`. The route and the eval
  harness share this code, so evals exercise the production path.

### Tier 1 — Deterministic invariants (`npm test`, zero cost)
- `src/lib/evals/invariants/promptInvariants.test.ts` — capabilities, abilities,
  gear, laws, threat clocks, continuity guardrails, DC bands, EN/FA parity.
- `src/lib/evals/invariants/choicesInvariants.test.ts` — 21 armed-standoff vs.
  peaceful EN/FA phrases plus **55 adversarial choice arrays**; verifies the
  standoff safety net, stat whitelist, DC clamping, and low-base bands.
- `src/lib/evals/invariants/proseInvariants.test.ts` — resurrection catch rate
  across the ledger, memorial tolerance, outcome adherence, immutable-law lore.

### Tier 2 — Golden scenarios + cassettes
- `evalScenarios.ts` — the 10 canonical scenarios.
- `evaluator.ts` — Layer A heuristics asserted against **raw** model output;
  normalizer rescues are reported separately (`rescuedChoices`) so a green run
  cannot hide a model that produced garbage.
- `modelReplay.ts` + `cassetteStore.ts` + `cassettes/` — deterministic replay.
- `evalRunner.ts` + `scripts/evalNarrative.ts` → `npm run eval:narrative`,
  `npm run eval:record` (`--live`, `--record`, `--model`, `--scenario`, `--json`).

### Tier 3 — Dual-layer evaluator
- Layer A as above; `judge.ts` provides the LLM-as-a-Judge rubric (4 axes, 1-5,
  Zod-validated) behind `--judge` / `EVAL_JUDGE=1`.

### Tier 4 — Autonomous simulator
- `simulator.ts` + `scripts/evalSimulate.ts` → `npm run eval:simulate`
  (`--persona=brute|shadow|diplomat|boundary`, `--turns`, `--seed`, `--live`).
- Deterministic synthetic model by default (free, reproducible); audits HP,
  threat-clock ticking/crisis, duplicate memories, and cyclical prose.

### Tier 5 — Studio Diagnostic Bench
- `GET/POST /api/studio/diagnostics/ai/run` and `/studio/diagnostics/ai`
  (registered in the Studio nav under AI Studio).

### Deviations from the original text, and why
1. **Raw-output assertions.** The plan asserts on `GeneratedSceneResponse`,
   which `normalizeChoices` has already repaired — that would pass even for
   garbage output. Assertions now run on the raw payload.
2. **Cassettes were added.** The plan promised free CI but had no replay
   mechanism; recorder/replay makes Tiers 2-4 deterministic.
3. **A real guardrail bug was found and fixed.** `eval_standoff_sentry` caught
   "Level your crossbow at the bandit…" escaping the confrontational detector;
   `normalizeChoices` now recognises ranged weapons, hostile-actor nouns, and
   coercive verbs (EN + FA).
4. **Single canonical scenario path** (`src/lib/evals/evalScenarios.ts`),
   resolving the §3 vs Phase-1 path drift.

---

## 6. Real-world story harness (`npm run eval:story`)

The five tiers above test the agent against *synthetic* contexts. This harness
closes the loop by playing a **real authored story** through the **live HTTP
pipeline** (`POST /api/play/session` + `POST /api/play/action`) — real manifest,
real DB session, server-authoritative `PlayerState`, real model — then auditing
the shipped turns with the Tier 3 heuristics plus trajectory rules.

```bash
npm run dev                    # in web/, the harness talks to it over HTTP
npm run eval:story             # default: story_mt4ofllt, shadow, 6 turns, seed 42
npm run eval:story -- --turns=8 --persona=boundary --seed=7 --raw --verbose
npm run eval:story -- --storyId=<id> --baseUrl=http://localhost:3000 --json --out=report.json
```

It reports per-turn roll/outcome/DC/HP/clock, prose word counts, choice-panel
shape, heuristic errors, a trajectory audit, and (with `--raw`) an
**informational** RAW probe that calls the shared `generateValidatedScene`
engine in-process to inspect the pre-guardrail payload.

### What it checks
- **Transport** — every turn reaches the route; guardrail rejections are surfaced
  as warnings rather than silently skipped.
- **Standoff safety, scoped per choice** — a *confrontational* choice (production
  `isConfrontationalChoiceText`, incl. declared `high` risk) must never ship
  diceless. A peaceful choice in a scene that merely *mentions* guards is
  legitimately diceless, so a prose-level proxy would produce false positives.
- **Script purity** — no glyphs from other writing systems in Persian prose.
  Both production validation (`ProseValidator`, language-gated) and the story
  harness reuse the same `unexpectedPersianScriptCharacters` detector (see
  remediation tracker finding 1).
- **Prose shape** — word count, choice count, DC sanity band, stat whitelist.
- **Defeat coherence** — the Hybrid Defeat System (Option C) revives the player
  with escalating penalties; a defeat must restore HP above 0 and increment
  `defeatCount`. Continuing after a defeat is by design, **not** a violation.
- **Trajectory** — resource pacing, threat-clock progression, progression drift,
  unwinnable/unfailable runs, cyclical prose (token-set Jaccard).

### Verified live runs — خاکسترِ زروان (`story_mt4ofllt`, gemini-3.5-flash-lite)
| Persona | Turns | Result | Notes |
|---|---|---|---|
| boundary (seed 7) | 8 | **PASS** — 0 errors, 0 warnings | 3 diceless choices, all legitimately non-confrontational |
| brute (seed 11) | 6 | **PASS** — 1 warning | `trajectory.no_failures` (all 6 rolls beat their DCs) |
| diplomat (seed 5) | 6 | **PASS** — 0 errors, 0 warnings | 18/18 choices carried checks; HP 30→20 |

20 turns through the production pipeline; avg latency ~3.5s, prose 92–237 words,
`healthKey=health` resolved identically to the route's regex chain.

### Findings from live play
1. **A real prompt defect: walk-away choices on turn 1.** An earlier boundary
   run shipped *"عقب کشیدن و بازگشتن به سوی آتش کاروانسرا"* — the very first
   choice walked the player out of the scene while a spear was at their chest.
   Open (remediation tracker #3): the standoff directive covers checks, not
   scene abandonment. This needs an explicit contextual-threat contract, not a
   blanket guard-keyword rule.
2. **Foreign-script glyph leakage.** A live run emitted an Odia combining mark
   (U+0B3F, previously misreported as Bengali) inside a Persian sentence
   (`به بند کشିده است`), which renders as a visible defect in the reader. Fixed
   (remediation tracker #1): language-gated `ProseValidator` script-leak check
   plus repair guidance, with regression coverage in `ProseValidator.test.ts`
   and `ProseValidator.scriptLeak.test.ts`. The story harness reuses the same
   detector.
3. **The canon-rejection path is real and reachable.** One turn returned
   HTTP 503 *"Generated prose violated world canon and could not be repaired.
   The turn was NOT recorded. Please retry."* The turn loop is correctly
   non-destructive. Fixed in code (remediation tracker #4): the initial draft
   plus up to two repair calls with `repair_unavailable` / `unrepairable`
   guards. Dedicated repair-budget regression tests are still missing.


