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

**The Solution: A 4-Tier Automated Evaluation System** that provides continuous verification from fast, free local CI to full multi-turn autonomous playtesting.

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
