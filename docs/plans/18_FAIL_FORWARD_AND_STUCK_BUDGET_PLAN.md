# Plan 18: Fail Forward — Meaningful Failure and a Bounded Stuck Budget

Make every failed check move the story. A failure denies the player's **intent**, never the story: it costs something appropriate to the action, changes the situation, and offers at least two genuinely new approaches. A static "try again" beat is no longer a legal outcome. The only authorized exceptions are authored gates and an exhausted retry budget — and even those must explain why the method is blocked and offer real alternatives.

This plan is the direct continuation of Plan 17 (Player Status Authority). Plan 17 made the status bar and travel state faithful to the prose. Plan 18 makes the **failure path** just as honest: if the prose says the attempt failed, the engine must have already decided what the failure costs and what it changes, and the writer receives that as binding context.

---

## 1. Executive Summary & Problem Diagnosis

### 1.1 What was happening

| Symptom | Root cause | File |
| :--- | :--- | :--- |
| Every failure damaged HP, even a failed bribe or a failed search | The failure branch applied a hardcoded `-10 HP` (critical: `-15 HP`) regardless of action type | `actionCheckEngine.ts` |
| The same obstacle repeated for 24 turns | No retry budget. A failed action and its rephrasing were treated as fresh attempts forever | `actionCheckEngine.ts`, `action/route.ts` |
| Failed scene ended with "you failed, try again" | The writer prompt described the outcome but had no failure-forward contract, no binding mode, and no "at least two new approaches" rule | `PromptAssembler.ts` |
| A failed scene could still grant the goal | Prose validator only rejected openly triumphant failure prose; it had no forward-motion check | `ProseValidator.ts` |
| Momentum guardrail could not see the failure loop | `StallingType` covered repetitive standoffs and choice recycling, but not "the failed obstacle did not change" | `momentumGuardrail.ts` |
| Authored transitions never fired in the playtest harness | The harness sent `choiceId` but omitted `targetSceneId`, so the route never resolved the authored beat | `scripts/playtestArc1ZarrinPol.ts` |

Observed evidence from the Arc 1 playtest: 24 consecutive turns at `loc_muzo9ij9_ycy6` (چاه سنگ), each with the same failed search/entry intent. The harness omitted `targetSceneId`, so authored movement never happened; the failure path had no state change, no budget, and no prompt instruction to move the situation. The result was a legitimate-looking but infinite loop.

### 1.2 Why "sometimes stuck is valid" still needs a budget

A hard stop is dramatically useful when the player is trying to brute-force an authored gate ("the sealed gate will not open without the bronze seal") or when they have repeated the same failed approach twice. In those cases, stopping is **information**: the player learns the method is wrong and what the alternatives are. But without a budget, every failure becomes a hard stop, because the prose has no reason to change the obstacle. The design therefore separates:

- **Normal failure** — the intent fails, the situation changes. No permission to stop.
- **Authorized hard stop** — an authored gate or an exhausted identical retry. The writer must reveal why and offer alternatives.

### 1.3 Goals & non-goals

**Goals**

- Deterministic failure modes: `cost`, `complication`, `reveal`, `reposition`, `escalation`, `hard_stop`.
- Action-appropriate costs: HP only for bodily risk; social/investigative failures cost time, attention, stamina, resolve, leverage, or information.
- Retry policy: first identical retry escalates; second unchanged retry hard-stops.
- Authored gate support at the location level and per choice.
- Binding writer prompt block plus a system-wide failure contract (EN/FA).
- A `failure_stall` momentum check that rejects a static failure and provides a failure-specific repair instruction.
- Authored-scene movement that does not depend on the client forwarding `targetSceneId`.
- Full deterministic test coverage and a Plan 14 eval scenario.

**Non-goals**

- No new DB tables or Prisma migrations. Failure fields live on the existing `CheckResolution` JSON.
- No rewrite of mixed-success/combat math.
- No Studio UI expansion in this plan (the schema fields are authorable JSON; a visual editor is a follow-up).
- No automatic push; code and plan land together in commits.

---

## 2. Design Principles

1. **Failure denies the intent, not the story.** The goal is not granted; the situation must still change.
2. **Deterministic engine, dramatizing writer.** The engine selects the mode and cost; the writer may not negotiate or soften them.
3. **Action-appropriate price.** A bribe cannot cause a stab wound. Bodily risk is the only key to HP; everything else pays in time, attention, stamina, resolve, leverage, or information.
4. **Bounded retries, not infinite patience.** One repeat escalates; two prior identical failures hard-stop.
5. **Hard stops are authored or earned.** A hard stop is legal only for an authored gate/hard-stop choice or an exhausted retry budget. Both must reveal the requirement and offer at least two alternatives.
6. **The prose and the state agree.** Failure resource changes are applied in the same turn; no writer-invented wound is needed to justify a cost.
7. **Movement is engine-owned.** Authored `targetSceneId` is derived server-side from the selected choice; the client cannot strand the player by omitting a body field.
8. **Backward compatible by default.** All new fields are optional; old sessions and clients continue to work. The default failure behavior is the new forward behavior, not the old `-10 HP`.

---

## 3. Failure Mode Model

### 3.1 Modes

```ts
export type FailureMode =
  | 'cost'
  | 'complication'
  | 'reveal'
  | 'reposition'
  | 'escalation'
  | 'hard_stop';

export type FailureActionKind =
  | 'investigative'
  | 'social'
  | 'physical'
  | 'travel'
  | 'other';
```

| Mode | What the scene must do | Typical use |
| :--- | :--- | :--- |
| `cost` | Deny the intent and charge a concrete, causal price | Bodily-risk physical actions |
| `complication` | Introduce an immediate new problem, debt, witness, or pressure | Social failures, generic actions |
| `reveal` | Expose a fact, clue, weakness, requirement, or alternative that changes the next decision | Investigative failures |
| `reposition` | Force a change of position, footing, cover, or access | Non-bodily physical failures |
| `escalation` | Advance the danger, clock, patrol, or pursuit | Travel, critical failures, retries |
| `hard_stop` | The method is genuinely blocked; reveal why and what is required | Authored gates, exhausted retries |

### 3.2 Default mode by action kind

| Action kind | Primary | Secondary | Cost |
| :--- | :--- | :--- | :--- |
| Investigative | `reveal` | `complication` | Stamina (10) / resolve (5), or narrative time/attention |
| Social | `complication` | `reveal` | Stamina (10) / resolve (5), or narrative leverage/time |
| Physical, bodily risk | `cost` | `reposition` | Health (10; critical 15) |
| Physical, no bodily risk | `reposition` | `cost` | Stamina (10; critical 15), never HP |
| Travel | `escalation` | `cost` | Stamina (10; critical 15), or narrative delay |
| Other | `complication` | — | Stamina (10) / resolve (5), or narrative time/attention |

### 3.3 Special rules

- **Critical failure** always combines `escalation` with `cost`. On a critical social failure the cost is stamina/resolve, not HP; on a critical bodily-risk failure it is health.
- **First identical repeat** (one prior failure at the same approach and place) overrides the default with `escalation`.
- **Second unchanged repeat** (two prior identical failures) overrides everything except an authored hard stop with `hard_stop`.
- **Authored mode** applies when there is no retry or gate precedence.
- **Hard stops do not add a second mechanical penalty.** The failed attempts already cost the player; the hard stop is information, not another tax.
- **Existing health penalties suppress extra failure cost.** If feasibility or hazard displacement already applied damage, the failure engine does not double-charge health.
- **No stamina/resolve pool** → no resource deduction; the failure is paid in narrative time, attention, or lost opportunity.

### 3.4 Retry budget

`countConsecutiveFailedAttempts` walks backward through session turns:

- Counts only `failure` / `critical_failure`.
- Stops at the first success.
- Stops at a different action approach (similarity below threshold).
- Stops when the location changed.
- Stops when the previous turn's scene id does not match the current location.
- Caps at 3; the engine only needs "none", "first repeat", and "exhausted".

Similarity normalizes Arabic/Persian letter variants (`ي`→`ی`, `ك`→`ک`), strips ZWNJ/bidi controls and punctuation, applies light English stemming (`searching`→`search`), removes stopwords, and uses a Jaccard/overlap blend. A genuine new approach resets the budget; a paraphrase does not.

### 3.5 Hard-stop authorization

A hard stop is allowed only when one of these is true:

1. `previousFailedAttempts >= 2` (exhausted identical retries).
2. The selected choice has `failureMode: 'hard_stop'`.
3. The current location has `hardGate: true` **and** the failed action is an entry/bypass action (`isGateAction`). A hard gate does not freeze unrelated actions in the same location.

For every hard stop, the engine supplies:

- `stuckAllowed: true`
- `stuckReason` (why the method is blocked / retries exhausted)
- `requirementHint` (the authored hint, when present)
- A directive requiring at least two genuinely different alternatives.

Without one of those conditions, `stuckAllowed` is `false`, and the prompt explicitly forbids a static failure.

---

## 4. Type & API Contracts

### 4.1 `CheckResolution` additions

```ts
failureMode?: FailureMode;
failureSecondaryMode?: FailureMode;
failureActionKind?: FailureActionKind;
failureDirective?: { en: string; fa: string };
stuckAllowed?: boolean;
stuckReason?: string;
failureRequirementHint?: string;
previousFailedAttempts?: number;
```

### 4.2 `ChoiceOption` additions

```ts
failureMode?: FailureMode;   // authored choice policy
failureHint?: string;        // requirement/why the method is blocked
```

### 4.3 `WorldLocation` additions

```ts
hardGate?: boolean;          // authored gate for entry/bypass actions
hardGateHint?: string;       // what is required to pass
```

### 4.4 `WorkingContextEnvelope.resolvedGameOutcome`

Additive fields mirroring the resolution:

```ts
failureMode?: FailureMode;
failureSecondaryMode?: FailureMode;
failureActionKind?: FailureActionKind;
failureDirective?: string;    // localized
stuckAllowed?: boolean;
stuckReason?: string;
failureRequirementHint?: string;
locationChanged?: boolean;
```

`locationChanged` is derived from `resolution.stateDiff.locationChange` or a travel arrival. It tells the writer that the protagonist has already moved this turn and that the failure is the price of arrival, not a reason to keep them at the old threshold.

---

## 5. Writer Prompt Contract

### 5.1 System-level contract (EN/FA)

`PromptAssembler` now includes `[FAILURE FORWARD CONTRACT — MANDATORY]` / `[قرارداد شکستِ پیش‌برنده — اجباری]`:

- Failure denies the intent, never the story.
- The pre-resolved failure mode and directive are binding.
- Every failure must change something concrete: a price, complication, reveal, forced position change, or advancing threat.
- Costs are causal and proportional; HP only for bodily risk.
- At least two choices must pursue a genuinely different approach.
- A hard stop is permitted only when the engine authorizes it; then explain why, reveal the requirement, and offer at least two alternatives.
- If the engine moved the protagonist, depict the new place and the cost of arrival; do not narrate them still stuck.

### 5.2 Binding per-turn block

When `resolvedGameOutcome` carries a failure, both the English and Persian pre-resolved outcome blocks append:

```text
[FAILURE FORWARD — PRE-RESOLVED MODE]
• Failure Mode: REVEAL + COMPLICATION (secondary)
• Binding directive: ...
• Stuck permitted: NO — ...
```

A hard stop renders `Stuck permitted: YES`, the reason, and the requirement hint. An engine movement adds the movement instruction.

### 5.3 Forbidden endings

The contract explicitly forbids a static `"try again"` / `«دوباره تلاش کن»` ending and forbids rephrasing the failed action as the only path. At least two choices must open a new approach.

---

## 6. Momentum Guardrail — `failure_stall`

`StallingType` gains `failure_stall`. The SubQ request now includes:

- `resolved_outcome`
- `failure_mode`
- `failure_directive`

and a conditional `has_failure_stall` question:

> Only when the outcome is failure/critical_failure: did the prose leave the same failed obstacle exactly in place with no new cost, complication, reveal, reposition, or escalation — and no new information, pressure, price, or opportunity? Answer FALSE for an authorized hard stop that reveals why and offers alternatives.

Priority in `evaluateNarrativeMomentum`:

1. `ignored_success`
2. `failure_stall` (only on failure outcomes)
3. `choice_recycling`
4. `repetitive_standoff`
5. SubQ `stalling_type`

On a failed turn with no progress and no specific flag, the fallback is `failure_stall`, not a generic repetitive standoff. The repair instruction is failure-specific: deny the intent, change the situation, do not invent a rescuer/hazard, and offer at least two genuinely different choices.

A deterministic heuristic also catches the most common loop: on a failed turn, it counts the candidate choices that are genuinely new (not similar to the failed action) and flags `failure_stall` when fewer than two are new. A single-choice list is flagged only when its sole choice is a retry.

---

## 7. Authored Gates and Authored Choices

- `WorldLocation.hardGate` / `hardGateHint` — location-level gate.
- `StoryBeatChoice.failureMode` / `failureHint` — choice-level policy.
- The action route resolves the selected choice from:
  - the previous turn's rendered choices (AI or authored), and
  - the story's `initialStoryBeats[].choices`.
- The chosen choice's policy is passed into `resolveActionCheck`.
- The AOT branch engine passes the same policy and retry budget, so a pre-written branch obeys the same rules.

**Gate scope:** a location gate only hard-stops entry/bypass actions (`open`, `enter`, `force`, `unlock`, `pass`, `cross`, `دروازه`, `عبور`, `ورود`, etc.). Searching the courtyard at the same location remains a normal check.

---

## 8. Authored Movement Hygiene

Authored transitions used to depend on the client sending `targetSceneId`. The playtest harness sent only `choiceId`, so the route never resolved the authored beat and the player remained at the same obstacle. Plan 18:

- Changes `targetSceneId` to a mutable local in the action route.
- After resolving the chosen choice, derives `targetSceneId` from `chosenChoice.targetSceneId` when the body omitted it.
- Forwards `targetSceneId` explicitly from `scripts/playtestArc1ZarrinPol.ts`.

This is additive and does not change the meaning of an explicit `targetSceneId` from a client.

---

## 9. Implementation Phases

### Phase 0 — Types and shared contracts

- [x] `FailureMode`, `FailureActionKind`, `FailureDirective` in `gameplay.ts`.
- [x] `CheckResolution` failure fields.
- [x] `ChoiceOption.failureMode/failureHint`.
- [x] `StoryBeatChoice` schema fields.
- [x] `WorldLocation.hardGate/hardGateHint`.
- [x] `WorkingContextEnvelope.resolvedGameOutcome` failure fields + `locationChanged`.
- [x] All fields optional for backward compatibility.

### Phase 1 — Deterministic failure engine

- [x] `failForwardEngine.ts`: action classification, travel intent, gate detection, retry similarity, mode selection, action-appropriate costs, bilingual directives.
- [x] Retry precedence and 3-attempt cap.
- [x] Hard-stop authorization and requirement hints.
- [x] Existing-health-penalty suppression.
- [x] `failForwardEngine.test.ts` covering classification, modes, costs, critical failure, gates, retries, and similarity.

### Phase 2 — Action check integration

- [x] Remove hardcoded failure HP (`-10` / `-15`) from the generic failure branch.
- [x] Compute `bodilyRisk` once and use it for the failure engine.
- [x] Resolve health/stamina/resolve keys from the RPG system.
- [x] Merge failure resource changes into `stateDiff`.
- [x] Return failure mode, secondary mode, action kind, directive, stuck fields, requirement hint, and prior attempts.
- [x] Keep critical failure at `escalation + cost` with action-appropriate resource.
- [x] `GameEngine.test.ts` integration tests.

### Phase 3 — Route and AOT wiring

- [x] Resolve the selected authored choice and pass failure policy.
- [x] Compute `previousFailedAttempts` from session turns (0 on remake).
- [x] Resolve the current location's `hardGate` policy.
- [x] Pass retry/gate options into `resolveActionCheck` in the live route.
- [x] Mirror the same options in `aotBranchEngine.ts`.
- [x] Add AOT parity tests for critical failure and authored hard stop.
- [x] Derive `targetSceneId` from `choiceId`/text server-side.
- [x] Forward `targetSceneId` in the playtest harness.

### Phase 4 — Prompt and momentum guardrail

- [x] `failureForwardBlock` in both pre-resolved outcome blocks (EN/FA).
- [x] `[FAILURE FORWARD CONTRACT — MANDATORY]` in the system prompt (EN/FA).
- [x] Localized `failureDirective` in `narrativeTurn`.
- [x] `failure_stall` in `StallingType` and `extractSubQChoice`.
- [x] `has_failure_stall` question + failure mode/directive state.
- [x] Failure-specific repair instruction (EN/FA).
- [x] Candidate-choice retry heuristic.
- [x] Failure fallback on non-progressing failed turns.
- [x] `PromptAssembler.test.ts`, `momentumGuardrail.test.ts`, and `narrativeTurn.test.ts` coverage.

### Phase 5 — Evaluation and verification

- [x] Plan 14 eval scenario `eval_fail_forward_reveal` (failure denies the goal, reveals a clue, divergent choices).
- [x] `tsc --noEmit` clean.
- [x] Targeted engine, prompt, momentum, AOT, and narrative tests green.
- [x] Full web test suite green.
- [x] Plan document updated with the implemented design and progress log.

### Phase 6 — Follow-ups (not required for this plan)

- [ ] Studio UI controls for `hardGate`/`hardGateHint` on the location editor and `failureMode`/`failureHint` on authored choices.
- [ ] A failure-specific judge/eval cassette that checks the final prose for "intent denied + situation changed" in both languages.
- [ ] Optional telemetry aggregation for failure-mode distribution and hard-stop frequency.

---

## 10. Testing Strategy

| Layer | Tests |
| :--- | :--- |
| Failure engine | `failForwardEngine.test.ts` — classification (EN/FA), social idiom, gates, default modes, critical escalation+cost, non-bodily stamina/resolve, no-pool fallback, authored modes, retry escalation/hard-stop, similarity normalization, consecutive-attempt reset |
| Action engine | `GameEngine.test.ts` — non-bodily failure has no HP, critical social failure costs stamina, retry escalation, exhausted hard stop, authored gate hard stop with hint, existing crit-failure HP test preserved |
| Prompt | `PromptAssembler.test.ts` — EN/FA contract, binding mode block, hard-stop reason/requirement, engine movement, clean success omits the block |
| Momentum | `momentumGuardrail.test.ts` — category extraction, `has_failure_stall` request, SubQ priority/fallback, retry-choice heuristic, repair text EN/FA |
| Envelope | `narrativeTurn.test.ts` — failure plan and localization carried into `resolvedGameOutcome`; `locationChanged` |
| AOT parity | `aotBranchEngine.test.ts` — critical failure carries the plan; authored hard stop carries the hint |
| Eval | `evalScenarios.ts` — `eval_fail_forward_reveal` |

Run:

```bash
cd web
npx tsc --noEmit
npm test
```

---

## 11. Backward Compatibility & Rollout

- No Prisma migration. `resolution` is already a JSON column; new fields are optional.
- Old sessions without resolved failure fields behave normally: the engine computes a plan on the next failure.
- Old clients ignore the additive fields.
- The default failure behavior changes intentionally: no more generic `-10 HP` on social/investigative failures.
- No feature flag is required because the failure plan is deterministic and the prompt block is only rendered when a failure resolution exists.
- The playtest harness fix is additive.

---

## 12. Acceptance Criteria

- [x] A failed bribe or search does **not** reduce HP; it costs stamina/resolve or narrative time/attention. *(GameEngine test: `charges a non-bodily failure in stamina and assigns a forward mode`.)*
- [x] A failed bodily-risk action may cost HP, but only when the action can plausibly injure the protagonist. *(Original crit-failure HP test preserved; bodily/non-bodily mode tests.)*
- [x] A normal failure always changes the situation: cost, complication, reveal, reposition, or escalation. *(Mode engine + prompt contract + `failure_stall` guardrail tests.)*
- [x] The first identical retry produces `escalation`; the second unchanged retry produces `hard_stop`. *(Engine and GameEngine integration tests.)*
- [x] An authored gate hard-stops entry/bypass attempts with its hint, but does not freeze unrelated actions at the location. *(Gate-scope test.)*
- [x] Every hard stop reveals why the method is blocked and offers at least two genuinely different alternatives. *(Directive + prompt block tests; requirement hint carried into the envelope.)*
- [x] A static "try again" ending is rejected by the `failure_stall` guardrail and repaired. *(SubQ, fallback, retry-choice heuristic, and repair-instruction tests.)*
- [x] The writer receives the failure mode, directive, stuck permission, and engine movement as binding context in EN and FA. *(PromptAssembler and narrativeTurn tests.)*
- [x] Authored scene movement works when the client sends only `choiceId` (no `targetSceneId`). *(Server-side derivation + playtest harness forwarding; verified via typecheck and code-path review.)*
- [x] `npx tsc --noEmit` is clean and the full web test suite passes. **1201/1201.**

---

## 13. File Touchpoint Reference

| File | Change |
| :--- | :--- |
| `web/src/lib/engines/game/failForwardEngine.ts` | New deterministic failure engine |
| `web/src/lib/engines/game/failForwardEngine.test.ts` | New unit tests |
| `web/src/lib/engines/game/actionCheckEngine.ts` | Failure integration, removed hardcoded failure HP, pool-aware costs |
| `web/src/lib/engines/game/GameEngine.test.ts` | Non-bodily/critical/retry/gate integration tests |
| `web/src/lib/engines/narrative/PromptAssembler.ts` | Failure contract + binding block EN/FA |
| `web/src/lib/engines/narrative/PromptAssembler.test.ts` | Prompt contract/block tests |
| `web/src/lib/engines/narrative/narrativeTurn.ts` | Envelope failure fields + localized directive |
| `web/src/lib/engines/narrative/narrativeTurn.test.ts` | Envelope tests |
| `web/src/lib/engines/narrative/momentumGuardrail.ts` | `failure_stall` SubQ/heuristic/repair |
| `web/src/lib/engines/narrative/momentumGuardrail.test.ts` | Momentum tests |
| `web/src/lib/engines/narrative/aotBranchEngine.ts` | Retry/gate parity |
| `web/src/lib/engines/narrative/aotBranchEngine.test.ts` | AOT parity tests |
| `web/src/app/api/play/action/route.ts` | Choice policy, retry count, gate policy, `targetSceneId` derivation |
| `web/src/lib/types/gameplay.ts` | Failure types and resolution fields |
| `web/src/lib/types/world.ts` | Authored gate + choice failure policy |
| `web/src/lib/types/memory.ts` | Envelope failure fields |
| `web/src/lib/evals/evalScenarios.ts` | Fail-forward eval scenario |
| `web/scripts/playtestArc1ZarrinPol.ts` | Forward `targetSceneId` |
| `docs/plans/18_FAIL_FORWARD_AND_STUCK_BUDGET_PLAN.md` | This plan |

---

## 14. Progress Log

> Updated after each completed step. Status values: ✅ done · 🟡 in progress · ⬜ pending.

| Phase | Status | Date | Notes |
| :--- | :--- | :--- | :--- |
| Phase 0 — Types and shared contracts | ✅ done | 2026-10-19 | Optional failure fields across gameplay/world/memory types; authored gate and choice policy schemas. |
| Phase 1 — Deterministic failure engine | ✅ done | 2026-10-19 | `failForwardEngine.ts` + classification/mode/cost/retry/similarity tests. Retry cap 3; critical = escalation + cost; hard stop suppresses extra resource cost. |
| Phase 2 — Action check integration | ✅ done | 2026-10-19 | Hardcoded failure HP removed; action-appropriate resource cost; failure fields returned; integration tests added. |
| Phase 3 — Route and AOT wiring | ✅ done | 2026-10-19 | Selected authored policy, retry count, location gate, AOT parity, server-side `targetSceneId` derivation, harness forwarding. |
| Phase 4 — Prompt and momentum | ✅ done | 2026-10-19 | EN/FA contract and binding block; `failure_stall` SubQ + heuristic + repair; envelope localization. |
| Phase 5 — Evaluation and verification | ✅ done | 2026-10-19 | Eval scenario, `tsc --noEmit` clean, full web suite **1201/1201**, plan update. |
| Phase 6 — Follow-ups | ⬜ pending | — | Studio UI, prose judge, telemetry. |

*Plan 18 closes the failure half of the determinism loop: the dice may deny the player's intent, but they can no longer deny the story a next step.*
